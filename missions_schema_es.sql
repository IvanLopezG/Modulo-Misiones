-- ============================================================
-- THE NEXUS BATTLES V – MÓDULO DE MISIONES JvE
-- Script SQL: Creación de tablas con índices y relaciones
-- Compatible con MySQL 8+
-- ============================================================
-- Supone que ya existen: users(id), user_heroes(id, player_id),
--                        player_skills(player_id, skill_id)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── MISIONES (datos maestros) ─────────────────────────────────────────────────
-- Contiene la definición estática de cada misión disponible en el juego.
CREATE TABLE IF NOT EXISTS missions (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre           VARCHAR(100)     NOT NULL                    COMMENT 'Nombre de la misión',
  descripcion      VARCHAR(500)     DEFAULT NULL                COMMENT 'Descripción general',
  nivel            TINYINT UNSIGNED NOT NULL DEFAULT 1          COMMENT 'Nivel requerido para jugar',
  duration_seconds INT UNSIGNED     NOT NULL DEFAULT 300        COMMENT 'Duración estimada en segundos',
  status           ENUM('AVAILABLE','LOCKED','DEPRECATED')
                                    NOT NULL DEFAULT 'AVAILABLE' COMMENT 'Estado de disponibilidad',
  created_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  -- Índice compuesto para la query de misiones disponibles ordenadas por nivel
  INDEX idx_missions_status_nivel (status, nivel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Catálogo maestro de misiones JvE';


-- ── OBJETIVOS DE MISIÓN (relación 1:N) ───────────────────────────────────────
-- Cada misión puede tener entre 1 y 5 objetivos. Al menos uno debe ser PRIMARY.
CREATE TABLE IF NOT EXISTS mission_objectives (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mission_id      INT UNSIGNED NOT NULL,
  descripcion     VARCHAR(255) NOT NULL,
  tipo            ENUM('PRIMARY','SECONDARY','BONUS')
                               NOT NULL DEFAULT 'PRIMARY'  COMMENT 'SCRUM-27: PRIMARY obligatorio',
  credit_reward   SMALLINT UNSIGNED NOT NULL DEFAULT 0     COMMENT 'Créditos otorgados (0-1000)',

  PRIMARY KEY (id),
  INDEX idx_objetivo_mision (mission_id),
  CONSTRAINT fk_objetivo_mision
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Objetivos por misión (máx 5)';


-- ── ENEMIGOS DE MISIÓN (relación 1:N) ────────────────────────────────────────
-- Cada misión tiene entre 1 y 10 enemigos. Los stats se auto-calculan (SCRUM-29).
CREATE TABLE IF NOT EXISTS mission_enemies (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mission_id       INT UNSIGNED NOT NULL,
  nombre           VARCHAR(100) NOT NULL,
  nivel            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  tipo             ENUM('MINION','ELITE','MINIBOSS','BOSS')
                                NOT NULL DEFAULT 'MINION',
  -- Stats pre-calculados y cacheados al crear/editar la misión
  -- Formula: stat = base × multiplicador_tipo × (1 + (nivel-1) × 0.15)
  stats_calculated JSON         DEFAULT NULL               COMMENT 'Cache de stats auto-calculados (SCRUM-29)',

  PRIMARY KEY (id),
  INDEX idx_enemigo_mision (mission_id),
  CONSTRAINT fk_enemigo_mision
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Enemigos por misión (máx 10)';


-- ── MISIONES DEL JUGADOR (historial transaccional) ───────────────────────────
-- Registra cada intento del jugador. Incluye estado, resultado y log de combate.
-- El campo is_repeat es clave para SCRUM-45 (recompensas variables en repetición).
CREATE TABLE IF NOT EXISTS player_missions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id    INT UNSIGNED NOT NULL                           COMMENT 'Jugador que ejecutó la misión',
  mission_id   INT UNSIGNED NOT NULL                           COMMENT 'Misión ejecutada',
  hero_id      INT UNSIGNED NOT NULL                           COMMENT 'Héroe usado en este intento',
  status       ENUM('IN_PROGRESS','COMPLETED','FAILED')
               NOT NULL DEFAULT 'IN_PROGRESS',
  result       ENUM('VICTORY','DEFEAT','DRAW') DEFAULT NULL    COMMENT 'Resultado del combate',
  is_repeat    TINYINT(1) NOT NULL DEFAULT 0                   COMMENT '1 si ya fue completada antes (SCRUM-45)',
  rewards_json JSON       DEFAULT NULL                         COMMENT 'Recompensas otorgadas (con modificador)',
  combat_log   JSON       DEFAULT NULL                         COMMENT 'Log ronda a ronda del combate',
  started_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at  DATETIME   DEFAULT NULL,

  PRIMARY KEY (id),

  -- Un héroe no puede estar en dos misiones IN_PROGRESS simultáneas
  -- (refuerzo adicional a nivel DB al bloqueo FOR UPDATE del repositorio)
  UNIQUE INDEX idx_heroe_en_progreso (hero_id, status),

  INDEX idx_pm_jugador          (player_id),
  INDEX idx_pm_jugador_mision   (player_id, mission_id),  -- detección rápida de repetición (SCRUM-45)
  INDEX idx_pm_status           (status),
  INDEX idx_pm_mision           (mission_id),

  CONSTRAINT fk_pm_jugador
    FOREIGN KEY (player_id)  REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_pm_mision
    FOREIGN KEY (mission_id) REFERENCES missions(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_pm_heroe
    FOREIGN KEY (hero_id)    REFERENCES user_heroes(id)  ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Historial transaccional de intentos de misión por jugador';


-- ── ROTACIONES DEL JUGADOR (hasta 3 por intento) ─────────────────────────────
-- Persiste las habilidades seleccionadas para cada rotación. (SCRUM-35)
CREATE TABLE IF NOT EXISTS player_rotations (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_mission_id INT UNSIGNED NOT NULL                COMMENT 'Intento al que pertenece',
  priority          TINYINT UNSIGNED NOT NULL            COMMENT 'Prioridad: 1, 2 ó 3',
  skills_json       JSON         NOT NULL                COMMENT 'Arreglo de habilidades [{id, nombre, multiplicador}]',

  PRIMARY KEY (id),
  -- Una sola rotación por prioridad dentro de un intento
  UNIQUE INDEX idx_rotacion_prioridad (player_mission_id, priority),

  CONSTRAINT fk_rotacion_pm
    FOREIGN KEY (player_mission_id) REFERENCES player_missions(id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Rotaciones de habilidades por intento (máx 3)';


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- MODIFICACIÓN A TABLA EXISTENTE: user_heroes
-- Agrega el campo de bloqueo para el sistema de misiones.
-- Ejecutar solo si lock_status no existe todavía.
-- ============================================================
ALTER TABLE user_heroes
  ADD COLUMN IF NOT EXISTS lock_status
    ENUM('FREE','LOCKED') NOT NULL DEFAULT 'FREE'
    COMMENT 'FREE = disponible para misión | LOCKED = en misión activa',
  ADD INDEX IF NOT EXISTS idx_heroe_lock_status (lock_status);


-- ============================================================
-- NOTAS SOBRE MANEJO DE REPETICIONES (SCRUM-45)
-- ============================================================
-- Cómo se detecta y gestiona una misión repetida:
--
-- 1. Al crear player_missions, el repositorio ejecuta:
--      SELECT id FROM player_missions
--      WHERE player_id = ? AND mission_id = ? AND status = 'COMPLETED'
--    Si encuentra un registro → is_repeat = 1
--
-- 2. El índice idx_pm_jugador_mision hace esta consulta en O(log n).
--
-- 3. El MissionExecutionService aplica el modificador:
--      is_repeat = false → recompensa × 1.0  (100% — primera vez)
--      is_repeat = true  → recompensa × 0.5  (50% — repetición)
--
-- 4. Las recompensas ya modificadas se guardan en rewards_json,
--    por lo que el historial siempre muestra el valor real recibido.
-- ============================================================
