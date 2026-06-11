'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS } from '@/types/database'
import type { AppRole } from '@/types/database'

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  directivo: 'bg-blue-100 text-blue-700',
  preceptor: 'bg-teal-100 text-teal-700',
  docente: 'bg-emerald-100 text-emerald-700',
}

type Props = {
  userName: string
  userEmail: string
  role: AppRole
}

export default function TopBar({ userName, userEmail, role }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <h2 className="text-slate-600 text-sm hidden md:block">
          Sistema Académico ENS N°9
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
          {ROLE_LABELS[role]}
        </span>

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials || <User className="w-4 h-4" />}
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-slate-700 leading-tight truncate max-w-[160px]">
              {userName}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-[160px]">{userEmail}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title="Cerrar sesión"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
