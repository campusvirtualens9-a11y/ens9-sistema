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
