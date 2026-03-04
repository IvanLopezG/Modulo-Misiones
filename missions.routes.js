'use strict';

const { Router } = require('express');
const { validarCrearMision, validarEjecutarMision } = require('./middlewares/missions.validation');

/**
 * fabricaRutasMisiones
 *
 * Recibe el controlador ya instanciado (inyección de dependencias).
 * El router queda completamente desacoplado de la construcción del sistema.
 *
 * @param {import('./missions.controller')} controlador
 * @returns {import('express').Router}
 */
function fabricaRutasMisiones(controlador) {
  const router = Router();

  // Listar misiones disponibles para el jugador autenticado
  router.get('/',
    controlador.listarDisponibles
  );

  // Detalle completo de una misión (objetivos, enemigos, stats)
  router.get('/:misionId',
    controlador.obtenerDetalle
  );

  // Ejecutar misión: validar body → ejecutar combate → retornar resultado
  router.post('/:misionId/ejecutar',
    validarEjecutarMision,   // middleware Joi: valida heroeId y rotaciones
    controlador.ejecutar
  );

  return router;
}

module.exports = fabricaRutasMisiones;
