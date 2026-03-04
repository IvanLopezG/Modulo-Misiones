'use strict';

const MissionRepositoryInterface = require('../interfaces/MissionRepositoryInterface');
const Mission = require('../domain/entities/Mission');
const Enemy   = require('../domain/entities/Enemy');
const { MISSION_STATUS, HERO_LOCK_STATUS } = require('../missions.constants');

/**
 * MissionsMySQLRepository
 *
 * Implementación concreta del repositorio usando mysql2 pool.promise().
 * Esta clase es la ÚNICA que conoce sobre mysql2. Los servicios no lo importan.
 *
 * Se inyecta en el servicio a través de la fábrica (missions.factory.js).
 */
class MissionsMySQLRepository extends MissionRepositoryInterface {

  /** @param {import('mysql2/promise').Pool} pool */
  constructor(pool) {
    super();
    this._pool = pool;
  }

  // ── Obtener conexión para manejo de transacciones ─────────────────────────
  async obtenerConexion() {
    return this._pool.getConnection();
  }

  // Alias para compatibilidad con el servicio (que usa getConnection en inglés)
  async getConnection() {
    return this._pool.getConnection();
  }

  // ── MISIONES ──────────────────────────────────────────────────────────────

  async obtenerMisionesDisponibles(playerId) {
    const [filas] = await this._pool.query(
      `SELECT m.*,
              (SELECT COUNT(*) FROM player_missions pm
               WHERE pm.mission_id = m.id
                 AND pm.player_id  = ?
                 AND pm.status     = 'COMPLETED') AS veces_completada
       FROM missions m
       WHERE m.status = 'AVAILABLE'
       ORDER BY m.level ASC`,
      [playerId]
    );
    return filas;
  }

  async obtenerDetalleMision(misionId) {
    const [[mision]] = await this._pool.query(
      `SELECT * FROM missions WHERE id = ? LIMIT 1`, [misionId]
    );
    if (!mision) return null;

    const [objetivos] = await this._pool.query(
      `SELECT * FROM mission_objectives WHERE mission_id = ?`, [misionId]
    );

    const [filasEnemigos] = await this._pool.query(
      `SELECT * FROM mission_enemies WHERE mission_id = ?`, [misionId]
    );

    // Construir entidades Enemy (usa stats de BD o auto-calcula)
    const enemigos = filasEnemigos.map(e => new Enemy({
      id:     e.id,
      nombre: e.nombre ?? e.name,
      nivel:  e.nivel  ?? e.level,
      tipo:   e.tipo   ?? e.type,
      stats:  e.stats_calculated ? JSON.parse(e.stats_calculated) : null,
    }));

    return new Mission({
      id:               mision.id,
      nombre:           mision.nombre ?? mision.name,
      descripcion:      mision.descripcion ?? mision.description,
      nivel:            mision.nivel ?? mision.level,
      duracionSegundos: mision.duration_seconds,
      estado:           mision.status,
      objetivos:        objetivos.map(o => ({ ...o, tipo: o.type, creditosRecompensa: o.credit_reward })),
      enemigos,
    });
  }

  // ── BLOQUEO DE HÉROE ──────────────────────────────────────────────────────

  /**
   * Usa FOR UPDATE para bloquear la fila del héroe dentro de la transacción.
   * Si dos peticiones llegan a la vez, MySQL serializa el acceso.
   * La segunda encontrará lock_status = 'LOCKED' y retornará bloqueado: false.
   */
  async bloquearHeroe(heroeId, conn) {
    const [[heroe]] = await conn.query(
      `SELECT id, name, level, stats, lock_status
       FROM user_heroes
       WHERE id = ?
       FOR UPDATE`,  // ← clave para evitar race conditions
      [heroeId]
    );

    if (!heroe) return { bloqueado: false, heroe: null };

    if (heroe.lock_status === HERO_LOCK_STATUS.LOCKED) {
      // Ya está en misión: rechazar sin modificar
      return { bloqueado: false, heroe };
    }

    await conn.query(
      `UPDATE user_heroes SET lock_status = ? WHERE id = ?`,
      [HERO_LOCK_STATUS.LOCKED, heroeId]
    );

    return { bloqueado: true, heroe };
  }

  async liberarHeroe(heroeId, conn) {
    const ejecutor = conn ?? this._pool;
    await ejecutor.query(
      `UPDATE user_heroes SET lock_status = ? WHERE id = ?`,
      [HERO_LOCK_STATUS.FREE, heroeId]
    );
  }

  // ── MISIONES DEL JUGADOR ──────────────────────────────────────────────────

  async crearMisionJugador({ playerId, misionId, heroeId, rotaciones }, conn) {
    // Detectar si es un intento repetido ANTES de insertar
    const previo   = await this.buscarComplecionPrevia(playerId, misionId);
    const esRepeat = !!previo;

    const [resultado] = await conn.query(
      `INSERT INTO player_missions
         (player_id, mission_id, hero_id, status, is_repeat, started_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [playerId, misionId, heroeId, MISSION_STATUS.IN_PROGRESS, esRepeat ? 1 : 0]
    );

    return resultado.insertId;
  }

  /**
   * Guarda el resultado final.
   * IDEMPOTENTE: si la misión ya fue finalizada, retorna false sin tocar nada.
   */
  async guardarResultado(playerMisionId, { resultado, recompensas, logCombate }, conn) {
    const ejecutor = conn ?? this._pool;

    // Verificar estado actual (protección de idempotencia)
    const [[existente]] = await ejecutor.query(
      `SELECT id, status FROM player_missions WHERE id = ? LIMIT 1`,
      [playerMisionId]
    );

    if (!existente) throw new Error(`playerMision ${playerMisionId} no encontrada.`);

    const estadosFinales = [MISSION_STATUS.COMPLETED, MISSION_STATUS.FAILED];
    if (estadosFinales.includes(existente.status)) {
      // Ya fue procesada — noop para garantizar idempotencia
      return false;
    }

    const nuevoEstado = resultado === 'VICTORY' ? MISSION_STATUS.COMPLETED : MISSION_STATUS.FAILED;

    await ejecutor.query(
      `UPDATE player_missions
       SET status       = ?,
           result       = ?,
           rewards_json = ?,
           combat_log   = ?,
           finished_at  = NOW()
       WHERE id = ?`,
      [nuevoEstado, resultado, JSON.stringify(recompensas), JSON.stringify(logCombate), playerMisionId]
    );

    return true;
  }

  async buscarComplecionPrevia(playerId, misionId) {
    const [[fila]] = await this._pool.query(
      `SELECT id FROM player_missions
       WHERE player_id  = ?
         AND mission_id = ?
         AND status     = 'COMPLETED'
       LIMIT 1`,
      [playerId, misionId]
    );
    return fila ?? null;
  }

  // ── ROTACIONES ────────────────────────────────────────────────────────────

  async guardarRotaciones(playerMisionId, rotaciones, conn) {
    if (!rotaciones?.length) return;

    const valores = rotaciones.map((rot, idx) => [
      playerMisionId,
      idx + 1,                         // prioridad 1, 2 o 3
      JSON.stringify(rot.habilidades ?? rot.skills ?? []),
    ]);

    await conn.query(
      `INSERT INTO player_rotations (player_mission_id, priority, skills_json)
       VALUES ?`,
      [valores]
    );
  }

  async validarHabilidadesRotacion(playerId, habilidadIds) {
    if (!habilidadIds.length) return true;

    const placeholders = habilidadIds.map(() => '?').join(',');
    const [filas] = await this._pool.query(
      `SELECT skill_id FROM player_skills
       WHERE player_id = ? AND skill_id IN (${placeholders})`,
      [playerId, ...habilidadIds]
    );

    const poseidas  = new Set(filas.map(f => f.skill_id));
    const faltantes = habilidadIds.filter(id => !poseidas.has(id));

    if (faltantes.length > 0) {
      throw new Error(
        `El jugador no posee las habilidades: [${faltantes.join(', ')}] (SCRUM-35)`
      );
    }

    return true;
  }
}

module.exports = MissionsMySQLRepository;
