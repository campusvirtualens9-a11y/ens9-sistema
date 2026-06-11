'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format'

type Batch = {
  id: string
  filename: string
  import_type: string
  status: string
  total_rows: number | null
  imported_rows: number | null
  error_rows: number | null
  created_at: string
  completed_at: string | null
  warnings: any
}

const STATUS_ICONS = {
  pending:    <Clock className="w-4 h-4 text-slate-400" />,
  processing: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  completed:  <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  partial:    <AlertTriangle className="w-4 h-4 text-amber-500" />,
  failed:     <XCircle className="w-4 h-4 text-red-500" />,
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', processing: 'Procesando',
  completed: 'Completado', partial: 'Parcial', failed: 'Fallido',
}

const IMPORT_TYPES: Record<string, string> = {
  students_and_sections: 'Alumnos y secciones',
  teachers: 'Docentes',
  assignments: 'Asignaciones',
  grades: 'Calificaciones',
}

type Props = { batches: Batch[] }

export default function ImportDashboard({ batches: initialBatches }: Props) {
  const [batches, setBatches] = useState(initialBatches)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    ok: boolean; message: string; details?: string[]
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.zip')
    )
    if (files.length > 0) processFiles(files)
  }

  async function processFiles(files: File[]) {
    setUploading(true)
    setUploadResult(null)

    const formData = new FormData()
    files.forEach(f => formData.append('files', f))

    const res = await fetch('/api/import/upload', {
      method: 'POST',
      body: formData,
    })

    setUploading(false)

    if (res.ok) {
      const data = await res.json()
      setUploadResult({ ok: true, message: data.message, details: data.details })
    } else {
      const err = await res.json()
      setUploadResult({ ok: false, message: err.error ?? 'Error al subir el archivo' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Importaciones</h1>
        <p className="text-slate-500 text-sm mt-1">
          Cargá planillas Excel para importar alumnos, docentes y calificaciones al sistema.
        </p>
      </div>

      {/* Alert boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          title="Archivos detectados"
          value="16 planillas"
          sub="con datos reales"
          color="text-emerald-600 bg-emerald-50 border-emerald-200"
        />
        <InfoCard
          title="Templates vacíos"
          value="7 archivos"
          sub="sin alumnos — se omiten"
          color="text-amber-600 bg-amber-50 border-amber-200"
        />
        <InfoCard
          title="Inconsistencias"
          value="5 detectadas"
          sub="requieren revisión manual"
          color="text-red-600 bg-red-50 border-red-200"
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
          dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.zip"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) processFiles(files)
          }}
        />
        {uploading ? (
          <>
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-blue-600 font-medium">Procesando archivos...</p>
          </>
        ) : (
          <>
            <div className="p-3 bg-slate-100 rounded-xl">
              <Upload className="w-7 h-7 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-700">Arrastrá archivos aquí</p>
              <p className="text-slate-400 text-sm">o hacé click para seleccionar</p>
            </div>
            <p className="text-slate-400 text-xs">
              Formatos aceptados: .xlsx, .xls, .zip
            </p>
          </>
        )}
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div className={cn(
          'rounded-xl border p-4 flex items-start gap-3',
          uploadResult.ok
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        )}>
          {uploadResult.ok
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            : <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={cn('font-medium text-sm', uploadResult.ok ? 'text-emerald-800' : 'text-red-800')}>
              {uploadResult.message}
            </p>
            {uploadResult.details && (
              <ul className={cn('mt-1 text-xs space-y-0.5', uploadResult.ok ? 'text-emerald-700' : 'text-red-700')}>
                {uploadResult.details.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Inconsistencies panel */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-800 text-sm">Inconsistencias detectadas en los archivos</h3>
        </div>
        <ul className="space-y-1.5 text-sm text-amber-700">
          <li>• <strong>1°G.xlsx</strong> y <strong>1G.xlsx</strong>: mismo curso/división duplicado. Solo se importa <code>1G.xlsx</code> (tiene alumnos).</li>
          <li>• <strong>2A.xlsx</strong>: hojas sin nombre ("Hoja 1"-"Hoja 6") — estructura de plantilla corrupta. Se omite automáticamente.</li>
          <li>• Nombres de materias inconsistentes entre archivos (ej. "Educ. Física" / "Educación Física"). El sistema normaliza automáticamente.</li>
          <li>• Algunos docentes mencionados en planillas no coinciden con la planta funcional (PDF). Requiere vinculación manual en "Docentes".</li>
          <li>• Encabezado de plantilla "PEDRO D. MEDERA" presente en varias hojas — ignorado como placeholder.</li>
        </ul>
      </div>

      {/* Import history */}
      {batches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Historial de importaciones
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Archivo</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Estado</th>
                  <th className="text-right px-4 py-2.5 text-slate-600 font-medium">Importados</th>
                  <th className="text-right px-4 py-2.5 text-slate-600 font-medium">Errores</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map(batch => (
                  <tr key={batch.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="font-medium text-slate-700">{batch.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {IMPORT_TYPES[batch.import_type] ?? batch.import_type}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICONS[batch.status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending}
                        <span className="text-slate-600">{STATUS_LABELS[batch.status] ?? batch.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {batch.imported_rows ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={batch.error_rows ? 'text-red-600' : 'text-slate-400'}>
                        {batch.error_rows ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {formatDateTime(batch.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ title, value, sub, color }: {
  title: string; value: string; sub: string; color: string
}) {
  return (
    <div className={cn('rounded-xl border p-4', color)}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{title}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{sub}</p>
    </div>
  )
}
