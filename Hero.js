'use strict';

const { HERO_LOCK_STATUS } = require('../../missions.constants');

/**
 * Hero – Representación de dominio del héroe dentro del módulo de misiones.
 * Solo contiene lo que el módulo de misiones necesita saber del héroe.
 * No es el modelo de BD completo.
 */
class Hero {
  constructor({ id, nombre, nivel, stats, estadoBloqueo = HERO_LOCK_STATUS.FREE }) {
    this.id             = id;
    this.nombre         = nombre;
    this.nivel          = nivel;
    this.stats          = stats; // { hp, atk, def, spd, ... }
    this.estadoBloqueo  = estadoBloqueo;
  }

  /** ¿Está disponible para iniciar una misión? */
  get estaDisponible() {
    return this.estadoBloqueo === HERO_LOCK_STATUS.FREE;
  }

  /** Bloquea al héroe (se usa al iniciar una misión) */
  bloquear()  { this.estadoBloqueo = HERO_LOCK_STATUS.LOCKED; }

  /** Libera al héroe (se usa al finalizar la misión) */
  liberar()   { this.estadoBloqueo = HERO_LOCK_STATUS.FREE; }

  toJSON() {
    return {
      id:            this.id,
      nombre:        this.nombre,
      nivel:         this.nivel,
      stats:         this.stats,
      estadoBloqueo: this.estadoBloqueo,
    };
  }
}

module.exports = Hero;
