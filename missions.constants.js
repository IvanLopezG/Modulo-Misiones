'use strict';

// ─── ESTADOS DE MISIÓN ────────────────────────────────────────────────────────
const MISSION_STATUS = Object.freeze({
  AVAILABLE:   'AVAILABLE',    // Disponible para jugar
  IN_PROGRESS: 'IN_PROGRESS',  // Actualmente en ejecución
  COMPLETED:   'COMPLETED',    // Finalizada con éxito
  FAILED:      'FAILED',       // Finalizada con derrota
  LOCKED:      'LOCKED',       // Bloqueada (nivel insuficiente, etc.)
});

// ─── TIPOS DE OBJETIVO ────────────────────────────────────────────────────────
const OBJECTIVE_TYPE = Object.freeze({
  PRIMARY:   'PRIMARY',    // Objetivo principal (obligatorio para ejecutar la misión)
  SECONDARY: 'SECONDARY',  // Objetivo secundario
  BONUS:     'BONUS',      // Objetivo bonus (recompensa extra)
});

// ─── RESULTADO DE COMBATE ─────────────────────────────────────────────────────
const COMBAT_RESULT = Object.freeze({
  VICTORY: 'VICTORY', // Victoria
  DEFEAT:  'DEFEAT',  // Derrota
  DRAW:    'DRAW',    // Empate (máximo de rondas alcanzado)
});

// ─── TIPOS DE ENEMIGO ─────────────────────────────────────────────────────────
const ENEMY_TYPE = Object.freeze({
  MINION:   'MINION',    // Enemigo básico
  ELITE:    'ELITE',     // Enemigo élite (stats aumentados)
  MINIBOSS: 'MINIBOSS',  // Mini jefe
  BOSS:     'BOSS',      // Jefe final
});

// ─── ESTADO DE BLOQUEO DEL HÉROE ─────────────────────────────────────────────
const HERO_LOCK_STATUS = Object.freeze({
  FREE:   'FREE',    // Héroe disponible para iniciar misión
  LOCKED: 'LOCKED',  // Héroe en misión activa (no puede iniciar otra)
});

// ─── REGLAS DE RECOMPENSA EN REPETICIÓN (SCRUM-45) ───────────────────────────
// Las recompensas varían según si es la primera vez o una repetición
const REPEAT_REWARD_RULES = Object.freeze({
  PRIMERA_VEZ:         1.0,  // 100% de recompensas en la primera compleción
  REPETICION_BASE:     0.5,  // 50% de reducción en intentos repetidos
  REPETICION_BONUS:    0.75, // 75% si el bono diario está activo
});

// ─── CONFIGURACIÓN DE CRÉDITOS ────────────────────────────────────────────────
const CREDITS_CONFIG = Object.freeze({
  MIN: 0,
  MAX: 1000,
});

// ─── CONFIGURACIÓN DE ROTACIONES Y MISIÓN ────────────────────────────────────
const ROTATION_CONFIG = Object.freeze({
  MAX_ROTACIONES:  3,  // Máximo 3 rotaciones por misión (SCRUM-35)
  MAX_ENEMIGOS:    10, // Máximo 10 enemigos por misión (SCRUM-29)
  MAX_OBJETIVOS:   5,  // Máximo 5 objetivos por misión
  MIN_OBJETIVOS:   1,  // Mínimo 1 objetivo (debe ser PRIMARY)
});

module.exports = {
  MISSION_STATUS,
  OBJECTIVE_TYPE,
  COMBAT_RESULT,
  ENEMY_TYPE,
  HERO_LOCK_STATUS,
  REPEAT_REWARD_RULES,
  CREDITS_CONFIG,
  ROTATION_CONFIG,
};
