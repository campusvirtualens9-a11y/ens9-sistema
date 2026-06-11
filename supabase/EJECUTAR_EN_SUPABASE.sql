-- =============================================================
-- SISTEMA ACADÉMICO ENS N°9 — Migración inicial
-- Escuela Normal Superior N°9 Juan XXIII, Wanda, Misiones
-- =============================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

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
-- =============================================================
-- FUNCIONES Y TRIGGERS — Sistema Académico ENS N°9
-- =============================================================

-- =============================================================
-- Función: crear perfil automáticamente al registrarse
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_teacher teachers%ROWTYPE;
  v_dni TEXT;
  v_inv_code TEXT;
BEGIN
  -- Crear perfil
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Asignar rol docente por defecto si viene con metadata de registro docente
  IF NEW.raw_user_meta_data->>'role' = 'docente' THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'docente');

    -- Intentar vincular con padrón docente por DNI
    v_dni := NULLIF(TRIM(NEW.raw_user_meta_data->>'dni'), '');
    v_inv_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'invitation_code'), '');

    IF v_dni IS NOT NULL THEN
      SELECT * INTO v_teacher
      FROM teachers
      WHERE dni = v_dni
        AND status IN ('pending_registration', 'pending_approval')
      LIMIT 1;

      IF v_teacher.id IS NOT NULL THEN
        -- Vincular automáticamente
        UPDATE teachers SET
          user_id = NEW.id,
          email = COALESCE(email, NEW.email),
          status = 'active',
          updated_at = NOW()
        WHERE id = v_teacher.id;

        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
        VALUES (NEW.id, 'teacher_auto_linked', 'teachers', v_teacher.id::text,
          jsonb_build_object('dni', v_dni, 'email', NEW.email, 'method', 'dni_match'));
      ELSIF v_inv_code IS NOT NULL THEN
        -- Intentar por código de invitación
        SELECT * INTO v_teacher
        FROM teachers
        WHERE registration_code = v_inv_code
          AND status IN ('pending_registration', 'pending_approval')
        LIMIT 1;

        IF v_teacher.id IS NOT NULL THEN
          UPDATE teachers SET
            user_id = NEW.id,
            email = COALESCE(email, NEW.email),
            status = 'active',
            updated_at = NOW()
          WHERE id = v_teacher.id;

          INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
          VALUES (NEW.id, 'teacher_auto_linked', 'teachers', v_teacher.id::text,
            jsonb_build_object('code', v_inv_code, 'email', NEW.email, 'method', 'invitation_code'));
        ELSE
          -- Sin coincidencia: queda pendiente de aprobación manual
          INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
          VALUES (NEW.id, 'teacher_registration_pending', 'teachers', NULL,
            jsonb_build_object('dni', v_dni, 'email', NEW.email, 'code', v_inv_code));
        END IF;
      ELSE
        -- Sin DNI ni código: pendiente de aprobación manual
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
        VALUES (NEW.id, 'teacher_registration_pending', 'teachers', NULL,
          jsonb_build_object('email', NEW.email, 'full_name', NEW.raw_user_meta_data->>'full_name'));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- Función: updated_at automático
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Aplicar a todas las tablas con updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles', 'teachers', 'students', 'subjects',
    'student_academic_records', 'student_record_subjects',
    'pending_subjects', 'equivalencies', 'exam_session_students'
  ])
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_set_updated_at_%s
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl, tbl);
  END LOOP;
END;
$$;

-- =============================================================
-- Función: obtener rol del usuario
-- =============================================================
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

-- =============================================================
-- Función: verificar si el usuario puede editar una nota
-- =============================================================
CREATE OR REPLACE FUNCTION can_edit_grade(
  p_user_id UUID,
  p_grade_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_role app_role;
  v_teacher_id UUID;
  v_period_status period_status;
  v_grade_status grade_status;
BEGIN
  -- Obtener rol
  v_role := get_user_role(p_user_id);

  -- Admin siempre puede (con registro en auditoría)
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Verificar estado del período y de la nota
  SELECT gp.status, g.status INTO v_period_status, v_grade_status
  FROM grades g
  JOIN grading_periods gp ON g.grading_period_id = gp.id
  WHERE g.id = p_grade_id;

  -- Período cerrado → nadie puede editar sin reapertura
  IF v_period_status IN ('closed') THEN
    RETURN FALSE;
  END IF;

  -- Si es docente, verificar que sea el docente asignado
  IF v_role = 'docente' THEN
    SELECT ta.teacher_id INTO v_teacher_id
    FROM grades g
    JOIN teacher_assignments ta ON g.teacher_assignment_id = ta.id
    JOIN teachers t ON ta.teacher_id = t.id
    WHERE g.id = p_grade_id AND t.user_id = p_user_id;

    RETURN v_teacher_id IS NOT NULL;
  END IF;

  RETURN FALSE;
END;
$$;

-- =============================================================
-- Trigger: auditar cambios en calificaciones
-- =============================================================
CREATE OR REPLACE FUNCTION audit_grade_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_status period_status;
BEGIN
  -- Solo auditar si cambió score o status
  IF OLD.score IS DISTINCT FROM NEW.score OR OLD.status IS DISTINCT FROM NEW.status THEN

    SELECT status INTO v_period_status
    FROM grading_periods WHERE id = NEW.grading_period_id;

    INSERT INTO grade_change_logs (
      grade_id, old_score, new_score, old_status, new_status,
      changed_by, period_was_closed
    ) VALUES (
      NEW.id, OLD.score, NEW.score, OLD.status, NEW.status,
      COALESCE(NEW.updated_by, NEW.created_by),
      v_period_status IN ('closed', 'under_review')
    );

    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (
      COALESCE(NEW.updated_by, NEW.created_by),
      'grade_updated',
      'grades',
      NEW.id::text,
      jsonb_build_object('score', OLD.score, 'status', OLD.status),
      jsonb_build_object('score', NEW.score, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_grade_change
  AFTER UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION audit_grade_change();

-- =============================================================
-- Trigger: bloquear edición de notas cuando el período está cerrado
-- =============================================================
CREATE OR REPLACE FUNCTION prevent_grade_edit_when_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_status period_status;
  v_user_role app_role;
BEGIN
  SELECT status INTO v_period_status
  FROM grading_periods WHERE id = NEW.grading_period_id;

  -- Si el período está cerrado, bloquear cualquier edición excepto admin
  IF v_period_status = 'closed' THEN
    v_user_role := get_user_role(COALESCE(NEW.updated_by, NEW.created_by));
    IF v_user_role != 'admin' THEN
      RAISE EXCEPTION 'El período de evaluación está cerrado. No se pueden modificar calificaciones sin autorización.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_closed_grade_edit
  BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION prevent_grade_edit_when_closed();

-- =============================================================
-- Función: solo un ciclo lectivo activo a la vez
-- =============================================================
CREATE OR REPLACE FUNCTION ensure_single_current_year()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE academic_years
    SET is_current = FALSE
    WHERE id != NEW.id AND is_current = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_current_year
  BEFORE INSERT OR UPDATE ON academic_years
  FOR EACH ROW WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION ensure_single_current_year();

-- =============================================================
-- Vista: secciones con información completa
-- =============================================================
CREATE OR REPLACE VIEW v_course_sections AS
SELECT
  cs.id,
  ay.year AS academic_year,
  ay.label AS academic_year_label,
  ay.is_current,
  m.code AS modality_code,
  m.name AS modality_name,
  o.code AS orientation_code,
  o.name AS orientation_name,
  cs.year_level,
  cs.division,
  cs.shift,
  cs.is_active,
  CONCAT(cs.year_level, '° ', cs.division, ' (', cs.shift, ')') AS display_name,
  CONCAT(m.code, ' - ', cs.year_level, '° ', cs.division) AS short_name
FROM course_sections cs
JOIN academic_years ay ON cs.academic_year_id = ay.id
JOIN modalities m ON cs.modality_id = m.id
LEFT JOIN orientations o ON cs.orientation_id = o.id;

-- =============================================================
-- Vista: calificaciones con información completa
-- =============================================================
CREATE OR REPLACE VIEW v_grades_full AS
SELECT
  g.id,
  g.score,
  g.observation,
  g.status,
  g.submitted_at,
  g.confirmed_at,
  g.created_at,
  g.updated_at,
  -- Estudiante
  s.id AS student_id,
  s.full_name AS student_name,
  s.dni AS student_dni,
  -- Materia
  sub.id AS subject_id,
  sub.name AS subject_name,
  -- Período
  gp.id AS period_id,
  gp.name AS period_name,
  gp.code AS period_code,
  gp.status AS period_status,
  -- Sección
  cs.year_level,
  cs.division,
  cs.shift,
  -- Año académico
  ay.year AS academic_year,
  -- Docente
  t.full_name AS teacher_name
FROM grades g
JOIN student_enrollments se ON g.student_enrollment_id = se.id
JOIN students s ON se.student_id = s.id
JOIN subjects sub ON g.subject_id = sub.id
JOIN grading_periods gp ON g.grading_period_id = gp.id
JOIN teacher_assignments ta ON g.teacher_assignment_id = ta.id
JOIN teachers t ON ta.teacher_id = t.id
JOIN course_sections cs ON se.course_section_id = cs.id
JOIN academic_years ay ON cs.academic_year_id = ay.id;
-- RLS Policies — Sistema Académico ENS N°9

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE orientations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE preceptors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE preceptor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reopening_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_record_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE equivalencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_session_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION auth_is_directivo_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','directivo'));
$$;

CREATE OR REPLACE FUNCTION auth_is_preceptor_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','directivo','preceptor'));
$$;

CREATE OR REPLACE FUNCTION auth_teacher_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM teachers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Profiles
CREATE POLICY "own_profile" ON profiles FOR SELECT USING (id = auth.uid() OR auth_is_directivo_or_above());
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "insert_profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid() OR auth_is_admin());

-- User roles
CREATE POLICY "admin_manages_roles" ON user_roles FOR ALL USING (auth_is_admin());
CREATE POLICY "see_own_role" ON user_roles FOR SELECT USING (user_id = auth.uid());

-- Catalog tables
CREATE POLICY "read_years" ON academic_years FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_years" ON academic_years FOR ALL USING (auth_is_admin());
CREATE POLICY "read_modalities" ON modalities FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_modalities" ON modalities FOR ALL USING (auth_is_admin());
CREATE POLICY "read_orientations" ON orientations FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_orientations" ON orientations FOR ALL USING (auth_is_admin());
CREATE POLICY "read_subjects" ON subjects FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_subjects" ON subjects FOR ALL USING (auth_is_admin());

-- Teachers
CREATE POLICY "directivo_sees_teachers" ON teachers FOR SELECT USING (auth_is_directivo_or_above() OR user_id = auth.uid());
CREATE POLICY "admin_manages_teachers" ON teachers FOR ALL USING (auth_is_admin());
CREATE POLICY "teacher_updates_own" ON teachers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Preceptors
CREATE POLICY "preceptor_above_sees" ON preceptors FOR SELECT USING (auth_is_preceptor_or_above() OR user_id = auth.uid());
CREATE POLICY "admin_manages_preceptors" ON preceptors FOR ALL USING (auth_is_admin());

-- Students
CREATE POLICY "preceptor_above_sees_students" ON students FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "teacher_sees_enrolled_students" ON students FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN student_enrollments se ON se.course_section_id = ta.course_section_id
    JOIN teachers t ON ta.teacher_id = t.id
    WHERE t.user_id = auth.uid() AND se.student_id = students.id
  )
);
CREATE POLICY "admin_manages_students" ON students FOR ALL USING (auth_is_admin());
CREATE POLICY "preceptor_updates_students" ON students FOR UPDATE USING (auth_is_preceptor_or_above());
CREATE POLICY "preceptor_sees_guardians" ON student_guardians FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_guardians" ON student_guardians FOR ALL USING (auth_is_admin());

-- Course sections
CREATE POLICY "all_read_sections" ON course_sections FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admin_manages_sections" ON course_sections FOR ALL USING (auth_is_admin());

-- Teacher assignments
CREATE POLICY "teacher_sees_own_assignments" ON teacher_assignments FOR SELECT
  USING (teacher_id = auth_teacher_id() OR auth_is_directivo_or_above());
CREATE POLICY "admin_manages_ta" ON teacher_assignments FOR ALL USING (auth_is_admin());

-- Preceptor assignments
CREATE POLICY "preceptor_sees_own" ON preceptor_assignments FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_pa" ON preceptor_assignments FOR ALL USING (auth_is_admin());

-- Student enrollments
CREATE POLICY "preceptor_above_sees_enrollments" ON student_enrollments FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "teacher_sees_section_enrollments" ON student_enrollments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN teachers t ON ta.teacher_id = t.id
    WHERE t.user_id = auth.uid() AND ta.course_section_id = student_enrollments.course_section_id
  )
);
CREATE POLICY "admin_manages_enrollments" ON student_enrollments FOR ALL USING (auth_is_admin());

-- Grading periods
CREATE POLICY "all_read_periods" ON grading_periods FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "directivo_manages_periods" ON grading_periods FOR ALL USING (auth_is_directivo_or_above());

-- Grades
CREATE POLICY "teacher_sees_own_grades" ON grades FOR SELECT USING (
  teacher_assignment_id IN (
    SELECT ta.id FROM teacher_assignments ta JOIN teachers t ON ta.teacher_id=t.id WHERE t.user_id=auth.uid()
  ) OR auth_is_preceptor_or_above()
);
CREATE POLICY "teacher_inserts_grades" ON grades FOR INSERT WITH CHECK (
  teacher_assignment_id IN (
    SELECT ta.id FROM teacher_assignments ta JOIN teachers t ON ta.teacher_id=t.id WHERE t.user_id=auth.uid()
  ) AND created_by = auth.uid()
);
CREATE POLICY "teacher_updates_own_grades" ON grades FOR UPDATE USING (
  teacher_assignment_id IN (
    SELECT ta.id FROM teacher_assignments ta JOIN teachers t ON ta.teacher_id=t.id WHERE t.user_id=auth.uid()
  )
);
CREATE POLICY "admin_manages_all_grades" ON grades FOR ALL USING (auth_is_admin());

-- Grade logs
CREATE POLICY "directivo_sees_logs" ON grade_change_logs FOR SELECT USING (auth_is_directivo_or_above());
CREATE POLICY "system_inserts_logs" ON grade_change_logs FOR INSERT WITH CHECK (TRUE);

-- Reopening requests
CREATE POLICY "teachers_create_reopen" ON reopening_requests FOR INSERT WITH CHECK (requested_by = auth.uid());
CREATE POLICY "directivo_manages_reopen" ON reopening_requests FOR ALL USING (auth_is_directivo_or_above());
CREATE POLICY "teachers_see_own_reopen" ON reopening_requests FOR SELECT USING (requested_by = auth.uid());

-- Libro Matriz
CREATE POLICY "preceptor_sees_records" ON student_academic_records FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_records" ON student_academic_records FOR ALL USING (auth_is_admin());
CREATE POLICY "preceptor_sees_record_subjects" ON student_record_subjects FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_record_subjects" ON student_record_subjects FOR ALL USING (auth_is_admin());

-- Movements
CREATE POLICY "preceptor_sees_movements" ON student_movements FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "preceptor_creates_movements" ON student_movements FOR INSERT
  WITH CHECK (auth_is_preceptor_or_above() AND registered_by = auth.uid());
CREATE POLICY "admin_manages_movements" ON student_movements FOR ALL USING (auth_is_admin());

-- Previas y equivalencias
CREATE POLICY "preceptor_sees_pending" ON pending_subjects FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_pending" ON pending_subjects FOR ALL USING (auth_is_admin());
CREATE POLICY "preceptor_sees_equiv" ON equivalencies FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_equiv" ON equivalencies FOR ALL USING (auth_is_admin());

-- Mesas de examen
CREATE POLICY "preceptor_sees_exams" ON exam_sessions FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_exams" ON exam_sessions FOR ALL USING (auth_is_admin());
CREATE POLICY "preceptor_sees_exam_students" ON exam_session_students FOR SELECT USING (auth_is_preceptor_or_above());
CREATE POLICY "admin_manages_exam_students" ON exam_session_students FOR ALL USING (auth_is_admin());

-- Importaciones
CREATE POLICY "admin_manages_imports" ON import_batches FOR ALL USING (auth_is_admin());
CREATE POLICY "admin_sees_import_errors" ON import_errors FOR SELECT USING (auth_is_admin());
CREATE POLICY "system_inserts_errors" ON import_errors FOR INSERT WITH CHECK (TRUE);

-- Auditoría
CREATE POLICY "directivo_sees_audit" ON audit_logs FOR SELECT USING (auth_is_directivo_or_above());
CREATE POLICY "system_inserts_audit" ON audit_logs FOR INSERT WITH CHECK (TRUE);

-- Notificaciones
CREATE POLICY "own_notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "system_inserts_notif" ON notifications FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "update_own_notif" ON notifications FOR UPDATE USING (user_id = auth.uid());
-- =============================================================
-- DATOS INICIALES — Sistema Académico ENS N°9
-- Estructura académica real de la Escuela Normal Superior N°9
-- Fuente: Planillas Excel + Planta Funcional 2026
-- =============================================================

-- Ciclo lectivo 2026 (actual)
INSERT INTO academic_years (year, label, is_current, start_date, end_date) VALUES
  (2026, 'Ciclo Lectivo 2026', TRUE, '2026-03-01', '2026-12-15');

-- =============================================================
-- MODALIDADES
-- =============================================================
INSERT INTO modalities (code, name, max_year) VALUES
  ('COMUN',   'Modalidad Común',   5),
  ('TECNICA', 'Modalidad Técnica', 6);

-- =============================================================
-- ORIENTACIONES / TRAYECTOS
-- =============================================================
-- Modalidad Común
INSERT INTO orientations (modality_id, code, name, min_year, max_year)
SELECT id, 'CBC',      'Ciclo Básico Común',                         1, 2 FROM modalities WHERE code = 'COMUN'
UNION ALL
SELECT id, 'SOCIALES', 'Bachillerato en Ciencias Sociales',          3, 5 FROM modalities WHERE code = 'COMUN'
UNION ALL
SELECT id, 'NATURALES','Bachillerato en Ciencias Naturales',         3, 5 FROM modalities WHERE code = 'COMUN'
-- Modalidad Técnica
UNION ALL
SELECT id, 'GTAO',     'Técnico en Gestión y Administración de las Organizaciones', 1, 6 FROM modalities WHERE code = 'TECNICA';

-- =============================================================
-- MATERIAS — CICLO BÁSICO COMÚN (1° y 2°)
-- Fuente: planillas 1B, 1E, 1G, 2E
-- =============================================================
INSERT INTO subjects (name, normalized_name, orientation_id, year_level)
SELECT s.name, lower(unaccent(s.name)), o.id, s.yr
FROM (VALUES
  ('Lengua y Literatura',           1),
  ('Matemática',                    1),
  ('Geografía',                     1),
  ('Historia',                      1),
  ('Biología',                      1),
  ('Inglés',                        1),
  ('Educación Física',              1),
  ('Educación Artística',           1),
  ('Formación Ética y Ciudadana',   1),
  ('Tecnología',                    1),
  ('Espacio de Definición Institucional (EDI)', 1),
  ('Lengua y Literatura',           2),
  ('Matemática',                    2),
  ('Geografía',                     2),
  ('Historia',                      2),
  ('Biología',                      2),
  ('Inglés',                        2),
  ('Educación Física',              2),
  ('Educación Artística',           2),
  ('Formación Ética y Ciudadana',   2),
  ('Tecnología',                    2),
  ('Físico-Química',                2),
  ('Espacio de Definición Institucional (EDI)', 2)
) AS s(name, yr)
CROSS JOIN orientations o
WHERE o.code = 'CBC';

-- =============================================================
-- MATERIAS — BACHILLERATO CIENCIAS SOCIALES (3°-5°)
-- Fuente: planillas 4A, 5A + CUPOF CSYHSEC
-- =============================================================
INSERT INTO subjects (name, normalized_name, orientation_id, year_level)
SELECT s.name, lower(unaccent(s.name)), o.id, s.yr
FROM (VALUES
  ('Lengua y Literatura I',             3),
  ('Matemática I',                      3),
  ('Inglés I',                          3),
  ('Educación Física I',                3),
  ('Historia I',                        3),
  ('Geografía I',                       3),
  ('Biología',                          3),
  ('Física',                            3),
  ('Educación Artística',               3),
  ('Formación Ética y Ciudadana',       3),
  ('TIC',                               3),
  ('Lengua y Literatura II',            4),
  ('Matemática II',                     4),
  ('Inglés II',                         4),
  ('Educación Física II',               4),
  ('Historia II',                       4),
  ('Geografía',                         4),
  ('Química',                           4),
  ('Psicología',                        4),
  ('Economía',                          4),
  ('Ciudadanía y Trabajo',              4),
  ('Metodología de la Investigación',   4),
  ('Lengua y Literatura III',           5),
  ('Matemática III',                    5),
  ('Inglés III',                        5),
  ('Educación Física III',              5),
  ('Filosofía',                         5),
  ('Derecho',                           5),
  ('Geografía Económica',               5),
  ('Historia de las Transformaciones Sociales del S. XX y XXI', 5),
  ('Proyecto de Investigación e Integración Sociocomunitaria', 5),
  ('Ciencias Políticas',                5),
  ('Sociología',                        5)
) AS s(name, yr)
CROSS JOIN orientations o
WHERE o.code = 'SOCIALES';

-- =============================================================
-- MATERIAS — BACHILLERATO CIENCIAS NATURALES (3°-5°)
-- Fuente: planillas 4D, 5D + CUPOF CNATSEC
-- =============================================================
INSERT INTO subjects (name, normalized_name, orientation_id, year_level)
SELECT s.name, lower(unaccent(s.name)), o.id, s.yr
FROM (VALUES
  ('Lengua y Literatura I',             3),
  ('Matemática I',                      3),
  ('Inglés I',                          3),
  ('Educación Física I',                3),
  ('Historia I',                        3),
  ('Geografía I',                       3),
  ('Biología',                          3),
  ('Física',                            3),
  ('Educación Artística',               3),
  ('Formación Ética y Ciudadana',       3),
  ('TIC',                               3),
  ('Lengua y Literatura II',            4),
  ('Matemática II',                     4),
  ('Inglés II',                         4),
  ('Educación Física II',               4),
  ('Historia II',                       4),
  ('Física II',                         4),
  ('Química I',                         4),
  ('Biología II',                       4),
  ('Psicología',                        4),
  ('Economía',                          4),
  ('Ciudadanía y Trabajo',              4),
  ('Educación para el Trabajo',         4),
  ('Lengua y Literatura III',           5),
  ('Matemática III',                    5),
  ('Inglés III',                        5),
  ('Educación Física III',              5),
  ('Filosofía I',                       5),
  ('Derecho I',                         5),
  ('Química II',                        5),
  ('Biología Celular y Molecular',      5),
  ('Ecología',                          5),
  ('Transformaciones Científicas del S. XX y XXI', 5),
  ('Proyecto de Investigación e Intervención Sociocomunitaria', 5)
) AS s(name, yr)
CROSS JOIN orientations o
WHERE o.code = 'NATURALES';

-- =============================================================
-- MATERIAS — TÉCNICO EN GESTIÓN Y ADMINISTRACIÓN (1°-6°)
-- Fuente: planillas 1A, 1D, 3B, 4B, 5B, 6A
-- =============================================================
INSERT INTO subjects (name, normalized_name, orientation_id, year_level)
SELECT s.name, lower(unaccent(s.name)), o.id, s.yr
FROM (VALUES
  ('Lengua y Literatura',               1),
  ('Matemática',                        1),
  ('Geografía',                         1),
  ('Historia',                          1),
  ('Biología',                          1),
  ('Inglés',                            1),
  ('Educación Física',                  1),
  ('Formación Ética y Ciudadana',       1),
  ('Tecnología',                        1),
  ('Dibujo Técnico',                    1),
  ('TIC I',                             1),
  ('Introducción a la Gestión Organizacional', 1),
  ('Introducción a la Práctica Comercial', 1),
  ('Diseño de Proyectos',               1),
  ('Lengua y Literatura',               2),
  ('Matemática',                        2),
  ('Geografía',                         2),
  ('Historia',                          2),
  ('Biología',                          2),
  ('Inglés',                            2),
  ('Educación Física',                  2),
  ('Físico-Química',                    2),
  ('Formación Ética y Ciudadana',       2),
  ('Tecnología',                        2),
  ('Dibujo Técnico',                    2),
  ('TIC II',                            2),
  ('Gestión y Práctica Organizacional', 2),
  ('Práctica Comercial',                2),
  ('Emprendimientos Comerciales',       2),
  ('Lengua y Literatura',               3),
  ('Matemática',                        3),
  ('Inglés',                            3),
  ('Educación Física',                  3),
  ('Historia',                          3),
  ('Geografía',                         3),
  ('Química',                           3),
  ('TIC',                               3),
  ('Sistemas de Información Contable',  3),
  ('Teoría y Gestión Organizacional',   3),
  ('Comunicación y Comunicación Organizacional', 3),
  ('Programación de Compras y Ventas',  3),
  ('Gestión de Compras y Ventas',       3),
  ('Administración y Gestión de RRHH',  3),
  ('Lengua y Literatura',               4),
  ('Matemática',                        4),
  ('Inglés',                            4),
  ('Educación Física',                  4),
  ('Sistemas de Información Contable II', 4),
  ('Teoría y Gestión Organizacional II', 4),
  ('Sociología de las Organizaciones',  4),
  ('Economía',                          4),
  ('Derecho Económico',                 4),
  ('Gestión de Clientes',               4),
  ('Operaciones de Ingresos y Egresos', 4),
  ('Operaciones de Compras y Ventas',   4),
  ('Marketing',                         4),
  ('Teoría y Práctica Impositiva I',    4),
  ('Lengua y Literatura',               5),
  ('Inglés',                            5),
  ('Educación Física',                  5),
  ('EDI - Lengua Extranjera Portugués', 5),
  ('Matemática Financiera',             5),
  ('Sistemas de Información Contable III', 5),
  ('Proyectos y Gestión de Microemprendimientos', 5),
  ('Economía II',                       5),
  ('Derecho Laboral',                   5),
  ('Contabilidad Aplicada',             5),
  ('Gestión Financiera y Fuentes de Financiamiento', 5),
  ('Producción y Costos',               5),
  ('Liquidación y Registro de Remuneraciones', 5),
  ('Relaciones Humanas',                5),
  ('Teoría y Práctica Impositiva II',   5),
  ('Lengua Extranjera Inglés',          6),
  ('EDI - Portugués',                   6),
  ('EDI - Matemática Aplicada',         6),
  ('Contabilidad Aplicada II',          6),
  ('Estados Contables',                 6),
  ('Comercio Exterior',                 6),
  ('Integración',                       6),
  ('Contextualización',                 6),
  ('Práctica Profesionalizante',        6)
) AS s(name, yr)
CROSS JOIN orientations o
WHERE o.code = 'GTAO';

-- =============================================================
-- PERÍODOS DE EVALUACIÓN — 2026
-- =============================================================
INSERT INTO grading_periods (academic_year_id, name, code, order_index, open_date, close_date, status)
SELECT
  ay.id,
  p.name,
  p.code::grading_period_code,
  p.ord,
  p.open_d::date,
  p.close_d::date,
  'open'::period_status
FROM academic_years ay
CROSS JOIN (VALUES
  ('1° Trimestre',       'T1',       1, '2026-03-01', '2026-06-30'),
  ('2° Trimestre',       'T2',       2, '2026-07-01', '2026-09-30'),
  ('3° Trimestre',       'T3',       3, '2026-10-01', '2026-11-30'),
  ('Calificación Final', 'FINAL',    4, '2026-10-01', '2026-12-15'),
  ('Recuperación',       'RECOVERY', 5, '2026-02-01', '2026-02-28')
) AS p(name, code, ord, open_d, close_d)
WHERE ay.is_current = TRUE;
