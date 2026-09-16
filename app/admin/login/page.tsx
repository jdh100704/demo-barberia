'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setCargando(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#171310] text-[#F1E9DD] flex items-center justify-center p-4">
      <form
        onSubmit={handleLogin}
        className="bg-[#221C17] border border-[#3A312A] p-8 rounded-2xl w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center mb-2">Panel del negocio</h1>
        <p className="text-[#B3A493] text-sm text-center mb-6">Inicia sesión para ver tus reservas</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-[#171310] border border-[#3A312A] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A4A]"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full bg-[#171310] border border-[#3A312A] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C99A4A]"
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-[#C99A4A] hover:opacity-90 text-[#171310] font-bold py-2.5 rounded-xl transition"
        >
          {cargando ? 'Entrando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}