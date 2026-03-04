'use strict';

/**
 * MissionsController – Capa de presentación HTTP.
 *
 * Responsabilidad ÚNICA: traducir entre HTTP y la capa de aplicación.
 * CERO lógica de negocio aquí. Todo se delega al MissionExecutionService.
 *
 * Errores de dominio (SCRUM-xx) → 400 Bad Request
 * Errores inesperados           → 500 (manejado por el middleware de errores global)
 */
class MissionsController {

  /** @param {import('./application/MissionExecutionService')} servicio */
  constructor(servicio) {
    this._servicio = servicio;
  }

  // GET /api/missions
  // Lista todas las misiones disponibles para el jugador autenticado
  listarDisponibles = async (req, res, next) => {
    try {
      const { playerId } = req.user; // req.user lo setea el middleware de autenticación
      const misiones = await this._servicio.listarDisponibles(playerId);
      res.json({ estado: 'OK', datos: misiones });
    } catch (err) { next(err); }
  };

  // GET /api/missions/:misionId
  // Detalle completo: objetivos, enemigos con stats calculados
  obtenerDetalle = async (req, res, next) => {
    try {
      const mision = await this._servicio.obtenerDetalle(Number(req.params.misionId));
      res.json({ estado: 'OK', datos: mision });
    } catch (err) { next(err); }
  };

  // POST /api/missions/:misionId/ejecutar
  // Inicia y ejecuta una misión completa
  ejecutar = async (req, res, next) => {
    try {
      const { playerId }            = req.user;
      const { misionId }            = req.params;
      const { heroeId, rotaciones } = req.body;

      const resultado = await this._servicio.ejecutarMision({
        playerId,
        misionId:   Number(misionId),
        heroeId,
        rotaciones,
      });

      res.status(200).json({ estado: 'OK', datos: resultado });

    } catch (err) {
      // Errores de negocio conocidos → 400, no 500
      const esErrorNegocio = err.message.includes('SCRUM')
        || err.message.includes('ya está participando')
        || err.message.includes('no encontrada')
        || err.message.includes('PRIMARY')
        || err.message.includes('no posee');

      if (esErrorNegocio) {
        return res.status(400).json({ estado: 'ERROR_NEGOCIO', mensaje: err.message });
      }
      next(err);
    }
  };
}

module.exports = MissionsController;
