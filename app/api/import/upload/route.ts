import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || roleData.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden importar datos' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo procesar el formulario' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  if (!files.length) {
    return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const details: string[] = []
  let accepted = 0

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      details.push(`${file.name}: demasiado grande (máx. 10 MB)`)
      continue
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      details.push(`${file.name}: formato no soportado (solo .xlsx o .xls)`)
      continue
    }

    let wb: XLSX.WorkBook
    try {
      const buffer = await file.arrayBuffer()
      wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    } catch {
      details.push(`${file.name}: no se pudo leer el archivo`)
      continue
    }

    // Detect if file has real student data (MATRIZ sheet with rows beyond header)
    const matrizSheet = wb.Sheets['MATRIZ'] ?? wb.Sheets[wb.SheetNames[0]]
    const rows = matrizSheet ? XLSX.utils.sheet_to_json(matrizSheet, { header: 1 }) as any[][] : []
    // Skip first 3 rows (headers), count rows with DNI-like values in column 4
    const dataRows = rows.slice(3).filter(r => r && r[3] && /^\d{7,8}$/.test(String(r[3]).trim()))
    const hasRealData = dataRows.length > 0

    const { data: batch, error } = await admin
      .from('import_batches')
      .insert({
        filename: file.name,
        import_type: 'students_and_sections',
        status: hasRealData ? 'pending' : 'completed',
        total_rows: dataRows.length,
        imported_rows: 0,
        error_rows: 0,
        created_by: user.id,
        warnings: hasRealData ? null : { skipped: 'Sin alumnos registrados (template vacío)' },
      })
      .select('id')
      .single()

    if (error) {
      details.push(`${file.name}: error al registrar — ${error.message}`)
      continue
    }

    accepted++
    if (hasRealData) {
      details.push(`${file.name}: ${dataRows.length} alumno(s) detectado(s) — en cola para importar`)
    } else {
      details.push(`${file.name}: sin alumnos (template vacío) — omitido`)
    }
  }

  return NextResponse.json({
    message: `${accepted} archivo(s) aceptado(s) de ${files.length} recibido(s)`,
    details,
  })
}
