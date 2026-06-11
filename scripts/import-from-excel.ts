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
  errors: string[]
  warnings: string[]
}

interface StudentRow {
  ord: number
  dni: string
  fullName: string
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

function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

  // 3. Check for grade data in subject sheets
  const subjectSheets = extractSubjectsFromFile(wb)
  result.warnings.push(`${subjectSheets.length} materias detectadas: ${subjectSheets.join(', ')}`)

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
