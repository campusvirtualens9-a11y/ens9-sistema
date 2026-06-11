import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  BookMarked, ClipboardList, GraduationCap, UserCheck,
  CalendarDays, BarChart3, Archive, FileText, Upload, Users,
  CheckCircle2, Clock, AlertCircle, Lock
} from 'lucide-react'
import Link from 'next/link'
import type { AppRole } from '@/types/database'
import { ROLE_LABELS, SHIFT_LABELS } from '@/types/database'
import { cn } from '@/lib/utils/cn'

type DashboardCard = {
  label: string
  description: string
  href: string
  icon: React.ReactNode
  color: string
  roles: AppRole[]
  badge?: string
  badgeColor?: string
}

const CARDS: DashboardCard[] = [
  {
    label: 'Mis cursos',
    description: 'Ver cursos y materias asignados',
    href: '/dashboard/mis-cursos',
    icon: <BookMarked className="w-6 h-6" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    roles: ['docente'],
  },
  {
    label: 'Cargar calificaciones',
    description: 'Ingresar notas del período actual',
    href: '/dashboard/calificaciones/cargar',
    icon: <ClipboardList className="w-6 h-6" />,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    roles: ['docente'],
  },
  {
    label: 'Calificaciones',
    description: 'Ver estado de carga por curso y materia',
    href: '/dashboard/calificaciones',
    icon: <ClipboardList className="w-6 h-6" />,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    roles: ['admin', 'directivo', 'preceptor'],
  },
  {
    label: 'Estudiantes',
    description: 'Gestionar estudiantes y matrículas',
    href: '/dashboard/estudiantes',
    icon: <GraduationCap className="w-6 h-6" />,
    color: 'bg-violet-50 text-violet-600 border-violet-200',
    roles: ['admin', 'directivo', 'preceptor'],
  },
  {
    label: 'Docentes',
    description: 'Gestionar docentes y asignaciones',
    href: '/dashboard/docentes',
    icon: <UserCheck className="w-6 h-6" />,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    roles: ['admin', 'directivo'],
  },
  {
    label: 'Ciclos lectivos',
    description: 'Administrar años y períodos de evaluación',
    href: '/dashboard/ciclos',
    icon: <CalendarDays className="w-6 h-6" />,
    color: 'bg-sky-50 text-sky-600 border-sky-200',
    roles: ['admin', 'directivo'],
  },
  {
    label: 'Libro Matriz',
    description: 'Trayectoria académica de cada estudiante',
    href: '/dashboard/libro-matriz',
    icon: <Archive className="w-6 h-6" />,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    roles: ['admin', 'directivo', 'preceptor'],
  },
  {
    label: 'Mesas de examen',
    description: 'Previas, equivalencias y complementarias',
    href: '/dashboard/mesas',
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    roles: ['admin', 'directivo', 'preceptor'],
  },
  {
    label: 'Reportes',
    description: 'Exportar planillas y estadísticas',
    href: '/dashboard/reportes',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    roles: ['admin', 'directivo', 'preceptor'],
  },
  {
    label: 'Importaciones',
    description: 'Cargar datos desde Excel',
    href: '/dashboard/importaciones',
    icon: <Upload className="w-6 h-6" />,
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    roles: ['admin'],
  },
  {
    label: 'Usuarios',
    description: 'Gestionar cuentas y roles del sistema',
    href: '/dashboard/usuarios',
    icon: <Users className="w-6 h-6" />,
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    roles: ['admin'],
  },
  {
    label: 'Estructura académica',
    description: 'Materias, cursos, divisiones, turnos',
    href: '/dashboard/estructura',
    icon: <BookMarked className="w-6 h-6" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    roles: ['admin'],
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = (roleData?.role ?? 'docente') as AppRole

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const cards = CARDS.filter(c => c.roles.includes(role))
  const firstName = (profile?.full_name ?? user.email ?? '').split(' ')[0]

  const [{ count: studentCount }, { count: teacherCount }, { data: currentYear }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('academic_years').select('year, label').eq('is_current', true).single(),
  ])

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Bienvenido, {firstName}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {ROLE_LABELS[role]} · Sistema Académico ENS N°9
          </p>
          {currentYear && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
              <CalendarDays className="w-3.5 h-3.5" />
              Ciclo lectivo {currentYear.label}
            </span>
          )}
          {!currentYear && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" />
              Sin ciclo lectivo activo
            </span>
          )}
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats row (admin/directivo) */}
      {(role === 'admin' || role === 'directivo') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<GraduationCap className="w-5 h-5" />}
            label="Estudiantes activos"
            value={studentCount ?? 0}
            color="text-violet-600 bg-violet-50"
          />
          <StatCard
            icon={<UserCheck className="w-5 h-5" />}
            label="Docentes activos"
            value={teacherCount ?? 0}
            color="text-amber-600 bg-amber-50"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Períodos abiertos"
            value="—"
            color="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            icon={<Lock className="w-5 h-5" />}
            label="Períodos cerrados"
            value="—"
            color="text-slate-500 bg-slate-100"
          />
        </div>
      )}

      {/* Navigation cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                'group flex items-start gap-4 p-4 bg-white rounded-xl border transition-all duration-200',
                'hover:shadow-md hover:-translate-y-0.5',
                'border-slate-200'
              )}
            >
              <div className={cn('p-2 rounded-lg border flex-shrink-0', card.color)}>
                {card.icon}
              </div>
              <div className="overflow-hidden">
                <p className="font-semibold text-slate-700 text-sm group-hover:text-blue-700 transition-colors">
                  {card.label}
                </p>
                <p className="text-slate-400 text-xs mt-0.5 leading-snug">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Setup notice for admin when no academic year configured */}
      {role === 'admin' && !currentYear && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium text-sm">Configuración inicial requerida</p>
            <p className="text-amber-700 text-sm mt-1">
              No hay un ciclo lectivo activo. Para comenzar a usar el sistema, ve a{' '}
              <Link href="/dashboard/ciclos" className="underline font-medium">Ciclos lectivos</Link>{' '}
              y configurá el año escolar 2026.
            </p>
            <p className="text-amber-600 text-xs mt-2">
              También podés ir a <Link href="/dashboard/importaciones" className="underline">Importaciones</Link>{' '}
              para cargar los datos iniciales desde las planillas Excel.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, color
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', color)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-slate-500 text-xs mt-0.5">{label}</p>
      </div>
    </div>
  )
}
