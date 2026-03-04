'use strict';

const MissionStatus = require('../value-objects/MissionStatus');
const { OBJECTIVE_TYPE, ROTATION_CONFIG } = require('../../missions.constants');

/**
 * Mission – Entidad de dominio principal.
 *
 * Contiene las reglas de negocio estructurales:
 *   - Debe tener al menos 1 objetivo de tipo PRIMARY (SCRUM-27)
 *   - Máximo 5 objetivos en total
 *   - Máximo 10 enemigos (SCRUM-29)
 *
 * Esta entidad NO sabe nada de MySQL, Express ni de ningún framework.
 */
class Mission {
  constructor({ id, nombre, descripcion, nivel, duracionSegundos, objetivos = [], enemigos = [], estado }) {
    this.id               = id;
    this.nombre           = nombre;
    this.descripcion      = descripcion;
    this.nivel            = nivel;
    this.duracionSegundos = duracionSegundos;
    this.objetivos        = objetivos;
    this.enemigos         = enemigos;
    this.estado           = estado instanceof MissionStatus
      ? estado
      : new MissionStatus(estado ?? 'AVAILABLE');

    this._validar();
  }

  _validar() {
    if (!this.nombre || this.nombre.trim() === '') {
      throw new Error('La misión debe tener un nombre.');
    }

    if (this.objetivos.length > ROTATION_CONFIG.MAX_OBJETIVOS) {
      throw new Error(`La misión no puede tener más de ${ROTATION_CONFIG.MAX_OBJETIVOS} objetivos.`);
    }

    // Regla SCRUM-27: mínimo un objetivo PRIMARY
    const tienePrimario = this.objetivos.some(o => o.tipo === OBJECTIVE_TYPE.PRIMARY);
    if (this.objetivos.length > 0 && !tienePrimario) {
      throw new Error('La misión debe incluir al menos un objetivo de tipo PRIMARY. (SCRUM-27)');
    }

    if (this.enemigos.length > ROTATION_CONFIG.MAX_ENEMIGOS) {
      throw new Error(`La misión no puede tener más de ${ROTATION_CONFIG.MAX_ENEMIGOS} enemigos. (SCRUM-29)`);
    }
  }

  /** Retorna true si la misión tiene al menos un objetivo principal */
  get tienePrimario() {
    return this.objetivos.some(o => o.tipo === OBJECTIVE_TYPE.PRIMARY);
  }

  /** Suma total de créditos de todos los objetivos */
  get totalCreditosRecompensa() {
    return this.objetivos.reduce((suma, o) => suma + (o.creditosRecompensa ?? 0), 0);
  }

  toJSON() {
    return {
      id:               this.id,
      nombre:           this.nombre,
      descripcion:      this.descripcion,
      nivel:            this.nivel,
      duracionSegundos: this.duracionSegundos,
      estado:           this.estado.valor,
      objetivos:        this.objetivos,
      enemigos:         this.enemigos,
    };
  }
}

module.exports = Mission;
