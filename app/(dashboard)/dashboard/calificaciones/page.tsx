import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Lock, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { PERIOD_STATUS_LABELS, GRADING_PERIOD_LABELS, SHIFT_LABELS } from '@/types/database'
import type { AppRole } from '@/types/database'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'

export default async function CalificacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  const role = (roleData?.role ?? 'docente') as AppRole

  // Get current academic year
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <AlertTriangle className="w-10 h-10 mb-3 text-amber-400" />
        <p className="font-medium text-slate-700">Sin ciclo lectivo activo</p>
        <p className="text-sm mt-1">Configurá un ciclo lectivo en la sección de administración.</p>
      </div>
    )
  }

  // Get grading periods
  const { data: periods } = await supabase
    .from('grading_periods')
    .select('*')
    .eq('academic_year_id', currentYear.id)
    .order('order_index')

  // For docente: get their assignments
  let assignments: any[] = []
  if (role === 'docente') {
    const { data: teacher } = await supabase
      .from('teachers').select('id').eq('user_id', user.id).single()

    if (teacher) {
      const { data } = await supabase
        .from('teacher_assignments')
        .select(`
          id, is_active,
          course_sections (year_level, division, shift),
          subjects (name)
        `)
        .eq('teacher_id', teacher.id)
        .eq('academic_year_id', currentYear.id)
        .eq('is_active', true)

      assignments = data ?? []
    }
  }

  // For admin/directivo: get all sections with grade counts
  let sectionStats: any[] = []
  if (role !== 'docente') {
    const { data } = await supabase
      .from('course_sections')
      .select(`
        id, year_level, division, shift,
        modalities (name, code),
        orientations (name, code)
      `)
      .eq('academic_year_id', currentYear.id)
      .eq('is_active', true)
      .order('year_level')
      .order('division')

    sectionStats = data ?? []
  }

  const periodStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'closed': return <Lock className="w-4 h-4 text-slate-400" />
      case 'under_review': return <Clock className="w-4 h-4 text-amber-500" />
      case 'reopened': return <AlertTriangle className="w-4 h-4 text-blue-500" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Calificaciones</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ciclo lectivo {currentYear.label}
        </p>
      </div>

      {/* Períodos de evaluación */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Períodos de evaluación
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {(periods ?? []).map(period => (
            <div
              key={period.id}
              className={cn(
                'bg-white rounded-xl border p-4',
                period.status === 'open' && 'border-emerald-200',
                period.status === 'closed' && 'border-slate-200 opacity-75',
                period.status === 'under_review' && 'border-amber-200',
                period.status === 'reopened' && 'border-blue-200',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">
                  {GRADING_PERIOD_LABELS[period.code as keyof typeof GRADING_PERIOD_LABELS]}
                </span>
                {periodStatusIcon(period.status)}
              </div>
              <p className={cn(
                'text-sm font-semibold',
                period.status === 'open' && 'text-emerald-700',
                period.status === 'closed' && 'text-slate-500',
                period.status === 'under_review' && 'text-amber-700',
                period.status === 'reopened' && 'text-blue-700',
              )}>
                {PERIOD_STATUS_LABELS[period.status as keyof typeof PERIOD_STATUS_LABELS]}
              </p>
              {period.close_date && (
                <p className="text-xs text-slate-400 mt-1">
                  Cierre: {formatDate(period.close_date)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vista docente: mis materias */}
      {role === 'docente' && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Mis materias
          </h2>
          {assignments.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-amber-800 font-medium text-sm">Sin materias asignadas</p>
              <p className="text-amber-600 text-sm mt-1">
                Tu cuenta aún no tiene materias asignadas para el ciclo lectivo actual.
                Contactá al administrador.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map((a: any) => {
                const section = a.course_sections
                const openPeriod = (periods ?? []).find(p => p.status === 'open')
                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/calificaciones/cargar?assignment=${a.id}&period=${openPeriod?.id ?? ''}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 group-hover:text-blue-700 text-sm">
                          {a.subjects?.name}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {section?.year_level}° {section?.division} · {SHIFT_LABELS[section?.shift as keyof typeof SHIFT_LABELS]}
                        </p>
                        {openPeriod ? (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Período abierto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" />
                            Sin período abierto
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista admin/directivo: secciones */}
      {role !== 'docente' && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Estado de carga por sección
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Sección</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Modalidad</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Orientación</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Turno</th>
                  <th className="text-center px-4 py-2.5 text-slate-600 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sectionStats.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {s.year_level}° {s.division}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {s.modalities?.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {s.orientations?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {SHIFT_LABELS[s.shift as keyof typeof SHIFT_LABELS]}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Link
                        href={`/dashboard/calificaciones/seccion/${s.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Ver notas
                      </Link>
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
