'use strict';

const { REPEAT_REWARD_RULES, ROTATION_CONFIG, OBJECTIVE_TYPE } = require('../missions.constants');

/**
 * MissionExecutionService – Orquestador de la capa de Aplicación.
 *
 * Depende ÚNICAMENTE de interfaces (DIP):
 *   - MissionRepositoryInterface  (inyectado)
 *   - SimulationEngineInterface   (inyectado)
 *
 * No importa mysql2, Express ni ninguna infraestructura concreta.
 *
 * ─── FLUJO DE EJECUCIÓN ───────────────────────────────────────────────────────
 *  1. Validar misión (tiene objetivo PRIMARY) y rotaciones (habilidades propias)
 *  2. BEGIN TRANSACTION → Bloquear héroe con FOR UPDATE → Crear player_mission
 *  3. COMMIT (libera el lock de escritura pero mantiene el estado LOCKED)
 *  4. Simular combate (fuera de transacción – puede ser lento)
 *  5. Aplicar modificador de recompensa por repetición (SCRUM-45)
 *  6. BEGIN TRANSACTION → Guardar resultado (idempotente) → Liberar héroe → COMMIT
 *  7. En cualquier error → ROLLBACK + liberar héroe (best-effort)
 */
class MissionExecutionService {

  /**
   * @param {import('../interfaces/MissionRepositoryInterface')} repositorio
   * @param {import('../interfaces/SimulationEngineInterface')}  motor
   */
  constructor(repositorio, motor) {
    this._repo  = repositorio;
    this._motor = motor;
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────────────

  /** Lista misiones disponibles para el jugador */
  async listarDisponibles(playerId) {
    return this._repo.obtenerMisionesDisponibles(playerId);
  }

  /** Detalle completo de una misión */
  async obtenerDetalle(misionId) {
    const mision = await this._repo.obtenerDetalleMision(misionId);
    if (!mision) throw new Error(`Misión ${misionId} no encontrada.`);
    return mision;
  }

  /**
   * Ejecuta una misión completa de principio a fin.
   * @param {{ playerId, misionId, heroeId, rotaciones[] }} params
   */
  async ejecutarMision({ playerId, misionId, heroeId, rotaciones }) {

    // ── PASO 1: Validaciones previas ─────────────────────────────────────────
    await this._validarMision(misionId);
    await this._validarRotaciones(playerId, rotaciones);

    // ── PASO 2: Transacción de inicio ────────────────────────────────────────
    const conn = await this._repo.getConnection();
    let playerMisionId = null;

    try {
      await conn.beginTransaction();

      // Bloquear héroe con FOR UPDATE — serializa acceso concurrente
      const { bloqueado, heroe } = await this._repo.bloquearHeroe(heroeId, conn);
      if (!bloqueado) {
        throw new Error(`El héroe ${heroeId} ya está participando en otra misión. (SCRUM-33)`);
      }

      // Registrar intento como IN_PROGRESS
      playerMisionId = await this._repo.crearMisionJugador(
        { playerId, misionId, heroeId, rotaciones }, conn
      );

      // Persistir rotaciones elegidas
      await this._repo.guardarRotaciones(playerMisionId, rotaciones, conn);

      await conn.commit();

      // ── PASO 3: Simulación (fuera de transacción) ────────────────────────
      const mision      = await this._repo.obtenerDetalleMision(misionId);
      const simResultado = await this._motor.simular(heroe, mision.enemigos, rotaciones);

      // ── PASO 4: Modificador por repetición (SCRUM-45) ────────────────────
      const previo         = await this._repo.buscarComplecionPrevia(playerId, misionId);
      const esRepeticion   = !!previo;
      const recompensaFinal = this._aplicarModificadorRepeticion(
        simResultado.recompensas ?? simResultado.rewards,
        esRepeticion
      );

      // ── PASO 5: Guardar resultado y liberar héroe ────────────────────────
      const conn2 = await this._repo.getConnection();
      try {
        await conn2.beginTransaction();

        const guardado = await this._repo.guardarResultado(
          playerMisionId,
          {
            resultado:   simResultado.resultado ?? simResultado.result,
            recompensas: recompensaFinal,
            logCombate:  simResultado.logCombate,
          },
          conn2
        );

        if (guardado) {
          // Solo liberar si realmente se procesó (idempotencia)
          await this._repo.liberarHeroe(heroeId, conn2);
        }

        await conn2.commit();

      } catch (err) {
        await conn2.rollback();
        // Intento best-effort de liberar al héroe para no dejarlo trabado
        await this._repo.liberarHeroe(heroeId).catch(() => {});
        throw err;
      } finally {
        conn2.release();
      }

      return {
        playerMisionId,
        misionId,
        heroeId,
        resultado:    simResultado.resultado ?? simResultado.result,
        rondas:       simResultado.rondas,
        logCombate:   simResultado.logCombate,
        hpFinalHeroe: simResultado.hpFinalHeroe,
        recompensas:  recompensaFinal,
        esRepeticion,
      };

    } catch (err) {
      await conn.rollback().catch(() => {});
      if (heroeId) await this._repo.liberarHeroe(heroeId).catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }

  // ── VALIDACIONES PRIVADAS ─────────────────────────────────────────────────

  async _validarMision(misionId) {
    const mision = await this._repo.obtenerDetalleMision(misionId);
    if (!mision) throw new Error(`Misión ${misionId} no encontrada.`);

    const tienePrimario = mision.objetivos.some(o =>
      (o.tipo ?? o.type) === OBJECTIVE_TYPE.PRIMARY
    );
    if (!tienePrimario) {
      throw new Error('La misión no tiene ningún objetivo PRIMARY. No se puede ejecutar. (SCRUM-27)');
    }
  }

  async _validarRotaciones(playerId, rotaciones) {
    if (!rotaciones?.length) {
      throw new Error('Se requiere al menos una rotación para ejecutar la misión.');
    }
    if (rotaciones.length > ROTATION_CONFIG.MAX_ROTACIONES) {
      throw new Error(`Se permiten máximo ${ROTATION_CONFIG.MAX_ROTACIONES} rotaciones. (SCRUM-35)`);
    }

    // Extraer todos los IDs de habilidades únicos de todas las rotaciones
    const todosLosIds = [
      ...new Set(
        rotaciones.flatMap(r => (r.habilidades ?? r.skills ?? []).map(h => h.id))
      ),
    ];

    if (todosLosIds.length > 0) {
      await this._repo.validarHabilidadesRotacion(playerId, todosLosIds);
    }
  }

  // ── CÁLCULO DE RECOMPENSAS ────────────────────────────────────────────────

  /**
   * Aplica el modificador de recompensa según SCRUM-45:
   *   - Primera compleción: 100% de recompensas
   *   - Repeticiones:       50% de reducción base
   */
  _aplicarModificadorRepeticion(recompensas, esRepeticion) {
    if (!esRepeticion) return recompensas; // primera vez → sin reducción

    const modificador = REPEAT_REWARD_RULES.REPETICION_BASE; // 0.5
    return {
      ...recompensas,
      creditos: Math.floor((recompensas.creditos ?? recompensas.credits ?? 0) * modificador),
      xp:       Math.floor((recompensas.xp ?? 0) * modificador),
    };
  }
}

module.exports = MissionExecutionService;
