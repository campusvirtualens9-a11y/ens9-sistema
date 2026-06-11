'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, ClipboardList,
  FileText, Settings, ChevronLeft, ChevronRight, BookMarked,
  BarChart3, Upload, Shield, CalendarDays, UserCheck, Archive
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AppRole } from '@/types/database'

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  roles: AppRole[]
  badge?: string
}

const navItems: NavItem[] = [
  {
    label: 'Panel principal',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['admin', 'directivo', 'preceptor', 'docente'],
  },
  // Gestión académica
  {
    label: 'Estructura académica',
    href: '/dashboard/estructura',
    icon: <BookOpen className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    label: 'Ciclos lectivos',
    href: '/dashboard/ciclos',
    icon: <CalendarDays className="w-5 h-5" />,
    roles: ['admin', 'directivo'],
  },
  {
    label: 'Estudiantes',
    href: '/dashboard/estudiantes',
    icon: <GraduationCap className="w-5 h-5" />,
    roles: ['admin', 'directivo', 'preceptor'],
  },
  {
    label: 'Docentes',
    href: '/dashboard/docentes',
    icon: <UserCheck className="w-5 h-5" />,
    roles: ['admin', 'directivo'],
  },
  // Calificaciones
  {
    label: 'Mis cursos',
    href: '/dashboard/mis-cursos',
    icon: <BookMarked className="w-5 h-5" />,
    roles: ['docente'],
  },
  {
    label: 'Calificaciones',
    href: '/dashboard/calificaciones',
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ['admin', 'directivo', 'preceptor', 'docente'],
  },
  // Libro Matriz
  {
    label: 'Libro Matriz',
    href: '/dashboard/libro-matriz',
    icon: <Archive className="w-5 h-5" />,
    roles: ['admin', 'directivo', 'preceptor'],
  },
  // Mesas de examen
  {
    label: 'Mesas de examen',
    href: '/dashboard/mesas',
    icon: <FileText className="w-5 h-5" />,
    roles: ['admin', 'directivo', 'preceptor'],
  },
  // Reportes
  {
    label: 'Reportes',
    href: '/dashboard/reportes',
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ['admin', 'directivo', 'preceptor'],
  },
  // Admin
  {
    label: 'Importaciones',
    href: '/dashboard/importaciones',
    icon: <Upload className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    label: 'Usuarios',
    href: '/dashboard/usuarios',
    icon: <Users className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    label: 'Auditoría',
    href: '/dashboard/auditoria',
    icon: <Shield className="w-5 h-5" />,
    roles: ['admin', 'directivo'],
  },
  {
    label: 'Configuración',
    href: '/dashboard/configuracion',
    icon: <Settings className="w-5 h-5" />,
    roles: ['admin'],
  },
]

type Props = {
  role: AppRole
}

export default function Sidebar({ role }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter(item => item.roles.includes(role))

  return (
    <aside
      className={cn(
        'flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out h-full flex-shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-4 border-b border-slate-700/50',
        collapsed && 'justify-center px-2'
      )}>
        <div className="relative w-9 h-9 flex-shrink-0 bg-white rounded-lg p-0.5">
          <Image
            src="/images/logo-institucional.png"
            alt="ENS N°9"
            fill
            className="object-contain p-0.5"
          />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white text-sm font-bold leading-tight truncate">ENS N°9</p>
            <p className="text-slate-400 text-xs truncate">Juan XXIII</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
                collapsed && 'justify-center px-2'
              )}
            >
              <span className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-700/50 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="ml-2 text-xs">Colapsar</span>}
        </button>
      </div>
    </aside>
  )
}
