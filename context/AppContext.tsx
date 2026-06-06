"use client"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"

interface AppContextType {
  session: any
  userId: string | null
  iglesiaId: string | null
  nombreIglesia: string
  logoUrl: string
  localidad: string
  canciones: any[]
  cargandoCanciones: boolean
  errorCanciones: string | null
  recargarCanciones: () => Promise<void>
  actualizarCancion: (id: string) => Promise<void>
  eliminarCancionDelCache: (id: string) => void
  listo: boolean
}

const AppContext = createContext<AppContextType>({
  session: null, userId: null,
  iglesiaId: null, nombreIglesia: "", logoUrl: "", localidad: "",
  canciones: [], cargandoCanciones: false, errorCanciones: null,
  recargarCanciones: async () => {},
  actualizarCancion: async () => {},
  eliminarCancionDelCache: () => {},
  listo: false,
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [iglesiaId, setIglesiaId] = useState<string | null>(null)
  const [nombreIglesia, setNombreIglesia] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [canciones, setCanciones] = useState<any[]>([])
  const [cargandoCanciones, setCargandoCanciones] = useState(false)
  const [errorCanciones, setErrorCanciones] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  // ✅ Flags para evitar cargas duplicadas
  const yaCargadoRef = useRef(false)
  const cargandoRef = useRef(false)

  const cargarCanciones = useCallback(async (igId: string, intento = 1) => {
    setCargandoCanciones(true)
    setErrorCanciones(null)
    try {
      const { data, error } = await supabase
        .from("canciones")
        .select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda")
        .or(`iglesia_id.eq.${igId},iglesia_id.is.null`)
      if (error) throw error
      setCanciones(data || [])
    } catch (e: any) {
      console.error("Error cargando canciones:", e)
      if (intento < 3) {
        await new Promise(r => setTimeout(r, intento * 1000))
        return cargarCanciones(igId, intento + 1)
      }
      setErrorCanciones("No se pudieron cargar las canciones. Verifica tu conexión.")
    } finally {
      setCargandoCanciones(false)
    }
  }, [])

  const recargarCanciones = useCallback(async () => {
    if (iglesiaId) await cargarCanciones(iglesiaId)
  }, [iglesiaId, cargarCanciones])

  const actualizarCancion = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("canciones")
        .select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda")
        .eq("id", id)
        .single()
      if (error || !data) return
      setCanciones(prev => {
        const idx = prev.findIndex(c => c.id === id)
        if (idx === -1) return [...prev, data]
        const nueva = [...prev]
        nueva[idx] = data
        return nueva
      })
    } catch (e) {
      console.error("Error actualizando canción en contexto:", e)
    }
  }, [])

  const eliminarCancionDelCache = useCallback((id: string) => {
    setCanciones(prev => prev.filter(c => c.id !== id))
  }, [])

  const cargarDatos = useCallback(async () => {
    // ✅ Evitar cargas duplicadas si ya está corriendo o ya cargó
    if (cargandoRef.current || yaCargadoRef.current) return
    cargandoRef.current = true

    try {
      const igId = await getIglesiaId()
      if (!igId) { setListo(true); return }
      setIglesiaId(igId)

      const { data, error } = await supabase
        .from("iglesias")
        .select("nombre, logo_url, localidad")
        .eq("id", igId)
        .single()

      if (!error && data) {
        setNombreIglesia(data.nombre || "")
        setLogoUrl(data.logo_url || "")
        setLocalidad(data.localidad || "")
      }

      yaCargadoRef.current = true
      setListo(true)

      // Canciones en background
      cargarCanciones(igId)
    } catch (e) {
      console.error("AppContext error:", e)
      setListo(true)
    } finally {
      cargandoRef.current = false
    }
  }, [cargarCanciones])

  // ✅ Reset cuando el usuario cierra sesión
  const resetEstado = useCallback(() => {
    yaCargadoRef.current = false
    cargandoRef.current = false
    setIglesiaId(null)
    setNombreIglesia("")
    setLogoUrl("")
    setLocalidad("")
    setCanciones([])
    setListo(false)
    setErrorCanciones(null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUserId(data.session?.user?.id || null)
      if (data.session) cargarDatos()
      else setListo(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUserId(session?.user?.id || null)
      if (event === "SIGNED_OUT") {
        resetEstado()
      } else if (session && !yaCargadoRef.current) {
        cargarDatos()
      }
    })

    return () => subscription.unsubscribe()
  }, [cargarDatos, resetEstado])

  return (
    <AppContext.Provider value={{
      session, userId,
      iglesiaId, nombreIglesia, logoUrl, localidad,
      canciones, cargandoCanciones, errorCanciones,
      recargarCanciones, actualizarCancion, eliminarCancionDelCache,
      listo,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
