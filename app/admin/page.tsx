'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Check, LogOut, Clock, Scissors } from 'lucide-react'

interface ServicioReserva {
  nombre: string
  precio: number
}

interface Reserva {
  id: string
  nombre_cliente: string
  telefono: string
  email: string | null
  notas: string | null
  servicios: ServicioReserva[]
  barbero: string
  fecha: string
  hora: string
  total: number
  duracion_min: number
  estado: string
  creado_en: string
}

export default function AdminPanel() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [cargando, setCargando] = useState(true)
  const [sesionLista, setSesionLista] = useState(false)
  const router = useRouter()

  // Comprueba sesión, igual que en FlowTask
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/admin/login')
      } else {
        setSesionLista(true)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/admin/login')
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetchReservas()
  }, [])

  async function fetchReservas() {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .order('creado_en', { ascending: false }) // las más recientes primero

    if (error) {
      console.error('Error al cargar reservas:', error)
    } else if (data) {
      setReservas(data as Reserva[])
    }
    setCargando(false)
  }

  const marcarAtendida = async (id: string) => {
    setReservas((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado: 'atendida' } : r))
    )

    const { error } = await supabase
      .from('reservas')
      .update({ estado: 'atendida' })
      .eq('id', id)

    if (error) {
      console.error('Error al actualizar reserva:', error)
      fetchReservas() // revertir si falla
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (cargando || !sesionLista) {
    return (
      <div className="min-h-screen bg-[#171310] text-[#F1E9DD] flex items-center justify-center">
        <p className="text-[#B3A493] animate-pulse">Cargando reservas...</p>
      </div>
    )
  }

  const pendientes = reservas.filter((r) => r.estado !== 'atendida')
  const atendidas = reservas.filter((r) => r.estado === 'atendida')

  return (
    <div className="min-h-screen bg-[#171310] text-[#F1E9DD] p-6 sm:p-10">
      <header className="max-w-4xl mx-auto mb-8 flex items-center justify-between border-b border-[#3A312A] pb-6">
        <div>
          <h1 className="text-2xl font-bold">Panel de reservas</h1>
          <p className="text-[#B3A493] text-sm mt-1">{pendientes.length} pendientes · {atendidas.length} atendidas</p>
        </div>
        <button
          onClick={cerrarSesion}
          className="flex items-center gap-2 text-sm text-[#B3A493] hover:text-red-400 transition border border-[#3A312A] rounded-lg px-3 py-1.5"
        >
          <LogOut size={14} /> Salir
        </button>
      </header>

      <main className="max-w-4xl mx-auto space-y-3">
        {reservas.length === 0 && (
          <p className="text-[#B3A493] text-sm text-center py-10">Aún no hay ninguna reserva.</p>
        )}

        {reservas.map((r) => (
          <div
            key={r.id}
            className={`border rounded-xl p-4 ${
              r.estado === 'atendida' ? 'bg-[#1A1712] border-[#2A241D] opacity-60' : 'bg-[#221C17] border-[#3A312A]'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{r.nombre_cliente}</p>
                <p className="text-xs text-[#B3A493]">{r.telefono}{r.email ? ` · ${r.email}` : ''}</p>
              </div>
              {r.estado !== 'atendida' && (
                <button
                  onClick={() => marcarAtendida(r.id)}
                  className="flex items-center gap-1.5 text-xs bg-[#C99A4A] text-[#171310] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                  <Check size={13} /> Marcar atendida
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-[#B3A493]">
              <span className="flex items-center gap-1"><Clock size={12} /> {r.fecha} · {r.hora}</span>
              <span>{r.barbero}</span>
              <span>{r.duracion_min} min</span>
            </div>

            <div className="mt-3 flex items-start gap-1.5">
              <Scissors size={13} className="mt-0.5 text-[#B3A493] flex-shrink-0" />
              <p className="text-sm">
                {r.servicios.map((s) => s.nombre).join(', ')}
                <span className="text-[#C99A4A] font-semibold ml-2">{r.total.toFixed(2)}€</span>
              </p>
            </div>

            {r.notas && <p className="text-xs text-[#B3A493] mt-2 italic">"{r.notas}"</p>}
          </div>
        ))}
      </main>
    </div>
  )
}