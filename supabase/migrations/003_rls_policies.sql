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
