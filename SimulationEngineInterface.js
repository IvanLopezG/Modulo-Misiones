'use strict';

/**
 * SimulationEngineInterface
 *
 * Contrato para la capa de simulación de combate (patrón Strategy).
 * El MissionExecutionService invoca esta interfaz; el motor concreto
 * (CombatEngine, MotorIA, MotorML…) se inyecta en el arranque desde la fábrica.
 *
 * VENTAJA CLAVE:
 *   Cambiar el motor de simulación = modificar UNA LÍNEA en missions.factory.js.
 *   El controlador, las rutas y el servicio no se tocan.
 */
class SimulationEngineInterface {

  /**
   * Ejecuta una simulación de combate completa.
   *
   * @param {object}   heroe      - Entidad Héroe { id, stats, nivel }
   * @param {object[]} enemigos   - Arreglo de Enemigos [{ id, tipo, nivel, stats }]
   * @param {object[]} rotaciones - Rotaciones [{ prioridad, habilidades[] }]
   *
   * @returns {Promise<ResultadoSimulacion>}
   *   {
   *     resultado:      'VICTORY' | 'DEFEAT' | 'DRAW',
   *     rondas:         number,
   *     logCombate:     RondaCombate[],
   *     hpFinalHeroe:   number,
   *     recompensas:    { creditos: number, xp: number, items: string[] }
   *   }
   */
  async simular(heroe, enemigos, rotaciones) {
    this._noImplementado('simular');
  }

  /**
   * Estimación rápida de probabilidad de victoria.
   * Se usa para previsualización en UI o analíticas.
   *
   * @param {object}   heroe
   * @param {object[]} enemigos
   * @returns {Promise<number>} Valor entre 0.0 y 1.0
   */
  async estimarProbabilidadVictoria(heroe, enemigos) {
    this._noImplementado('estimarProbabilidadVictoria');
  }

  _noImplementado(metodo) {
    throw new Error(
      `SimulationEngineInterface: el método '${metodo}' debe ser implementado por una clase concreta.`
    );
  }
}

module.exports = SimulationEngineInterface;
