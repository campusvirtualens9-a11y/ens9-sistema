import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'

const PERIOD_STATUS: Record<string, { label: string; color: string }> = {
  open:   { label: 'Abierto',  color: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Cerrado',  color: 'bg-slate-100 text-slate-500' },
  draft:  { label: 'Borrador', color: 'bg-amber-50 text-amber-600' },
}

export default async function CiclosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || !['admin', 'directivo'].includes(roleData.role)) redirect('/dashboard')

  const [
    { data: years },
    { data: sectionCounts },
    { data: enrollmentCounts },
  ] = await Promise.all([
    supabase.from('academic_years').select('id, year, label, is_current, start_date, end_date').order('year', { ascending: false }),
    supabase.from('course_sections').select('academic_year_id'),
    supabase.from('student_enrollments').select('academic_year_id').eq('is_active', true),
  ])

  const countByYear = (arr: any[]) => {
    const map: Record<string, number> = {}
    for (const item of arr ?? []) {
      const k = item.academic_year_id
      map[k] = (map[k] ?? 0) + 1
    }
    return map
  }

  const sectionsByYear = countByYear(sectionCounts ?? [])
  const enrollmentsByYear = countByYear(enrollmentCounts ?? [])

  const currentYear = years?.find(y => y.is_current)

  // Fetch periods for current year
  const { data: periods } = currentYear
    ? await supabase
        .from('grading_periods')
        .select('id, code, label, status, order_index')
        .eq('academic_year_id', currentYear.id)
        .order('order_index')
    : { data: null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Ciclos Lectivos</h1>
        <p className="text-slate-500 text-sm mt-1">
          Años académicos de la institución.
        </p>
      </div>

      <div className="space-y-3">
        {!years?.length ? (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-12 text-center text-slate-400 text-sm">
            No hay ciclos lectivos configurados.
          </div>
        ) : years.map(y => (
          <div
            key={y.id}
            className={cn(
              'bg-white rounded-xl border overflow-hidden',
              y.is_current ? 'border-blue-300 shadow-sm' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-xl text-xl font-bold tabular-nums',
                  y.is_current ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                )}>
                  {String(y.year).slice(-2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800">{y.label}</p>
                    {y.is_current && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Actual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {y.start_date ? formatDate(y.start_date) : 'Inicio no definido'}
                    {' — '}
                    {y.end_date ? formatDate(y.end_date) : 'Fin no definido'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-semibold text-slate-700 tabular-nums">{sectionsByYear[y.id] ?? 0}</p>
                  <p className="text-xs text-slate-400">secciones</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-700 tabular-nums">{enrollmentsByYear[y.id] ?? 0}</p>
                  <p className="text-xs text-slate-400">alumnos</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Periods for current year */}
      {currentYear && periods && periods.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Períodos de evaluación — {currentYear.label}
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Período</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Código</th>
                  <th className="text-left px-4 py-2.5 text-slate-600 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map(p => {
                  const st = PERIOD_STATUS[p.status] ?? { label: p.status, color: 'bg-slate-100 text-slate-500' }
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{p.label}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{p.code}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', st.color)}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
