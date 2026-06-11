'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, UserPlus, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Step = 'form' | 'success' | 'pending'

export default function RegisterPage() {
  const supabase = createClient()

  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  const [form, setForm] = useState({
    fullName: '',
    dni: '',
    email: '',
    password: '',
    confirmPassword: '',
    invitationCode: '',
  })

  function handleChange(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!/^\d{7,8}$/.test(form.dni.replace(/\D/g, ''))) {
      setError('El DNI debe tener entre 7 y 8 dígitos.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.toUpperCase().trim(),
          dni: form.dni.replace(/\D/g, ''),
          invitation_code: form.invitationCode.trim() || null,
          role: 'docente',
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('Ya existe una cuenta con ese correo electrónico.')
      } else {
        setError(`Error al registrarse: ${signUpError.message}`)
      }
      return
    }

    // Check if teacher was auto-linked or is pending
    if (data.user) {
      // The server trigger will handle linking logic
      setStep('success')
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Registro enviado</h2>
          <p className="text-slate-600 mb-2">
            Tu solicitud fue enviada correctamente.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Si tu DNI o código de invitación coincide con el padrón institucional, tu cuenta será activada en breve.
            De lo contrario, el administrador revisará tu solicitud y te notificará por correo.
          </p>
          <p className="text-slate-400 text-xs mb-6">
            Revisá tu casilla de correo para confirmar tu dirección de email.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-800 to-slate-900">
      <header className="bg-white/5 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image src="/images/logo-institucional.png" alt="Logo ENS N°9" fill className="object-contain" />
          </div>
          <div>
            <p className="text-white text-xs font-medium">Escuela Normal Superior N°9 Juan XXIII</p>
            <p className="text-slate-300 text-xs">Sistema Académico Digital — Registro Docente</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-8 py-6">
              <div className="flex items-center gap-3">
                <UserPlus className="w-6 h-6 text-blue-200" />
                <div>
                  <h1 className="text-white font-bold text-lg">Registro Docente</h1>
                  <p className="text-blue-200 text-sm">ENS N°9 — Sistema Académico</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRegister} className="px-8 py-6 space-y-4">
              <p className="text-slate-600 text-sm">
                Completá el formulario con tus datos institucionales. El sistema verificará tu identidad contra el padrón docente.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Apellido y nombre completo
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  placeholder="GARCÍA, JUAN MANUEL"
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">DNI</label>
                  <input
                    type="text"
                    value={form.dni}
                    onChange={handleChange('dni')}
                    placeholder="12345678"
                    required
                    maxLength={9}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Código de invitación
                    <span className="text-slate-400 font-normal"> (opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.invitationCode}
                    onChange={handleChange('invitationCode')}
                    placeholder="INV-XXXX"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Correo electrónico institucional</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="nombre@ejemplo.com"
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange('password')}
                      placeholder="Mín. 8 caracteres"
                      required
                      className="w-full px-3 py-2.5 pr-9 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Confirmar contraseña</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    placeholder="Repetir contraseña"
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 px-4',
                  'bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg',
                  'transition-colors duration-200 mt-2',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? 'Procesando...' : 'Solicitar registro'}
              </button>

              <p className="text-center text-sm text-slate-500">
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
