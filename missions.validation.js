'use strict';

const Joi = require('joi');
const { CREDITS_CONFIG, ROTATION_CONFIG, OBJECTIVE_TYPE, ENEMY_TYPE } = require('../missions.constants');

// ── Esquemas reutilizables ────────────────────────────────────────────────────

const esquemaHabilidad = Joi.object({
  id:           Joi.number().integer().positive().required(),
  nombre:       Joi.string().max(100).optional(),
  multiplicador: Joi.number().min(0.1).max(10).optional(),
});

const esquemaRotacion = Joi.object({
  prioridad:   Joi.number().integer().min(1).max(ROTATION_CONFIG.MAX_ROTACIONES).required(),
  habilidades: Joi.array().items(esquemaHabilidad).min(1).required(),
});

const esquemaObjetivo = Joi.object({
  descripcion:        Joi.string().max(255).required(),
  tipo:               Joi.string().valid(...Object.values(OBJECTIVE_TYPE)).required(),
  creditosRecompensa: Joi.number().integer()
    .min(CREDITS_CONFIG.MIN)
    .max(CREDITS_CONFIG.MAX)
    .default(0),
});

const esquemaEnemigo = Joi.object({
  nombre: Joi.string().max(100).required(),
  nivel:  Joi.number().integer().min(1).max(100).required(),
  tipo:   Joi.string().valid(...Object.values(ENEMY_TYPE)).required(),
});

// ── Esquemas públicos ─────────────────────────────────────────────────────────

/** Validación para crear una misión nueva */
const esquemaCrearMision = Joi.object({
  nombre:           Joi.string().min(3).max(100).required()
    .messages({ 'string.min': 'El nombre debe tener al menos 3 caracteres.' }),
  descripcion:      Joi.string().max(500).optional(),
  nivel:            Joi.number().integer().min(1).max(100).required(),
  duracionSegundos: Joi.number().integer().min(60).max(86400).required(),

  objetivos: Joi.array()
    .items(esquemaObjetivo)
    .min(ROTATION_CONFIG.MIN_OBJETIVOS)
    .max(ROTATION_CONFIG.MAX_OBJETIVOS)
    .required()
    .custom((objetivos, helpers) => {
      // SCRUM-27: debe haber al menos un objetivo PRIMARY
      const tienePrimario = objetivos.some(o => o.tipo === OBJECTIVE_TYPE.PRIMARY);
      if (!tienePrimario) return helpers.error('any.invalid');
      return objetivos;
    })
    .messages({
      'any.invalid': 'Se requiere al menos un objetivo de tipo PRIMARY. (SCRUM-27)',
      'array.min':   'La misión debe tener al menos un objetivo.',
      'array.max':   `La misión no puede tener más de ${ROTATION_CONFIG.MAX_OBJETIVOS} objetivos.`,
    }),

  enemigos: Joi.array()
    .items(esquemaEnemigo)
    .min(1)
    .max(ROTATION_CONFIG.MAX_ENEMIGOS)
    .required()
    .messages({
      'array.min': 'La misión debe tener al menos 1 enemigo.',
      'array.max': `La misión no puede tener más de ${ROTATION_CONFIG.MAX_ENEMIGOS} enemigos. (SCRUM-29)`,
    }),
});

/** Validación para ejecutar (iniciar) una misión */
const esquemaEjecutarMision = Joi.object({
  heroeId: Joi.number().integer().positive().required()
    .messages({ 'number.base': 'Se requiere un heroeId válido.' }),

  rotaciones: Joi.array()
    .items(esquemaRotacion)
    .min(1)
    .max(ROTATION_CONFIG.MAX_ROTACIONES)
    .required()
    .messages({
      'array.min': 'Se requiere al menos una rotación.',
      'array.max': `Se permiten máximo ${ROTATION_CONFIG.MAX_ROTACIONES} rotaciones. (SCRUM-35)`,
    }),
});

// ── Fábrica de middleware ─────────────────────────────────────────────────────

/**
 * Genera un middleware Express que valida req.body contra el esquema Joi.
 * En caso de error retorna 422 con detalle de cada campo inválido.
 */
function validar(esquema) {
  return (req, res, next) => {
    const { error, value } = esquema.validate(req.body, {
      abortEarly:    false,  // reportar todos los errores, no solo el primero
      stripUnknown:  true,   // eliminar campos no declarados en el esquema
    });

    if (error) {
      return res.status(422).json({
        estado:  'ERROR_VALIDACION',
        mensaje: 'El cuerpo de la petición no es válido.',
        errores: error.details.map(d => ({
          campo:   d.path.join('.'),
          mensaje: d.message,
        })),
      });
    }

    req.body = value; // reemplazar con valores saneados y con defaults aplicados
    next();
  };
}

module.exports = {
  validarCrearMision:   validar(esquemaCrearMision),
  validarEjecutarMision: validar(esquemaEjecutarMision),
};
