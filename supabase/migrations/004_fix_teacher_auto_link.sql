-- Mejora del trigger de vinculación de docentes
-- Agrega match por email además de DNI, y actualiza DNI temporal si el docente ingresa el real

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
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  IF NEW.raw_user_meta_data->>'role' = 'docente' THEN
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'docente');

    v_dni := NULLIF(TRIM(NEW.raw_user_meta_data->>'dni'), '');
    v_inv_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'invitation_code'), '');

    -- 1. Intentar por DNI real
    IF v_dni IS NOT NULL THEN
      SELECT * INTO v_teacher FROM teachers
      WHERE dni = v_dni
        AND status IN ('pending_registration', 'pending_approval')
      LIMIT 1;
    END IF;

    -- 2. Si no matchea por DNI, intentar por email (docentes importados con DNI temporal)
    IF v_teacher.id IS NULL AND NEW.email IS NOT NULL THEN
      SELECT * INTO v_teacher FROM teachers
      WHERE email = NEW.email
        AND status IN ('pending_registration', 'pending_approval')
      LIMIT 1;
    END IF;

    -- 3. Intentar por código de invitación
    IF v_teacher.id IS NULL AND v_inv_code IS NOT NULL THEN
      SELECT * INTO v_teacher FROM teachers
      WHERE registration_code = v_inv_code
        AND status IN ('pending_registration', 'pending_approval')
      LIMIT 1;
    END IF;

    IF v_teacher.id IS NOT NULL THEN
      UPDATE teachers SET
        user_id = NEW.id,
        email = COALESCE(teachers.email, NEW.email),
        -- Si el DNI era temporal y el docente ingresó el real, actualizarlo
        dni = CASE
          WHEN teachers.dni LIKE 'TMP-%' AND v_dni IS NOT NULL THEN v_dni
          ELSE teachers.dni
        END,
        status = 'active',
        updated_at = NOW()
      WHERE id = v_teacher.id;

      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
      VALUES (NEW.id, 'teacher_auto_linked', 'teachers', v_teacher.id::text,
        jsonb_build_object('dni', v_dni, 'email', NEW.email, 'method', 'auto_match'));
    ELSE
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
      VALUES (NEW.id, 'teacher_registration_pending', 'teachers', NULL,
        jsonb_build_object('email', NEW.email, 'full_name', NEW.raw_user_meta_data->>'full_name'));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
