'use strict';

// ── Importaciones existentes (NO MODIFICAR) ───────────────────────────────────
const express = require('express');
const dotenv  = require('dotenv');
dotenv.config();

const pool = require('./backend/db'); // Pool mysql2 existente del proyecto

// ── Rutas existentes (sin cambios) ────────────────────────────────────────────
// const rutasUsuarios = require('./backend/routes/users');
// const rutasHeroes   = require('./backend/routes/heroes');

// ── MÓDULO DE MISIONES – una sola línea ensambla todo el grafo DI ─────────────
const crearModuloMisiones = require('./backend/missions/missions.factory');

const app = express();
app.use(express.json());

// ... tu middleware de autenticación, CORS, etc. ...

// Montar rutas existentes
// app.use('/api/users',  rutasUsuarios);
// app.use('/api/heroes', rutasHeroes);

// Montar el módulo de misiones
// La fábrica recibe el pool compartido y retorna un Router Express completamente configurado.
app.use('/api/missions', crearModuloMisiones(pool));
//                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^
// Endpoints resultantes:
//   GET  /api/missions                    → listar misiones disponibles
//   GET  /api/missions/:misionId          → detalle de una misión
//   POST /api/missions/:misionId/ejecutar → ejecutar misión (héroe + rotaciones)

// Middleware global de errores (debe ir al final)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    estado:  'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado en el servidor.',
  });
});

const PUERTO = process.env.PORT ?? 3000;
app.listen(PUERTO, () => {
  console.log(`🚀 The Nexus Battles V corriendo en el puerto ${PUERTO}`);
});

module.exports = app;
