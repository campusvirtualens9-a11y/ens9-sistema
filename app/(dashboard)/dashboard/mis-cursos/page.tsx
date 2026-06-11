import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookMarked, ChevronRight, Lock, ClipboardList, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
}

const PERIOD_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  closed: 'Cerrado',
  draft: 'Borrador',
}

export default async function MisCursosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, full_name, status')
    .eq('user_id', user.id)
    .single()

  if (!teacher) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookMarked className="w-10 h-10 text-slate-300 mb-3" />
        <p className="font-medium text-slate-600">Perfil docente no vinculado</p>
        <p className="text-slate-400 text-sm mt-1">Tu cuenta no está vinculada a un docente del sistema. Contactá a la administración.</p>
      </div>
    )
  }

  if (teacher.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock className="w-10 h-10 text-amber-400 mb-3" />
        <p className="font-medium text-slate-700">Cuenta pendiente de aprobación</p>
        <p className="text-slate-500 text-sm mt-1">Un administrador debe vincular tu cuenta con tu legajo docente.</p>
      </div>
    )
  }

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('id, year, label')
    .eq('is_current', true)
    .single()

  const { data: assignments } = await supabase
    .from('teacher_assignments')
    .select(`
      id, is_active,
      course_sections (id, year_level, division, shift, modalities(name), orientations(name)),
      subjects (id, name)
    `)
    .eq('teacher_id', teacher.id)
    .eq('is_active', true)
    .eq('academic_year_id', currentYear?.id ?? '')

  const { data: periods } = await supabase
    .from('grading_periods')
    .select('id, code, label, status, order_index')
    .eq('academic_year_id', currentYear?.id ?? '')
    .order('order_index')

  const openPeriod = periods?.find(p => p.status === 'open')

  // Group assignments by section
  const sectionMap = new Map<string, { section: any; subjects: any[] }>()
  for (const a of assignments ?? []) {
    const sec = a.course_sections as any
    if (!sec) continue
    if (!sectionMap.has(sec.id)) {
      sectionMap.set(sec.id, { section: sec, subjects: [] })
    }
    sectionMap.get(sec.id)!.subjects.push({
      assignmentId: a.id,
      ...(a.subjects as any),
    })
  }

  const sections = Array.from(sectionMap.values()).sort((a, b) => {
    const diff = a.section.year_level - b.section.year_level
    if (diff !== 0) return diff
    return a.section.division.localeCompare(b.section.division)
  })

  if (!currentYear) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          No hay un ciclo lectivo activo configurado. Contactá al administrador.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mis Cursos</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ciclo lectivo {currentYear.label} · {sections.length} sección(es) asignada(s)
        </p>
      </div>

      {/* Period status pills */}
      {periods && periods.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Períodos:</span>
          {periods.map(p => (
            <span
              key={p.id}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                p.status === 'open' && 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300',
                p.status === 'closed' && 'bg-slate-100 text-slate-500',
                p.status === 'draft' && 'bg-slate-50 text-slate-400 border border-slate-200',
              )}
            >
              {p.label}
              {p.status === 'open' && ' ✓'}
              {p.status === 'closed' && ' (cerrado)'}
            </span>
          ))}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <BookMarked className="w-10 h-10 text-slate-200 mb-3" />
          <p className="font-medium text-slate-500">Sin asignaciones para este ciclo</p>
          <p className="text-slate-400 text-xs mt-1">Contactá al administrador para verificar tus asignaciones.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map(({ section, subjects }) => {
            const modality = (section.modalities as any)?.name ?? ''
            const orientation = (section.orientations as any)?.name
            const shift = SHIFT_LABELS[section.shift as string] ?? section.shift

            return (
              <div key={section.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 text-base">
                      {section.year_level}° {section.division}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {modality}
                      {orientation ? ` · ${orientation}` : ''}
                      {' · Turno '}{shift}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    {subjects.length} mat.
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {subjects.map((subj: any) => (
                    <div key={subj.assignmentId} className="flex items-center justify-between px-4 py-3 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <ClipboardList className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{subj.name}</span>
                      </div>
                      {openPeriod ? (
                        <Link
                          href={`/dashboard/calificaciones/cargar?assignment=${subj.assignmentId}&period=${openPeriod.id}`}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 flex-shrink-0 ml-2"
                        >
                          Cargar notas
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-300 flex-shrink-0 ml-2">
                          <Lock className="w-3 h-3" />
                          Sin período
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
