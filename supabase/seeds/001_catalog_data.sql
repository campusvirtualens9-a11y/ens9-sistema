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
