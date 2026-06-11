import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Props = {
  searchParams: Promise<{ q?: string; section_id?: string }>
}

const STUDENT_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activo',    color: 'bg-emerald-100 text-emerald-700' },
  inactive:  { label: 'Inactivo',  color: 'bg-red-100 text-red-700' },
  graduated: { label: 'Egresado',  color: 'bg-blue-100 text-blue-700' },
  withdrawn: { label: 'Retirado',  color: 'bg-slate-100 text-slate-500' },
}

export default async function EstudiantesPage({ searchParams }: Props) {
  const { q, section_id } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || !['admin', 'directivo', 'preceptor'].includes(roleData.role)) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('id, year')
    .eq('is_current', true)
    .single()

  // Sections for filter dropdown
  const { data: sections } = await supabase
    .from('course_sections')
    .select('id, year_level, division, shift')
    .eq('academic_year_id', currentYear?.id ?? '')
    .eq('is_active', true)
    .order('year_level')
    .order('division')

  // Enrollments with student and section info
  let query = supabase
    .from('student_enrollments')
    .select(`
      id, enrollment_number, is_active,
      students (id, dni, full_name, status),
      course_sections (id, year_level, division)
    `)
    .eq('academic_year_id', currentYear?.id ?? '')
    .eq('is_active', true)
    .order('enrollment_number')
    .limit(300)

  if (section_id) {
    query = query.eq('course_section_id', section_id) as typeof query
  }

  const { data: enrollments } = await query

  // Client-side search filter (server-side would need full-text index)
  const searchLower = q?.toLowerCase().trim()
  const filtered = searchLower
    ? (enrollments ?? []).filter((e: any) => {
        const s = e.students as any
        return (
          s?.full_name?.toLowerCase().includes(searchLower) ||
          s?.dni?.includes(searchLower)
        )
      })
    : (enrollments ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Estudiantes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ciclo {currentYear?.year ?? '—'} · {filtered.length} estudiante(s)
          {q || section_id ? ' (filtrado)' : ''}
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o DNI..."
          className="flex-1 min-w-[220px] max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        <select
          name="section_id"
          defaultValue={section_id}
          className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Todas las secciones</option>
          {sections?.map(s => (
            <option key={s.id} value={s.id}>
              {s.year_level}° {s.division}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          Buscar
        </button>
        {(q || section_id) && (
          <a href="/dashboard/estudiantes" className="text-sm text-slate-400 hover:text-slate-600">
            Limpiar filtros
          </a>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!filtered.length ? (
          <div className="px-4 py-14 text-center">
            <GraduationCap className="w-9 h-9 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">
              {q || section_id ? 'No se encontraron estudiantes con ese filtro.' : 'No hay estudiantes registrados para este ciclo.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-20"># Legajo</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Apellido y Nombre</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-28">DNI</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-24">Sección</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-24">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e: any) => {
                const student = e.students as any
                const sec = e.course_sections as any
                const st = STUDENT_STATUS[student?.status] ?? { label: student?.status, color: 'bg-slate-100 text-slate-500' }
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-400 text-xs">{e.enrollment_number ?? '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{student?.full_name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{student?.dni}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {sec ? `${sec.year_level}° ${sec.division}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', st.color)}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
