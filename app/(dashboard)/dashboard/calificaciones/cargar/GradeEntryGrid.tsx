'use client'

import { useState, useCallback } from 'react'
import { Save, CheckCircle2, Lock, AlertTriangle, ChevronLeft, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { GRADING_PERIOD_LABELS, SHIFT_LABELS, PERIOD_STATUS_LABELS } from '@/types/database'

type Enrollment = {
  id: string
  enrollment_number: number | null
  students: { id: string; full_name: string; dni: string }
}

type Grade = {
  id: string
  student_enrollment_id: string
  score: number | null
  observation: string | null
  status: string
}

type Props = {
  assignment: any
  section: any
  subject: any
  period: any
  enrollments: Enrollment[]
  existingGrades: Grade[]
  isPeriodClosed: boolean
  teacherUserId: string
}

type GradeRow = {
  enrollmentId: string
  gradeId: string | null
  score: string
  observation: string
  status: string
  isDirty: boolean
}

export default function GradeEntryGrid({
  assignment, section, subject, period,
  enrollments, existingGrades, isPeriodClosed, teacherUserId
}: Props) {
  const supabase = createClient()

  // Build initial rows
  const initialRows: Record<string, GradeRow> = {}
  for (const enrollment of enrollments) {
    const existing = existingGrades.find(g => g.student_enrollment_id === enrollment.id)
    initialRows[enrollment.id] = {
      enrollmentId: enrollment.id,
      gradeId: existing?.id ?? null,
      score: existing?.score != null ? String(existing.score) : '',
      observation: existing?.observation ?? '',
      status: existing?.status ?? 'draft',
      isDirty: false,
    }
  }

  const [rows, setRows] = useState(initialRows)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [confirming, setConfirming] = useState(false)

  const updateScore = useCallback((enrollmentId: string, value: string) => {
    setRows(prev => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        score: value,
        isDirty: true,
        status: 'draft',
      }
    }))
    setSaveStatus('idle')
  }, [])

  const updateObs = useCallback((enrollmentId: string, value: string) => {
    setRows(prev => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        observation: value,
        isDirty: true,
        status: 'draft',
      }
    }))
    setSaveStatus('idle')
  }, [])

  function validateScore(value: string): number | null {
    if (!value.trim()) return null
    const n = parseFloat(value.replace(',', '.'))
    if (isNaN(n) || n < 1 || n > 10) return undefined as any
    return Math.round(n * 100) / 100
  }

  async function saveGrades(confirmMode = false) {
    setSaving(true)
    setSaveStatus('idle')

    const dirtyRows = Object.values(rows).filter(r => r.isDirty || confirmMode)
    let errorCount = 0

    for (const row of dirtyRows) {
      const score = validateScore(row.score)
      if (row.score && score === undefined) {
        // Invalid score
        errorCount++
        continue
      }

      const gradeData = {
        student_enrollment_id: row.enrollmentId,
        subject_id: subject.id,
        grading_period_id: period.id,
        teacher_assignment_id: assignment.id,
        score,
        observation: row.observation || null,
        status: confirmMode ? 'confirmed' : 'draft',
        created_by: teacherUserId,
        updated_by: teacherUserId,
        submitted_at: confirmMode ? new Date().toISOString() : null,
        confirmed_at: confirmMode ? new Date().toISOString() : null,
      }

      if (row.gradeId) {
        const { error } = await supabase
          .from('grades')
          .update({ ...gradeData, updated_at: new Date().toISOString() })
          .eq('id', row.gradeId)
        if (error) errorCount++
      } else {
        const { data, error } = await supabase
          .from('grades')
          .insert(gradeData)
          .select('id')
          .single()

        if (error) {
          errorCount++
        } else if (data) {
          setRows(prev => ({
            ...prev,
            [row.enrollmentId]: { ...prev[row.enrollmentId], gradeId: data.id, isDirty: false, status: confirmMode ? 'confirmed' : 'draft' }
          }))
        }
      }
    }

    setSaving(false)

    if (errorCount > 0) {
      setSaveStatus('error')
    } else {
      setSaveStatus('saved')
      // Mark all as clean
      setRows(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => {
          next[k] = { ...next[k], isDirty: false, status: confirmMode ? 'confirmed' : next[k].status }
        })
        return next
      })
    }
  }

  const dirtyCount = Object.values(rows).filter(r => r.isDirty).length
  const confirmedCount = Object.values(rows).filter(r => r.status === 'confirmed').length
  const filledCount = Object.values(rows).filter(r => r.score !== '').length

  const periodLabel = GRADING_PERIOD_LABELS[period.code as keyof typeof GRADING_PERIOD_LABELS] ?? period.name
  const shiftLabel = SHIFT_LABELS[section.shift as keyof typeof SHIFT_LABELS]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/calificaciones" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-slate-800">{subject.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{section.year_level}° {section.division} · {shiftLabel}</span>
            <span>·</span>
            <span>{section.modalities?.name}</span>
            {section.orientations?.name && (
              <>
                <span>·</span>
                <span>{section.orientations.name}</span>
              </>
            )}
            <span>·</span>
            <span className="font-medium text-slate-700">{periodLabel}</span>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPeriodClosed ? (
            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg text-sm">
              <Lock className="w-4 h-4" />
              Período cerrado
            </div>
          ) : (
            <>
              <button
                onClick={() => saveGrades(false)}
                disabled={saving || dirtyCount === 0}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'border border-slate-300 text-slate-700 hover:bg-slate-100',
                  (saving || dirtyCount === 0) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar borrador
                {dirtyCount > 0 && <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{dirtyCount}</span>}
              </button>

              <button
                onClick={async () => {
                  if (window.confirm(`¿Confirmás la carga definitiva de ${filledCount} calificaciones para ${periodLabel}? Esta acción no podrá revertirse sin autorización.`)) {
                    setConfirming(true)
                    await saveGrades(true)
                    setConfirming(false)
                  }
                }}
                disabled={saving || confirming || filledCount === 0}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-blue-700 hover:bg-blue-800 text-white',
                  (saving || confirming || filledCount === 0) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar carga
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save feedback */}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Calificaciones guardadas correctamente.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Hubo errores al guardar. Verificá las notas ingresadas.
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm">
        <span className="text-slate-500">
          <span className="font-semibold text-slate-700">{enrollments.length}</span> alumnos
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">
          <span className="font-semibold text-emerald-600">{filledCount}</span> con nota
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">
          <span className="font-semibold text-blue-600">{confirmedCount}</span> confirmadas
        </span>
        {dirtyCount > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-amber-600 font-medium">{dirtyCount} sin guardar</span>
          </>
        )}
      </div>

      {/* Grade table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-slate-600 font-medium w-10">#</th>
                <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Apellido y Nombre</th>
                <th className="text-left px-4 py-2.5 text-slate-600 font-medium w-20">DNI</th>
                <th className="text-center px-4 py-2.5 text-slate-600 font-medium w-28">
                  Nota
                  <span className="block text-xs font-normal text-slate-400">(1-10)</span>
                </th>
                <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Observación</th>
                <th className="text-center px-4 py-2.5 text-slate-600 font-medium w-24">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((enrollment, idx) => {
                const row = rows[enrollment.id]
                const student = enrollment.students
                const isConfirmed = row?.status === 'confirmed'
                const scoreVal = row?.score ? parseFloat(row.score.replace(',', '.')) : null
                const isInvalid = row?.score !== '' && (scoreVal === null || isNaN(scoreVal) || scoreVal < 1 || scoreVal > 10)
                const isLow = scoreVal !== null && scoreVal < 6

                return (
                  <tr key={enrollment.id} className={cn('hover:bg-slate-50', row?.isDirty && 'bg-amber-50/40')}>
                    <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                      {enrollment.enrollment_number ?? idx + 1}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {student?.full_name ?? 'Sin nombre'}
                    </td>
                    <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                      {student?.dni}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row?.score ?? ''}
                        onChange={e => updateScore(enrollment.id, e.target.value)}
                        disabled={isPeriodClosed || isConfirmed}
                        placeholder="—"
                        className={cn(
                          'w-full text-center px-2 py-1.5 border rounded-lg text-sm font-mono transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-blue-400',
                          isInvalid && 'border-red-400 bg-red-50 text-red-700',
                          !isInvalid && isLow && scoreVal !== null && 'text-red-600 font-semibold',
                          !isInvalid && !isLow && scoreVal !== null && 'text-emerald-700 font-semibold',
                          (isPeriodClosed || isConfirmed) && 'bg-slate-50 cursor-not-allowed border-slate-200'
                        )}
                      />
                      {isInvalid && (
                        <p className="text-xs text-red-500 mt-0.5 text-center">Inválido</p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row?.observation ?? ''}
                        onChange={e => updateObs(enrollment.id, e.target.value)}
                        disabled={isPeriodClosed || isConfirmed}
                        placeholder="Opcional..."
                        maxLength={200}
                        className={cn(
                          'w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600',
                          'focus:outline-none focus:ring-2 focus:ring-blue-400',
                          (isPeriodClosed || isConfirmed) && 'bg-slate-50 cursor-not-allowed'
                        )}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isConfirmed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Confirmada
                        </span>
                      ) : row?.isDirty ? (
                        <span className="text-xs text-amber-600 font-medium">Sin guardar</span>
                      ) : row?.gradeId ? (
                        <span className="text-xs text-slate-400">Borrador</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help text */}
      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Guardá como borrador para conservar los cambios sin confirmar.
          Una vez que confirmes la carga, las notas no podrán modificarse sin autorización institucional.
          Las notas inferiores a 6 se resaltan en rojo.
        </span>
      </div>
    </div>
  )
}
