"use client"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"
import { getCancelacionesCache, setCancelacionesCache, cacheEsValido } from "@/lib/cache"

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
  desdeCache: boolean
  pinSala: string | null
  listo: boolean
  sinConexion: boolean
}

const AppContext = createContext<AppContextType>({
  session: null, userId: null,
  iglesiaId: null, nombreIglesia: "", logoUrl: "", localidad: "",
  canciones: [], cargandoCanciones: false, errorCanciones: null,
  recargarCanciones: async () => {},
  actualizarCancion: async () => {},
  eliminarCancionDelCache: () => {},
  desdeCache: false,
  pinSala: null,
  listo: false,
  sinConexion: false,
})

// ✅ Misma clave que components/AuthProvider.tsx (KEY_MODO_SIN_CONEXION) —
// no se importa directo para evitar un ciclo de dependencias entre ambos.
const KEY_MODO_SIN_CONEXION = "selah-modo-sin-conexion"

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
  const [desdeCache, setDesdeCache] = useState(false)
  const [pinSala, setPinSala] = useState<string | null>(null)
  const [sinConexion, setSinConexion] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(KEY_MODO_SIN_CONEXION) === "1" }
    catch { return false }
  })

  // ✅ AuthProvider es quien decide activar/desactivar el modo sin conexión
  // (escribe en localStorage) — acá solo lo reflejamos para que cualquier
  // pantalla pueda leerlo vía useApp() y bloquear acciones que necesitan
  // escribir a Supabase (crear canción, crear lista, etc).
  useEffect(() => {
    const leer = () => {
      try { setSinConexion(localStorage.getItem(KEY_MODO_SIN_CONEXION) === "1") }
      catch {}
    }
    window.addEventListener("storage", leer) // otras pestañas/ventanas
    const intervalo = setInterval(leer, 2000) // misma pestaña
    return () => { window.removeEventListener("storage", leer); clearInterval(intervalo) }
  }, [])

  // ✅ Flags para evitar cargas duplicadas
  const yaCargadoRef = useRef(false)
  const cargandoRef = useRef(false)

  const cargarCanciones = useCallback(async (igId: string, intento = 1) => {
    setCargandoCanciones(true)
    setErrorCanciones(null)

    // ✅ Paso 1: Cargar desde cache inmediatamente si existe
    if (intento === 1) {
      const cached = await getCancelacionesCache(igId)
      if (cached && cached.canciones.length > 0) {
        setCanciones(cached.canciones)
        setDesdeCache(true)
        setCargandoCanciones(false)
        // ✅ SIEMPRE refrescar desde Supabase en background para tener datos completos
        // No retornar aunque el caché sea válido — puede tener datos incompletos
      }
    }

    try {
      const PAGINA = 1000
      let todas: any[] = []
      let desde = 0
      let continuar = true

      while (continuar) {
        const { data, error } = await supabase
          .from("canciones")
          .select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda, fecha_creacion")
          .or(`iglesia_id.eq.${igId},iglesia_id.is.null`)
          .order("numero", { ascending: true, nullsFirst: false })
          .range(desde, desde + PAGINA - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        todas = todas.concat(data)
        continuar = data.length === PAGINA
        desde += PAGINA
      }

      console.log(`✅ AppContext canciones desde Supabase: ${todas.length}`)
      setCanciones(todas)
      setDesdeCache(false)
      await setCancelacionesCache(igId, todas)
    } catch (e: any) {
      console.error("Error cargando canciones:", e)
      if (intento < 3) {
        await new Promise(r => setTimeout(r, intento * 1000))
        return cargarCanciones(igId, intento + 1)
      }
      // Si ya tenemos datos del cache, no mostrar error
      if (!(await getCancelacionesCache(igId))) {
        setErrorCanciones("Sin conexión. Verifica tu internet.")
      }
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
    if (cargandoRef.current || yaCargadoRef.current) return
    cargandoRef.current = true

    try {
      const igId = await getIglesiaId()
      if (!igId) { setListo(true); return }
      setIglesiaId(igId)

      // ✅ Cargar canciones SIEMPRE, independiente de si iglesias falla
      console.log("🚀 AppContext: iniciando carga de canciones para iglesia", igId)
      cargarCanciones(igId)

      // Iglesia (nombre/logo) en paralelo — si falla no bloquea las canciones
      Promise.resolve(
        supabase.from("iglesias")
          .select("nombre, logo_url, localidad, pin_sala")
          .eq("id", igId).single()
      ).then(({ data, error }) => {
          if (!error && data) {
            setNombreIglesia(data.nombre || "")
            setLogoUrl(data.logo_url || "")
            setLocalidad(data.localidad || "")
            setPinSala(data.pin_sala || null)
            if (data.pin_sala) localStorage.setItem("selah-sala-pin", data.pin_sala)
            else localStorage.removeItem("selah-sala-pin")
          }
        }).catch(() => {})

      yaCargadoRef.current = true
      setListo(true)
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
    setPinSala(null)
    setDesdeCache(false)
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
      // ✅ Si fue un logout manual, ignorar cualquier sesión residual
      // (Electron puede detectar la cookie de Google OAuth y reautenticar solo)
      if (localStorage.getItem("selah-logout-manual") === "1") {
        if (event !== "SIGNED_OUT") return  // ignorar hasta que se limpie todo
      }

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
      desdeCache, pinSala, listo, sinConexion,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
