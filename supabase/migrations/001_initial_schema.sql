-- =============================================================
-- SISTEMA ACADÉMICO ENS N°9 — Migración inicial
-- Escuela Normal Superior N°9 Juan XXIII, Wanda, Misiones
-- =============================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE app_role AS ENUM ('admin', 'directivo', 'preceptor', 'docente');
CREATE TYPE teacher_status AS ENUM ('pending_registration', 'pending_approval', 'active', 'inactive');
CREATE TYPE student_status AS ENUM ('active', 'graduated', 'transferred', 'dropped', 'pending_docs');
CREATE TYPE shift AS ENUM ('M', 'T', 'N');  -- Mañana, Tarde, Noche
CREATE TYPE grading_period_code AS ENUM ('T1', 'T2', 'T3', 'FINAL', 'RECOVERY');
CREATE TYPE period_status AS ENUM ('open', 'under_review', 'closed', 'reopened');
CREATE TYPE grade_status AS ENUM ('draft', 'confirmed', 'under_review', 'closed', 'reopened');
CREATE TYPE movement_type AS ENUM (
  'enrollment', 'reenrollment', 'modality_change', 'orientation_change',
  'course_change', 'division_change', 'shift_change', 'transfer_out',
  'withdrawal', 'graduation'
);
CREATE TYPE subject_condition AS ENUM (
  'approved', 'failed', 'pending', 'prior', 'equivalency',
  'exempted', 'in_progress', 'absent'
);
CREATE TYPE exam_session_type AS ENUM ('prior', 'equivalency', 'complementary', 'regularization', 'special');
CREATE TYPE exam_session_status AS ENUM ('draft', 'open', 'closed', 'validated');
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');

-- =============================================================
-- PERFILES Y ROLES
-- =============================================================

-- Profiles (extension de auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles de usuario
CREATE TABLE user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        app_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- =============================================================
-- ESTRUCTURA ACADÉMICA
-- =============================================================

-- Ciclos lectivos
CREATE TABLE academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

-- Garantizar un solo ciclo activo
CREATE UNIQUE INDEX idx_academic_years_current ON academic_years (is_current) WHERE is_current = TRUE;

-- Modalidades
CREATE TABLE modalities (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code      TEXT NOT NULL UNIQUE,  -- COMUN, TECNICA
  name      TEXT NOT NULL,
  max_year  INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orientaciones / trayectos dentro de modalidades
CREATE TABLE orientations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id  UUID NOT NULL REFERENCES modalities(id),
  code         TEXT NOT NULL,  -- CBC, SOCIALES, NATURALES, GTAO
  name         TEXT NOT NULL,
  min_year     INTEGER NOT NULL DEFAULT 1,
  max_year     INTEGER NOT NULL DEFAULT 5,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(modality_id, code)
);

-- Materias / asignaturas
CREATE TABLE subjects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  normalized_name  TEXT NOT NULL,  -- nombre normalizado para búsquedas
  orientation_id   UUID REFERENCES orientations(id),
  modality_id      UUID REFERENCES modalities(id),
  year_level       INTEGER,
  hours_per_week   NUMERIC(4,1),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subjects_orientation ON subjects (orientation_id);
CREATE INDEX idx_subjects_modality ON subjects (modality_id);
CREATE INDEX idx_subjects_year ON subjects (year_level);
CREATE INDEX idx_subjects_normalized ON subjects (normalized_name);

-- =============================================================
-- DOCENTES
-- =============================================================

CREATE TABLE teachers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dni               TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  status            teacher_status NOT NULL DEFAULT 'pending_registration',
  registration_code TEXT UNIQUE,  -- código de invitación
  import_source     TEXT,         -- nombre del archivo fuente
  planta_cupof      TEXT[],       -- códigos CUPOF de planta funcional
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_teachers_user_id ON teachers (user_id);
CREATE INDEX idx_teachers_dni ON teachers (dni);
CREATE INDEX idx_teachers_status ON teachers (status);

-- =============================================================
-- PRECEPTORES
-- =============================================================

CREATE TABLE preceptors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dni        TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================================
-- ESTUDIANTES
-- =============================================================

CREATE TABLE students (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni              TEXT NOT NULL UNIQUE,
  full_name        TEXT NOT NULL,
  birth_date       DATE,
  birth_place      TEXT,
  address          TEXT,
  phone            TEXT,
  email            TEXT,
  enrollment_date  DATE,
  previous_school  TEXT,
  status           student_status NOT NULL DEFAULT 'active',
  notes            TEXT,
  import_source    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_students_dni ON students (dni);
CREATE INDEX idx_students_full_name ON students (full_name);
CREATE INDEX idx_students_status ON students (status);

-- Tutores / responsables
CREATE TABLE student_guardians (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  relationship TEXT,  -- padre, madre, tutor legal, etc.
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SECCIONES / DIVISIONES
-- =============================================================

-- Combinación: ciclo lectivo + modalidad + orientación + año + división + turno
CREATE TABLE course_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  modality_id      UUID NOT NULL REFERENCES modalities(id),
  orientation_id   UUID REFERENCES orientations(id),
  year_level       INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 6),
  division         TEXT NOT NULL CHECK (LENGTH(division) = 1),
  shift            shift NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id),
  UNIQUE(academic_year_id, year_level, division, shift, modality_id)
);

CREATE INDEX idx_sections_year_id ON course_sections (academic_year_id);
CREATE INDEX idx_sections_modality ON course_sections (modality_id);
CREATE INDEX idx_sections_orientation ON course_sections (orientation_id);

-- Asignaciones de docentes a secciones+materias
CREATE TABLE teacher_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         UUID NOT NULL REFERENCES teachers(id),
  course_section_id  UUID NOT NULL REFERENCES course_sections(id),
  subject_id         UUID NOT NULL REFERENCES subjects(id),
  academic_year_id   UUID NOT NULL REFERENCES academic_years(id),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES auth.users(id),
  UNIQUE(teacher_id, course_section_id, subject_id, academic_year_id)
);

CREATE INDEX idx_ta_teacher ON teacher_assignments (teacher_id);
CREATE INDEX idx_ta_section ON teacher_assignments (course_section_id);
CREATE INDEX idx_ta_subject ON teacher_assignments (subject_id);
CREATE INDEX idx_ta_year ON teacher_assignments (academic_year_id);

-- Asignaciones de preceptores a secciones
CREATE TABLE preceptor_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preceptor_id       UUID NOT NULL REFERENCES preceptors(id),
  course_section_id  UUID NOT NULL REFERENCES course_sections(id),
  academic_year_id   UUID NOT NULL REFERENCES academic_years(id),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES auth.users(id),
  UNIQUE(preceptor_id, course_section_id, academic_year_id)
);

-- Matrículas (alumno inscripto en una sección)
CREATE TABLE student_enrollments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id),
  course_section_id  UUID NOT NULL REFERENCES course_sections(id),
  academic_year_id   UUID NOT NULL REFERENCES academic_years(id),
  enrollment_number  INTEGER,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES auth.users(id),
  UNIQUE(student_id, course_section_id, academic_year_id)
);

CREATE INDEX idx_se_student ON student_enrollments (student_id);
CREATE INDEX idx_se_section ON student_enrollments (course_section_id);
CREATE INDEX idx_se_year ON student_enrollments (academic_year_id);

-- =============================================================
-- PERÍODOS DE EVALUACIÓN Y CALIFICACIONES
-- =============================================================

CREATE TABLE grading_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  name             TEXT NOT NULL,
  code             grading_period_code NOT NULL,
  order_index      INTEGER NOT NULL,
  open_date        DATE,
  close_date       DATE,
  status           period_status NOT NULL DEFAULT 'open',
  closed_by        UUID REFERENCES auth.users(id),
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id),
  UNIQUE(academic_year_id, code)
);

CREATE INDEX idx_gp_year ON grading_periods (academic_year_id);
CREATE INDEX idx_gp_status ON grading_periods (status);

-- Calificaciones
CREATE TABLE grades (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_enrollment_id UUID NOT NULL REFERENCES student_enrollments(id),
  subject_id            UUID NOT NULL REFERENCES subjects(id),
  grading_period_id     UUID NOT NULL REFERENCES grading_periods(id),
  teacher_assignment_id UUID NOT NULL REFERENCES teacher_assignments(id),
  score                 NUMERIC(4,2) CHECK (score IS NULL OR (score >= 1 AND score <= 10)),
  observation           TEXT,
  status                grade_status NOT NULL DEFAULT 'draft',
  submitted_at          TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  UNIQUE(student_enrollment_id, subject_id, grading_period_id)
);

CREATE INDEX idx_grades_enrollment ON grades (student_enrollment_id);
CREATE INDEX idx_grades_subject ON grades (subject_id);
CREATE INDEX idx_grades_period ON grades (grading_period_id);
CREATE INDEX idx_grades_status ON grades (status);

-- Historial de cambios de calificaciones
CREATE TABLE grade_change_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id      UUID NOT NULL REFERENCES grades(id),
  old_score     NUMERIC(4,2),
  new_score     NUMERIC(4,2),
  old_status    grade_status,
  new_status    grade_status,
  changed_by    UUID NOT NULL REFERENCES auth.users(id),
  reason        TEXT,
  period_was_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gcl_grade ON grade_change_logs (grade_id);

-- Solicitudes de reapertura de período
CREATE TABLE reopening_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grading_period_id UUID NOT NULL REFERENCES grading_periods(id),
  requested_by      UUID NOT NULL REFERENCES auth.users(id),
  authorized_by     UUID REFERENCES auth.users(id),
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  authorized_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- LIBRO MATRIZ DIGITAL
-- =============================================================

-- Registro académico por ciclo lectivo (una fila por alumno por año)
CREATE TABLE student_academic_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id),
  academic_year_id   UUID NOT NULL REFERENCES academic_years(id),
  course_section_id  UUID NOT NULL REFERENCES course_sections(id),
  modality_id        UUID NOT NULL REFERENCES modalities(id),
  orientation_id     UUID REFERENCES orientations(id),
  year_level         INTEGER NOT NULL,
  division           TEXT NOT NULL,
  shift              shift NOT NULL,
  promoted           BOOLEAN,  -- ¿Promovió al año siguiente?
  final_condition    subject_condition,
  observations       TEXT,
  closed_at          TIMESTAMPTZ,
  closed_by          UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id)
);

CREATE INDEX idx_sar_student ON student_academic_records (student_id);
CREATE INDEX idx_sar_year ON student_academic_records (academic_year_id);

-- Estado por materia en el registro académico
CREATE TABLE student_record_subjects (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_academic_record_id  UUID NOT NULL REFERENCES student_academic_records(id) ON DELETE CASCADE,
  subject_id                  UUID NOT NULL REFERENCES subjects(id),
  score_t1                    NUMERIC(4,2),
  score_t2                    NUMERIC(4,2),
  score_t3                    NUMERIC(4,2),
  score_final                 NUMERIC(4,2),
  score_recovery              NUMERIC(4,2),
  condition                   subject_condition NOT NULL DEFAULT 'in_progress',
  observations                TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_academic_record_id, subject_id)
);

-- Movimientos institucionales del estudiante
CREATE TABLE student_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id),
  academic_year_id UUID REFERENCES academic_years(id),
  movement_type    movement_type NOT NULL,
  previous_state   JSONB,  -- modalidad, orientación, curso, división, turno anteriores
  new_state        JSONB,  -- nueva situación
  reason           TEXT,
  document_ref     TEXT,   -- referencia a documentación
  observations     TEXT,
  registered_by    UUID NOT NULL REFERENCES auth.users(id),
  movement_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sm_student ON student_movements (student_id);
CREATE INDEX idx_sm_date ON student_movements (movement_date);

-- =============================================================
-- MATERIAS PREVIAS Y EQUIVALENCIAS
-- =============================================================

CREATE TABLE pending_subjects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id),
  subject_id       UUID NOT NULL REFERENCES subjects(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),  -- año en que quedó pendiente
  year_level       INTEGER NOT NULL,
  modality_id      UUID REFERENCES modalities(id),
  orientation_id   UUID REFERENCES orientations(id),
  condition        subject_condition NOT NULL DEFAULT 'pending',
  exam_date        DATE,
  score            NUMERIC(4,2),
  teacher_id       UUID REFERENCES teachers(id),
  observations     TEXT,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ps_student ON pending_subjects (student_id);

CREATE TABLE equivalencies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id),
  subject_id         UUID NOT NULL REFERENCES subjects(id),
  origin_school      TEXT NOT NULL,
  origin_subject     TEXT,
  year_level         INTEGER,
  modality_id        UUID REFERENCES modalities(id),
  orientation_id     UUID REFERENCES orientations(id),
  exam_date          DATE,
  teacher_id         UUID REFERENCES teachers(id),
  score              NUMERIC(4,2),
  condition          subject_condition NOT NULL DEFAULT 'pending',
  document_ref       TEXT,
  observations       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES auth.users(id)
);

-- =============================================================
-- MESAS DE EXAMEN
-- =============================================================

CREATE TABLE exam_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  session_type     exam_session_type NOT NULL,
  subject_id       UUID NOT NULL REFERENCES subjects(id),
  course_section_id UUID REFERENCES course_sections(id),
  exam_date        DATE NOT NULL,
  shift            shift,
  teacher_id       UUID REFERENCES teachers(id),
  tribunal_members TEXT[],
  status           exam_session_status NOT NULL DEFAULT 'draft',
  observations     TEXT,
  closed_at        TIMESTAMPTZ,
  closed_by        UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_es_year ON exam_sessions (academic_year_id);
CREATE INDEX idx_es_subject ON exam_sessions (subject_id);
CREATE INDEX idx_es_date ON exam_sessions (exam_date);

CREATE TABLE exam_session_students (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id  UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id),
  condition_type   exam_session_type NOT NULL,
  score            NUMERIC(4,2),
  result           subject_condition,
  observations     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_session_id, student_id)
);

CREATE INDEX idx_ess_session ON exam_session_students (exam_session_id);
CREATE INDEX idx_ess_student ON exam_session_students (student_id);

-- =============================================================
-- IMPORTACIONES
-- =============================================================

CREATE TABLE import_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  import_type   TEXT NOT NULL,  -- students, teachers, assignments, etc.
  status        import_status NOT NULL DEFAULT 'pending',
  total_rows    INTEGER,
  imported_rows INTEGER,
  error_rows    INTEGER,
  warnings      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES auth.users(id)
);

CREATE TABLE import_errors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id  UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number       INTEGER,
  field_name       TEXT,
  raw_value        TEXT,
  error_message    TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ie_batch ON import_errors (import_batch_id);

-- =============================================================
-- AUDITORÍA
-- =============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  old_value   JSONB,
  new_value   JSONB,
  reason      TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_al_user ON audit_logs (user_id);
CREATE INDEX idx_al_table ON audit_logs (table_name);
CREATE INDEX idx_al_created ON audit_logs (created_at DESC);

-- =============================================================
-- NOTIFICACIONES
-- =============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,  -- info, warning, error, success
  read_at     TIMESTAMPTZ,
  action_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications (user_id, read_at);
