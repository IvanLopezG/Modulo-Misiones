'use strict';

/**
 * missions.factory.js – Raíz de composición del módulo de misiones.
 *
 * ES EL ÚNICO LUGAR donde se instancian las clases concretas.
 * Los servicios y controladores no saben qué implementación concreta usarán.
 *
 * ¿Cómo cambiar el motor de combate sin tocar nada más?
 *   Reemplaza la línea:
 *     const motor = new CombatEngine();
 *   Por:
 *     const motor = new MotorIA({ endpoint: process.env.AI_URL });
 *   Y listo. El servicio, el controlador y las rutas no se modifican.
 *
 * @param {import('mysql2/promise').Pool} pool  – Pool compartido de db.js
 * @returns {import('express').Router}
 */
function crearModuloMisiones(pool) {

  // ── Infraestructura ───────────────────────────────────────────────────────
  const MissionsMySQLRepository = require('./infrastructure/missions.mysql.repository');
  const CombatEngine             = require('./infrastructure/CombatEngine');

  // ── Aplicación ────────────────────────────────────────────────────────────
  const MissionExecutionService = require('./application/MissionExecutionService');

  // ── Presentación ──────────────────────────────────────────────────────────
  const MissionsController    = require('./missions.controller');
  const fabricaRutasMisiones  = require('./missions.routes');

  // ── Ensamblar el grafo de dependencias ────────────────────────────────────
  const repositorio  = new MissionsMySQLRepository(pool);  // implementación MySQL
  const motor        = new CombatEngine();                   // ← cambiar aquí para otro motor
  const servicio     = new MissionExecutionService(repositorio, motor);
  const controlador  = new MissionsController(servicio);
  const router       = fabricaRutasMisiones(controlador);

  return router;
}

module.exports = crearModuloMisiones;
