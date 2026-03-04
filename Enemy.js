'use strict';

const { ENEMY_TYPE } = require('../../missions.constants');

/**
 * Enemy – Entidad de dominio para enemigos de misión.
 *
 * Los stats se AUTO-CALCULAN a partir del nivel y tipo del enemigo (SCRUM-29).
 * Si se pasan stats explícitos (desde la BD), se usan directamente sin recalcular.
 *
 * Fórmula de auto-cálculo:
 *   stat = stat_base × multiplicador_tipo × (1 + (nivel - 1) × 0.15)
 *
 * Ejemplo: Jefe nivel 5 → HP = 100 × 5.0 × (1 + 4×0.15) = 100 × 5.0 × 1.6 = 800 HP
 */
class Enemy {

  // Multiplicadores de stats por tipo (se pueden ajustar para balanceo)
  static MULTIPLICADORES = Object.freeze({
    [ENEMY_TYPE.MINION]:   { hp: 1.0, atk: 1.0, def: 1.0, spd: 1.0 },
    [ENEMY_TYPE.ELITE]:    { hp: 1.8, atk: 1.5, def: 1.3, spd: 1.1 },
    [ENEMY_TYPE.MINIBOSS]: { hp: 3.0, atk: 2.0, def: 1.8, spd: 0.9 },
    [ENEMY_TYPE.BOSS]:     { hp: 5.0, atk: 3.0, def: 2.5, spd: 0.8 },
  });

  // Stats base (nivel 1, tipo MINION)
  static STATS_BASE = Object.freeze({ hp: 100, atk: 20, def: 10, spd: 15 });

  constructor({ id, nombre, nivel, tipo, stats = null }) {
    this.id     = id;
    this.nombre = nombre;
    this.nivel  = nivel;
    this.tipo   = tipo ?? ENEMY_TYPE.MINION;

    if (!Object.values(ENEMY_TYPE).includes(this.tipo)) {
      throw new Error(`Tipo de enemigo inválido: "${this.tipo}"`);
    }

    // Prioridad: stats precalculados (BD) > auto-cálculo por fórmula
    this.stats = stats ?? this._calcularStats();
  }

  /**
   * Calcula los stats del enemigo basado en nivel y tipo.
   * +15% por cada nivel adicional sobre nivel 1.
   */
  _calcularStats() {
    const mult        = Enemy.MULTIPLICADORES[this.tipo];
    const base        = Enemy.STATS_BASE;
    const escalaNivel = 1 + (this.nivel - 1) * 0.15;

    return {
      hp:  Math.round(base.hp  * mult.hp  * escalaNivel),
      atk: Math.round(base.atk * mult.atk * escalaNivel),
      def: Math.round(base.def * mult.def * escalaNivel),
      spd: Math.round(base.spd * mult.spd * escalaNivel),
    };
  }

  toJSON() {
    return {
      id:     this.id,
      nombre: this.nombre,
      nivel:  this.nivel,
      tipo:   this.tipo,
      stats:  this.stats,
    };
  }
}

module.exports = Enemy;
