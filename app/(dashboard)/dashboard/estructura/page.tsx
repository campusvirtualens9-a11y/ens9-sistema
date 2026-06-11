import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type Props = {
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { key: 'modalidades', label: 'Modalidades y orientaciones' },
  { key: 'materias',    label: 'Materias' },
  { key: 'secciones',  label: 'Secciones' },
]

const SHIFT: Record<string, string> = {
  morning: 'Mañana', afternoon: 'Tarde', evening: 'Noche',
}

export default async function EstructuraPage({ searchParams }: Props) {
  const { tab = 'modalidades' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || roleData.role !== 'admin') redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('id, year, label')
    .eq('is_current', true)
    .single()

  let content: React.ReactNode = null

  if (tab === 'modalidades') {
    const [{ data: modalities }, { data: orientations }] = await Promise.all([
      supabase.from('modalities').select('id, code, name, max_year').order('name'),
      supabase.from('orientations').select('id, modality_id, code, name, min_year, max_year').order('name'),
    ])

    content = (
      <div className="space-y-4">
        {modalities?.map(mod => {
          const ors = (orientations ?? []).filter(o => o.modality_id === mod.id)
          return (
            <div key={mod.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{mod.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Código: {mod.code} · Hasta {mod.max_year}° año</p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                  {ors.length} orientación(es)
                </span>
              </div>
              {ors.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {ors.map(o => (
                    <div key={o.id} className="px-5 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{o.name}</p>
                        <p className="text-xs text-slate-400">{o.code}</p>
                      </div>
                      <p className="text-xs text-slate-400">{o.min_year}° a {o.max_year}° año</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (tab === 'materias') {
    const { data: subjects } = await supabase
      .from('subjects')
      .select(`id, name, year_level, is_active, orientations(name), modalities(name)`)
      .order('year_level', { nullsFirst: false })
      .order('name')

    // Group by orientation/modality
    const grouped = new Map<string, typeof subjects>()
    for (const s of subjects ?? []) {
      const key = (s.orientations as any)?.name ?? (s.modalities as any)?.name ?? 'General'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(s)
    }

    content = (
      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([group, subs]) => (
          <div key={group} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p className="font-semibold text-slate-700">{group}</p>
              <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                {subs?.length ?? 0} materias
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {subs?.map((s: any) => (
                <div key={s.id} className={cn('px-4 py-2.5 flex items-center justify-between', !s.is_active && 'opacity-50')}>
                  <p className="text-sm text-slate-700">{s.name}</p>
                  <div className="flex items-center gap-3">
                    {s.year_level && <span className="text-xs text-slate-400">{s.year_level}° año</span>}
                    {!s.is_active && <span className="text-xs text-red-500 font-medium">Inactiva</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'secciones') {
    const { data: sections } = await supabase
      .from('course_sections')
      .select(`id, year_level, division, shift, is_active, modalities(name), orientations(name)`)
      .eq('academic_year_id', currentYear?.id ?? '')
      .order('year_level')
      .order('division')

    // Count students per section
    const { data: enrollmentCounts } = await supabase
      .from('student_enrollments')
      .select('course_section_id')
      .eq('academic_year_id', currentYear?.id ?? '')
      .eq('is_active', true)

    const countBySection: Record<string, number> = {}
    for (const e of enrollmentCounts ?? []) {
      countBySection[e.course_section_id] = (countBySection[e.course_section_id] ?? 0) + 1
    }

    content = (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!sections?.length ? (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">
            No hay secciones para el ciclo lectivo actual
            {currentYear ? ` (${currentYear.label})` : ''}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Sección</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Modalidad</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Orientación</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Turno</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Alumnos</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-bold text-slate-800">{s.year_level}° {s.division}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.modalities?.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{s.orientations?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{SHIFT[s.shift] ?? s.shift}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                    {countBySection[s.id] ?? 0}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    )}>
                      {s.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Estructura Académica</h1>
        <p className="text-slate-500 text-sm mt-1">
          Modalidades, orientaciones, materias y secciones de la institución.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/dashboard/estructura?tab=${t.key}`}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  )
}
