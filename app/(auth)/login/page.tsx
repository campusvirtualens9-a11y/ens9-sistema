'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Correo o contraseña incorrectos. Verificá tus datos e intentá nuevamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Ingresá tu correo electrónico para recuperar la contraseña.')
      return
    }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError('No se pudo enviar el correo. Verificá la dirección ingresada.')
    } else {
      setError(null)
      alert('Se envió un correo con las instrucciones para restablecer tu contraseña.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-800 to-slate-900">
      {/* Header institucional */}
      <header className="bg-white/5 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image
              src="/images/logo-institucional.png"
              alt="Logo ENS N°9"
              fill
              className="object-contain"
            />
          </div>
          <div>
            <p className="text-white text-xs font-medium leading-tight">
              Provincia de Misiones · Consejo General de Educación
            </p>
            <p className="text-slate-300 text-xs leading-tight">
              Escuela Normal Superior N°9 Juan XXIII — Wanda, Misiones
            </p>
          </div>
        </div>
      </header>

      {/* Contenido central */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card de login */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Banner superior */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-8 pt-8 pb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-14 h-14 flex-shrink-0 bg-white rounded-full p-1">
                  <Image
                    src="/images/logo-institucional.png"
                    alt="Logo ENS N°9"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-tight">
                    Sistema Académico
                  </h1>
                  <p className="text-blue-200 text-sm">ENS N°9 — Juan XXIII</p>
                </div>
              </div>
              <p className="text-blue-100 text-sm">
                Registro Académico Digital
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleLogin} className="px-8 py-6 space-y-5">
              <h2 className="text-slate-700 font-semibold text-lg">Iniciar sesión</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 px-4',
                  'bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg',
                  'transition-colors duration-200',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Olvidé mi contraseña
                </button>
                <Link
                  href="/register"
                  className="text-slate-500 hover:text-slate-700 hover:underline"
                >
                  Soy docente →
                </Link>
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-400 text-xs mt-6">
            © {new Date().getFullYear()} Escuela Normal Superior N°9 · Wanda, Misiones
          </p>
        </div>
      </div>
    </div>
  )
}
