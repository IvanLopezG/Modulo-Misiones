'use strict';

const SimulationEngineInterface = require('../interfaces/SimulationEngineInterface');
const { COMBAT_RESULT, CREDITS_CONFIG } = require('../missions.constants');

/**
 * CombatEngine – Motor de combate por rondas (implementación base).
 *
 * Algoritmo:
 *  1. Cada ronda: el héroe ataca al enemigo con menor HP (estrategia de ráfaga).
 *  2. Luego, cada enemigo vivo ataca al héroe.
 *  3. La misión termina cuando todos los enemigos mueren (VICTORIA)
 *     o el héroe llega a 0 HP (DERROTA).
 *  4. Si se alcanzan las 50 rondas sin resolución → EMPATE.
 *
 * Para reemplazar este motor por uno de IA: cambiar UNA línea en missions.factory.js.
 */
class CombatEngine extends SimulationEngineInterface {

  static MAX_RONDAS  = 50;
  static DAÑO_MINIMO = 1;

  async simular(heroe, enemigos, rotaciones) {
    // Clonar stats para no mutar las entidades de dominio originales
    const estadoHeroe    = { ...heroe, hpActual: heroe.stats.hp };
    const estadoEnemigos = enemigos.map((e, i) => ({
      ...e,
      idInstancia: i,
      hpActual: e.stats.hp,
    }));

    const logCombate = [];
    let ronda        = 0;
    let indiceRot    = 0; // cicla entre las rotaciones disponibles

    while (ronda < CombatEngine.MAX_RONDAS) {
      ronda++;

      const enemigosVivos = estadoEnemigos.filter(e => e.hpActual > 0);
      if (!enemigosVivos.length || estadoHeroe.hpActual <= 0) break;

      // ── TURNO DEL HÉROE ────────────────────────────────────────────────────
      const rotacion   = rotaciones[indiceRot % rotaciones.length] ?? { habilidades: [] };
      const habilidad  = rotacion.habilidades?.[0] ?? rotacion.skills?.[0] ?? { nombre: 'Ataque Básico', multiplicador: 1.0 };
      const objetivo   = this._elegirObjetivo(enemigosVivos);
      const dañoHeroe  = this._calcularDaño(
        estadoHeroe.stats.atk,
        habilidad.multiplicador ?? habilidad.multiplier ?? 1.0,
        objetivo.stats.def
      );

      objetivo.hpActual -= dañoHeroe;
      logCombate.push({
        ronda,
        actor:    'HÉROE',
        accion:   habilidad.nombre ?? habilidad.name ?? 'Ataque',
        objetivo: objetivo.nombre ?? objetivo.name,
        daño:     dañoHeroe,
        hpObjetivo: Math.max(0, objetivo.hpActual),
      });

      indiceRot++;

      // ── TURNO DE ENEMIGOS ──────────────────────────────────────────────────
      for (const enemigo of enemigosVivos) {
        if (enemigo.hpActual <= 0 || estadoHeroe.hpActual <= 0) continue;

        const dañoEnemigo = this._calcularDaño(enemigo.stats.atk, 1.0, estadoHeroe.stats.def);
        estadoHeroe.hpActual -= dañoEnemigo;

        logCombate.push({
          ronda,
          actor:    enemigo.nombre ?? enemigo.name,
          accion:   'Ataque',
          objetivo: heroe.nombre ?? heroe.name,
          daño:     dañoEnemigo,
          hpObjetivo: Math.max(0, estadoHeroe.hpActual),
        });
      }
    }

    // ── DETERMINAR RESULTADO ───────────────────────────────────────────────
    const todosEnemigosDeadMuertos = estadoEnemigos.every(e => e.hpActual <= 0);
    const heroeMuerto              = estadoHeroe.hpActual <= 0;

    let resultado;
    if      (todosEnemigosDeadMuertos && !heroeMuerto) resultado = COMBAT_RESULT.VICTORY;
    else if (heroeMuerto)                              resultado = COMBAT_RESULT.DEFEAT;
    else                                               resultado = COMBAT_RESULT.DRAW;

    const recompensas = resultado === COMBAT_RESULT.VICTORY
      ? this._calcularRecompensas(heroe.nivel ?? heroe.level, enemigos)
      : { creditos: 0, xp: 0, items: [] };

    return {
      resultado,
      rondas:       ronda,
      logCombate,
      hpFinalHeroe: Math.max(0, estadoHeroe.hpActual),
      recompensas,
      // Alias en inglés para compatibilidad con la interfaz
      result:       resultado,
      rewards:      recompensas,
    };
  }

  async estimarProbabilidadVictoria(heroe, enemigos) {
    const poderHeroe   = heroe.stats.hp + heroe.stats.atk * 2 + heroe.stats.def;
    const poderEnemigo = enemigos.reduce(
      (suma, e) => suma + e.stats.hp + e.stats.atk + e.stats.def, 0
    );
    const raw = poderHeroe / (poderHeroe + poderEnemigo);
    return Math.min(1, Math.max(0, raw));
  }

  // ── PRIVADOS ──────────────────────────────────────────────────────────────

  _calcularDaño(atk, multiplicador, def) {
    return Math.max(CombatEngine.DAÑO_MINIMO, Math.round(atk * multiplicador - def));
  }

  /** Estrategia de targeting: atacar al enemigo con menos HP primero */
  _elegirObjetivo(enemigosVivos) {
    return enemigosVivos.reduce((menor, e) => e.hpActual < menor.hpActual ? e : menor);
  }

  _calcularRecompensas(nivelHeroe, enemigos) {
    const creditosBase = enemigos.reduce((s, e) => s + (e.nivel ?? e.level) * 10, 0);
    const creditos     = Math.min(CREDITS_CONFIG.MAX, Math.max(CREDITS_CONFIG.MIN, creditosBase));
    const xp           = enemigos.reduce((s, e) => s + (e.nivel ?? e.level) * 20, 0);
    return { creditos, xp, items: [] };
  }
}

module.exports = CombatEngine;
