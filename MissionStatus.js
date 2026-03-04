'use strict';

const { MISSION_STATUS } = require('../missions.constants');

/**
 * MissionStatus – Value Object inmutable.
 *
 * Encapsula las transiciones de estado válidas para que las reglas de negocio
 * vivan en la capa de Dominio, no en los servicios ni en la base de datos.
 *
 * Ejemplo de uso:
 *   const estado = new MissionStatus('AVAILABLE');
 *   if (estado.puedeIniciar()) { ... }
 */
class MissionStatus {
  #valor; // campo privado – no modificable desde fuera

  constructor(valorRaw) {
    const valoresValidos = Object.values(MISSION_STATUS);
    if (!valoresValidos.includes(valorRaw)) {
      throw new Error(
        `MissionStatus inválido: "${valorRaw}". Valores permitidos: ${valoresValidos.join(', ')}`
      );
    }
    this.#valor = valorRaw;
  }

  get valor() { return this.#valor; }

  // ── Guardas de transición ──────────────────────────────────────────────────

  /** ¿Puede iniciar la misión desde este estado? */
  puedeIniciar() {
    return this.#valor === MISSION_STATUS.AVAILABLE;
  }

  /** ¿Puede marcarse como completada? */
  puedeCompletar() {
    return this.#valor === MISSION_STATUS.IN_PROGRESS;
  }

  /** ¿Puede marcarse como fallida? */
  puedeFallar() {
    return this.#valor === MISSION_STATUS.IN_PROGRESS;
  }

  /** ¿Puede repetirse (ya fue jugada antes)? */
  puedeRepetir() {
    return [MISSION_STATUS.COMPLETED, MISSION_STATUS.FAILED].includes(this.#valor);
  }

  // ── Fábricas de conveniencia ───────────────────────────────────────────────

  static disponible()   { return new MissionStatus(MISSION_STATUS.AVAILABLE); }
  static enProgreso()   { return new MissionStatus(MISSION_STATUS.IN_PROGRESS); }
  static completada()   { return new MissionStatus(MISSION_STATUS.COMPLETED); }
  static fallida()      { return new MissionStatus(MISSION_STATUS.FAILED); }

  /** Comparación por valor (Value Object – igualdad estructural, no referencial) */
  equals(otro) {
    return otro instanceof MissionStatus && otro.#valor === this.#valor;
  }

  toString() { return this.#valor; }
}

module.exports = MissionStatus;
