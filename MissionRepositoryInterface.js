'use strict';

/**
 * MissionRepositoryInterface
 *
 * Contrato que TODA implementación concreta de repositorio debe cumplir.
 * Principio de Inversión de Dependencias (DIP): los Services dependen de esta
 * abstracción, nunca de mysql2 directamente.
 *
 * Implementaciones concretas: missions.mysql.repository.js
 */
class MissionRepositoryInterface {

  // ── MISIONES ─────────────────────────────────────────────────────────────────

  /**
   * Retorna todas las misiones visibles para el jugador.
   * @param {number} playerId
   * @returns {Promise<object[]>}
   */
  async obtenerMisionesDisponibles(playerId) { this._noImplementado('obtenerMisionesDisponibles'); }

  /**
   * Retorna detalle completo: objetivos, enemigos y sus stats.
   * @param {number} misionId
   * @returns {Promise<Mission|null>}
   */
  async obtenerDetalleMision(misionId) { this._noImplementado('obtenerDetalleMision'); }

  // ── BLOQUEO DE HÉROE (protección contra race conditions) ─────────────────────

  /**
   * Bloquea atómicamente al héroe usando SELECT … FOR UPDATE dentro de
   * una transacción SQL activa. Evita que dos requests simultáneos
   * pongan al mismo héroe en dos misiones a la vez.
   *
   * @param {number} heroeId
   * @param {object} conn  - Conexión mysql2 con transacción activa
   * @returns {Promise<{ bloqueado: boolean, heroe: object }>}
   */
  async bloquearHeroe(heroeId, conn) { this._noImplementado('bloquearHeroe'); }

  /**
   * Libera el bloqueo del héroe al finalizar la misión.
   * @param {number} heroeId
   * @param {object} conn
   */
  async liberarHeroe(heroeId, conn) { this._noImplementado('liberarHeroe'); }

  // ── MISIONES DEL JUGADOR (historial transaccional) ────────────────────────────

  /**
   * Crea un registro en player_missions con estado IN_PROGRESS.
   * @param {{ playerId, misionId, heroeId, rotaciones }} datos
   * @param {object} conn - Conexión con transacción activa
   * @returns {Promise<number>} ID del playerMission creado
   */
  async crearMisionJugador({ playerId, misionId, heroeId, rotaciones }, conn) {
    this._noImplementado('crearMisionJugador');
  }

  /**
   * Persiste el resultado final de la misión.
   * IDEMPOTENTE: si ya está en COMPLETED/FAILED, no hace nada.
   * @param {number} playerMisionId
   * @param {{ resultado: string, recompensas: object, logCombate: object[] }} datos
   * @param {object} conn
   * @returns {Promise<boolean>} true si se guardó, false si ya existía
   */
  async guardarResultado(playerMisionId, datos, conn) { this._noImplementado('guardarResultado'); }

  /**
   * Busca si el jugador ya completó esta misión antes (para detectar repeticiones).
   * @param {number} playerId
   * @param {number} misionId
   * @returns {Promise<object|null>}
   */
  async buscarComplecionPrevia(playerId, misionId) { this._noImplementado('buscarComplecionPrevia'); }

  // ── ROTACIONES ────────────────────────────────────────────────────────────────

  /**
   * Persiste las rotaciones (máx 3) asociadas a un intento de misión.
   * @param {number} playerMisionId
   * @param {object[]} rotaciones
   * @param {object} conn
   */
  async guardarRotaciones(playerMisionId, rotaciones, conn) {
    this._noImplementado('guardarRotaciones');
  }

  /**
   * Valida que todas las habilidades de las rotaciones pertenezcan al jugador.
   * @param {number} playerId
   * @param {number[]} habilidadIds
   * @returns {Promise<boolean>}
   * @throws {Error} si el jugador no posee alguna habilidad (SCRUM-35)
   */
  async validarHabilidadesRotacion(playerId, habilidadIds) {
    this._noImplementado('validarHabilidadesRotacion');
  }

  // ── INTERNO ───────────────────────────────────────────────────────────────────

  _noImplementado(metodo) {
    throw new Error(
      `MissionRepositoryInterface: el método '${metodo}' debe ser implementado por una clase concreta.`
    );
  }
}

module.exports = MissionRepositoryInterface;
