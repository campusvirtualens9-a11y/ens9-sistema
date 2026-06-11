import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserCheck, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  active:   { label: 'Activo',    color: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  pending:  { label: 'Pendiente', color: 'bg-amber-100 text-amber-700',     Icon: Clock },
  inactive: { label: 'Inactivo',  color: 'bg-red-100 text-red-700',         Icon: XCircle },
}

export default async function DocentesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || !['admin', 'directivo'].includes(roleData.role)) redirect('/dashboard')

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, dni, full_name, email, status, registration_code, created_at')
    .order('full_name')

  // For each teacher, count their active assignments in current year
  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('id')
    .eq('is_current', true)
    .single()

  const { data: assignments } = currentYear
    ? await supabase
        .from('teacher_assignments')
        .select('teacher_id')
        .eq('academic_year_id', currentYear.id)
        .eq('is_active', true)
    : { data: null }

  const assignmentsByTeacher: Record<string, number> = {}
  for (const a of assignments ?? []) {
    assignmentsByTeacher[a.teacher_id] = (assignmentsByTeacher[a.teacher_id] ?? 0) + 1
  }

  const pending = (teachers ?? []).filter(t => t.status === 'pending')
  const active = (teachers ?? []).filter(t => t.status === 'active')
  const inactive = (teachers ?? []).filter(t => t.status === 'inactive')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Docentes</h1>
        <p className="text-slate-500 text-sm mt-1">
          {active.length} activo(s) · {pending.length} pendiente(s) · {inactive.length} inactivo(s)
        </p>
      </div>

      {/* Pending alert */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {pending.length} solicitud(es) de vinculación pendiente(s)
            </p>
          </div>
          <div className="space-y-2">
            {pending.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-amber-200">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t.full_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    DNI: {t.dni}
                    {t.email && ` · ${t.email}`}
                    {t.registration_code && ` · Cód: ${t.registration_code}`}
                  </p>
                </div>
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  Pendiente de vinculación
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-3 border-t border-amber-200 pt-2">
            Para aprobar: verificá el DNI en el legajo físico y actualizá el estado del docente a "Activo" desde la base de datos.
          </p>
        </div>
      )}

      {/* Teachers table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!teachers?.length ? (
          <div className="px-4 py-12 text-center">
            <UserCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No hay docentes registrados.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Docente</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-28">DNI</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Email</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium w-24">Asig.</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-28">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map(t => {
                const st = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.inactive
                const assignCount = assignmentsByTeacher[t.id] ?? 0
                return (
                  <tr key={t.id} className={cn('hover:bg-slate-50', t.status === 'pending' && 'bg-amber-50/30')}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{t.full_name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{t.dni}</td>
                    <td className="px-4 py-2.5 text-slate-500">{t.email ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right">
                      {assignCount > 0 ? (
                        <span className="font-mono text-slate-600">{assignCount}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', st.color)}>
                        <st.Icon className="w-3 h-3" />
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
