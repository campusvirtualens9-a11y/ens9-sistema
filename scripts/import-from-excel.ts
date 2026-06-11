/**
 * Script de importación masiva desde planillas Excel
 * Escuela Normal Superior N°9 — Sistema Académico
 *
 * Uso: npx tsx scripts/import-from-excel.ts
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import ws from 'ws'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
)

const INSUMOS_DIR = path.join(process.cwd(), 'insumos', 'planillas')

// Archivos con datos reales (sin templates vacíos)
const VALID_FILES = [
  { file: '1A (1).xlsx',  year: 1, division: 'A', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
  { file: '1B (1).xlsx',  year: 1, division: 'B', shift: 'T', modality: 'COMUN',   orientation: 'CBC'  },
  { file: '1D (1).xlsx',  year: 1, division: 'D', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
  { file: '1E (1).xlsx',  year: 1, division: 'E', shift: 'T', modality: 'COMUN',   orientation: 'CBC'  },
  { file: '1F (1).xlsx',  year: 1, division: 'F', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
  { file: '1G.xlsx',      year: 1, division: 'G', shift: 'T', modality: 'COMUN',   orientation: 'CBC'  },
  { file: '2E (1).xlsx',  year: 2, division: 'E', shift: 'T', modality: 'COMUN',   orientation: 'CBC'  },
  { file: '3B.xlsx',      year: 3, division: 'B', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
  { file: '3D (1).xlsx',  year: 3, division: 'D', shift: 'T', modality: 'COMUN',   orientation: 'NATURALES' },
  { file: '4A.xlsx',      year: 4, division: 'A', shift: 'M', modality: 'COMUN',   orientation: 'SOCIALES'  },
  { file: '4B.xlsx',      year: 4, division: 'B', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
  { file: '4D.xlsx',      year: 4, division: 'D', shift: 'T', modality: 'COMUN',   orientation: 'NATURALES' },
  { file: '5A.xlsx',      year: 5, division: 'A', shift: 'M', modality: 'COMUN',   orientation: 'SOCIALES'  },
  { file: '5B.xlsx',      year: 5, division: 'B', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
  { file: '5D.xlsx',      year: 5, division: 'D', shift: 'T', modality: 'COMUN',   orientation: 'NATURALES' },
  { file: '6A.xlsx',      year: 6, division: 'A', shift: 'M', modality: 'TECNICA', orientation: 'GTAO' },
]

// Archivos a ignorar (templates vacíos)
const SKIP_FILES = ['1C.xlsx', '1°G.xlsx', '2° B.xlsx', '2A.xlsx', '2C.xlsx', '2D.xlsx', '3A.xlsx']

interface ImportResult {
  file: string
  studentsImported: number
  studentsSkipped: number
  teachersImported: number
  assignmentsImported: number
  errors: string[]
  warnings: string[]
}

interface StudentRow {
  ord: number
  dni: string
  fullName: string
}

interface TeacherAssignmentRow {
  subjectName: string
  teacherName: string
  email: string
}

function extractTeacherAssignments(ws: XLSX.WorkSheet): TeacherAssignmentRow[] {
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
  const assignments: TeacherAssignmentRow[] = []

  for (const row of data) {
    const subject = String(row[30] || '').trim()
    const teacher = String(row[31] || '').trim()
    const email = String(row[32] || '').trim()

    const skipWords = new Set(['Materia', 'Profesor', 'División', 'Turno', 'Año', 'Curso'])
    if (
      subject.length > 2 &&
      teacher.length > 2 &&
      !skipWords.has(subject) &&
      !skipWords.has(teacher)
    ) {
      assignments.push({ subjectName: subject, teacherName: teacher, email })
    }
  }

  return assignments
}

function extractStudentsFromMatrix(ws: XLSX.WorkSheet): StudentRow[] {
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
  const students: StudentRow[] = []

  for (const row of data) {
    const ord = row[0]
    const dni = String(row[1] || '').trim()
    const name = String(row[2] || '').trim()

    // Valid student row: numeric order, 7-8 digit DNI, non-empty name
    if (
      typeof ord === 'number' &&
      ord > 0 &&
      /^\d{7,8}$/.test(dni) &&
      name.length > 3
    ) {
      students.push({ ord, dni, fullName: name })
    }
  }

  return students
}

function extractSubjectsFromFile(wb: XLSX.WorkBook): string[] {
  const skipSheets = new Set(['MATRIZ', 'ESTADIST-1ºT.', 'ESTADIST-2ºT.', 'ESTADIST-3ºT.', 'Est-gral.'])
  const templateSheets = new Set(['mat12', 'mat13', 'mat14'])

  return wb.SheetNames.filter(s =>
    !skipSheets.has(s) &&
    !templateSheets.has(s) &&
    !s.startsWith('Hoja') &&
    s.length > 1
  )
}

// Aliases para nombres abreviados en los Excel → nombre normalizado en DB
const SUBJECT_ALIASES: Record<string, string> = {
  // Formación General
  'lengua': 'lengua y literatura',
  'lengua iii': 'lengua y literatura iii',
  'leng. y lit. iii': 'lengua y literatura iii',
  'lengua ext. ingles': 'lengua extranjera ingles',
  'lengua ext. ingles iii': 'lengua extranjera ingles',
  'lengua extranjera ingles iii': 'ingles iii',
  'etica': 'formacion etica y ciudadana',
  'educ. fisica': 'educacion fisica',
  'ed. fisica': 'educacion fisica',
  'educ. fisica i': 'educacion fisica i',
  'educ. fisica ii': 'educacion fisica ii',
  'educ. fisica iii': 'educacion fisica iii',
  'ed. artistica': 'educacion artistica',
  'educ. artistica': 'educacion artistica',
  'educ. para la salud': 'educacion para el trabajo',
  // TIC
  'tic i': 'tic i',
  'tic ii': 'tic ii',
  'tic iii': 'tic',
  'tic': 'tic',
  // Formación Científico Tecnológica
  'introd. a la gestion org.': 'introduccion a la gestion organizacional',
  'introd. a la practica com.': 'introduccion a la practica comercial',
  'sist. inf. cont.': 'sistemas de informacion contable',
  'sist. inf. contable': 'sistemas de informacion contable ii',
  'sist. info. contable iii': 'sistemas de informacion contable iii',
  'teoria y gest. org.': 'teoria y gestion organizacional',
  'teoria gest. org.': 'teoria y gestion organizacional ii',
  'sociol. de las org.': 'sociologia de las organizaciones',
  'metodologia de la inv.': 'metodologia de la investigacion',
  'economia i': 'economia',
  'fisico-quimica': 'fisico-quimica',
  'fco-quimica': 'fisico-quimica',
  // Formación Técnica Específica
  'com. y com. orga.': 'comunicacion y comunicacion organizacional',
  'prog. cpras. y  ventas': 'programacion de compras y ventas',
  'prog. cpras. y ventas': 'programacion de compras y ventas',
  'legua extr. ingles': 'lengua extranjera ingles',
  'gest. cpras y ventas': 'gestion de compras y ventas',
  'adm. y gest. rrhh': 'administracion y gestion de rrhh',
  'gest. de clientes': 'gestion de clientes',
  'oper de ing. y egr.': 'operaciones de ingresos y egresos',
  'oper.cpras y vtas.': 'operaciones de compras y ventas',
  'teor. y pract. imp.': 'teoria y practica impositiva i',
  'teoria y pract. impositiva ii': 'teoria y practica impositiva ii',
  'gest. finac. y fuente de finaciacion': 'gestion financiera y fuentes de financiamiento',
  'liqui. y resi de las remu.': 'liquidacion y registro de remuneraciones',
  'proyectos y gest. de micro': 'proyectos y gestion de microemprendimientos',
  'proy. de la inv. y integ. sociocom.': 'proyecto de investigacion e integracion sociocomunitaria',
  'proy. de inv. e interv. socio comun.': 'proyecto de investigacion e intervencion sociocomunitaria',
  'hist. de las trans.soc. en los s. xx y xxi': 'historia de las transformaciones sociales del s. xx y xxi',
  'trans. cient. del s. xx y xxi': 'transformaciones cientificas del s. xx y xxi',
  'edi leng. extr. portugues': 'edi - lengua extranjera portugues',
  'e.d.i.(2) portugues': 'edi - portugues',
  'e.d.i.(3) matematica aplic.': 'edi - matematica aplicada',
  'contabilidad aplic': 'contabilidad aplicada',
  'edi': 'espacio de definicion institucional (edi)',
}

function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveSubjectName(rawName: string): string {
  const normalized = normalizeSubjectName(rawName)
  return SUBJECT_ALIASES[normalized] ?? normalized
}

async function getOrCreateIds() {
  const { data: years } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  const { data: modalities } = await supabase.from('modalities').select('id, code')
  const { data: orientations } = await supabase.from('orientations').select('id, code')
  const { data: subjects } = await supabase.from('subjects').select('id, normalized_name, year_level, orientation_id')

  return {
    currentYearId: years!.id,
    modalities: Object.fromEntries(modalities!.map(m => [m.code, m.id])),
    orientations: Object.fromEntries(orientations!.map(o => [o.code, o.id])),
    subjects: subjects!,
  }
}

async function importFile(
  fileConfig: typeof VALID_FILES[0],
  ids: Awaited<ReturnType<typeof getOrCreateIds>>,
  batchId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    file: fileConfig.file,
    studentsImported: 0,
    studentsSkipped: 0,
    teachersImported: 0,
    assignmentsImported: 0,
    errors: [],
    warnings: [],
  }

  const filePath = path.join(INSUMOS_DIR, fileConfig.file)
  if (!fs.existsSync(filePath)) {
    result.errors.push(`Archivo no encontrado: ${filePath}`)
    return result
  }

  const wb = XLSX.readFile(filePath)

  // 1. Get or create course section
  const modalityId = ids.modalities[fileConfig.modality]
  const orientationId = ids.orientations[fileConfig.orientation]

  const { data: existingSection } = await supabase
    .from('course_sections')
    .select('id')
    .eq('academic_year_id', ids.currentYearId)
    .eq('modality_id', modalityId)
    .eq('year_level', fileConfig.year)
    .eq('division', fileConfig.division)
    .eq('shift', fileConfig.shift)
    .single()

  let sectionId: string
  if (existingSection) {
    sectionId = existingSection.id
  } else {
    const { data: newSection, error } = await supabase
      .from('course_sections')
      .insert({
        academic_year_id: ids.currentYearId,
        modality_id: modalityId,
        orientation_id: orientationId,
        year_level: fileConfig.year,
        division: fileConfig.division,
        shift: fileConfig.shift as 'M' | 'T' | 'N',
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      result.errors.push(`Error creando sección: ${error.message}`)
      return result
    }
    sectionId = newSection!.id
  }

  // 2. Extract and import students
  const matrizSheet = wb.Sheets['MATRIZ']
  if (!matrizSheet) {
    result.errors.push('Hoja MATRIZ no encontrada')
    return result
  }

  const students = extractStudentsFromMatrix(matrizSheet)

  for (const student of students) {
    // Upsert student
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('dni', student.dni)
      .single()

    let studentId: string
    if (existingStudent) {
      studentId = existingStudent.id
      result.studentsSkipped++
    } else {
      const { data: newStudent, error } = await supabase
        .from('students')
        .insert({
          dni: student.dni,
          full_name: student.fullName,
          status: 'active',
          import_source: fileConfig.file,
        })
        .select('id')
        .single()

      if (error) {
        result.errors.push(`Error insertando alumno ${student.fullName}: ${error.message}`)
        continue
      }
      studentId = newStudent!.id
      result.studentsImported++
    }

    // Create enrollment if not exists
    const { error: enrollError } = await supabase
      .from('student_enrollments')
      .upsert({
        student_id: studentId,
        course_section_id: sectionId,
        academic_year_id: ids.currentYearId,
        enrollment_number: student.ord,
        is_active: true,
      }, { onConflict: 'student_id,course_section_id,academic_year_id' })

    if (enrollError) {
      result.warnings.push(`Error matriculando ${student.fullName}: ${enrollError.message}`)
    }
  }

  // 3. Import teachers and assignments from MATRIZ teacher table
  const teacherAssignments = extractTeacherAssignments(matrizSheet)

  for (const ta of teacherAssignments) {
    // Split multiple teachers (e.g. "Nuñez Cergio/Vera Sabrina")
    const teacherNames = ta.teacherName.split(/[/,]/).map(n => n.trim()).filter(Boolean)
    const emails = ta.email.split(/[,;]/).map(e => e.trim()).filter(Boolean)

    for (let i = 0; i < teacherNames.length; i++) {
      const teacherName = teacherNames[i]
      const email = emails[i] || emails[0] || null

      // Upsert teacher by full_name
      const { data: existingTeacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('full_name', teacherName)
        .single()

      let teacherId: string
      if (existingTeacher) {
        teacherId = existingTeacher.id
      } else {
        // DNI temporal basado en email o nombre normalizado (se actualiza con planta funcional)
        const tempDni = email
          ? `TMP-${email.split('@')[0].slice(0, 20)}`
          : `TMP-${normalizeSubjectName(teacherName).replace(/\s/g, '-').slice(0, 20)}`

        const { data: newTeacher, error } = await supabase
          .from('teachers')
          .upsert(
            { full_name: teacherName, email, dni: tempDni, status: 'active', import_source: fileConfig.file },
            { onConflict: 'dni' }
          )
          .select('id')
          .single()

        if (error) {
          result.errors.push(`Error insertando docente ${teacherName}: ${error.message}`)
          continue
        }
        teacherId = newTeacher!.id
        result.teachersImported++
      }

      // Find subject by normalized name and year level
      const resolvedName = resolveSubjectName(ta.subjectName)
      const subject = ids.subjects.find(s => {
        const sNorm = normalizeSubjectName(s.normalized_name || '')
        return sNorm === resolvedName
      })

      if (!subject) {
        result.warnings.push(`Materia no encontrada en DB: "${ta.subjectName}"`)
        continue
      }

      // Upsert teacher assignment
      const { error: assignError } = await supabase
        .from('teacher_assignments')
        .upsert({
          teacher_id: teacherId,
          subject_id: subject.id,
          course_section_id: sectionId,
          academic_year_id: ids.currentYearId,
          is_active: true,
        }, { onConflict: 'teacher_id,subject_id,course_section_id,academic_year_id' })

      if (assignError) {
        result.warnings.push(`Error asignando ${teacherName} a ${ta.subjectName}: ${assignError.message}`)
      } else {
        result.assignmentsImported++
      }
    }
  }

  return result
}

async function main() {
  console.log('\n=== IMPORTACIÓN MASIVA — ENS N°9 ===')
  console.log('Fecha:', new Date().toISOString())

  // Create import batch
  const { data: batch } = await supabase
    .from('import_batches')
    .insert({
      filename: 'planillas_2026.zip',
      import_type: 'students_and_sections',
      status: 'processing',
      total_rows: VALID_FILES.length,
      created_by: '481ccd5d-63d6-41a5-98ce-eadfa8a04a2c',
    })
    .select('id')
    .single()

  const batchId = batch!.id

  try {
    const ids = await getOrCreateIds()
    console.log(`Año lectivo activo: ${ids.currentYearId}`)

    let totalImported = 0
    let totalSkipped = 0
    let totalTeachers = 0
    let totalAssignments = 0
    const allErrors: string[] = []

    console.log(`\nProcesando ${VALID_FILES.length} archivos...`)
    console.log(`Omitiendo templates vacíos: ${SKIP_FILES.join(', ')}\n`)

    for (const fileConfig of VALID_FILES) {
      process.stdout.write(`  ${fileConfig.file.padEnd(25)} `)
      const result = await importFile(fileConfig, ids, batchId)

      if (result.errors.length > 0) {
        console.log(`❌ ERROR`)
        result.errors.forEach(e => console.log(`     ${e}`))
        allErrors.push(...result.errors.map(e => `[${fileConfig.file}] ${e}`))
      } else {
        console.log(`✓ ${result.studentsImported} nuevos, ${result.studentsSkipped} existentes`)
      }

      totalImported += result.studentsImported
      totalSkipped += result.studentsSkipped
      totalTeachers += result.teachersImported
      totalAssignments += result.assignmentsImported

      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`     ⚠ ${w}`))
      }

      // Log errors to DB
      for (const err of result.errors) {
        await supabase.from('import_errors').insert({
          import_batch_id: batchId,
          error_message: err,
          severity: 'error',
        })
      }
    }

    // Update batch
    await supabase
      .from('import_batches')
      .update({
        status: allErrors.length > 0 ? 'partial' : 'completed',
        imported_rows: totalImported,
        error_rows: allErrors.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    console.log('\n=== RESUMEN ===')
    console.log(`Alumnos nuevos importados: ${totalImported}`)
    console.log(`Alumnos ya existentes (omitidos): ${totalSkipped}`)
    console.log(`Docentes nuevos importados: ${totalTeachers}`)
    console.log(`Asignaciones importadas: ${totalAssignments}`)
    console.log(`Errores: ${allErrors.length}`)

    if (allErrors.length > 0) {
      console.log('\nERRORES ENCONTRADOS:')
      allErrors.forEach(e => console.log(`  • ${e}`))
    }

    console.log('\n✓ Importación completada')
    console.log(`ID del lote: ${batchId}`)

  } catch (err) {
    console.error('Error fatal:', err)
    await supabase
      .from('import_batches')
      .update({ status: 'failed' })
      .eq('id', batchId)
  }
}

main()
