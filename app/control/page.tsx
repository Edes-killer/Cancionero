

"use client"
import BibleAutocomplete from "@/components/BibleAutocomplete"
import OnboardingTour from "@/components/OnboardingTour"
import { TOUR_CONTROL } from "@/lib/tours"

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { logCatch } from "@/lib/Errorlogger"
import { getSocketUrl } from "@/lib/servidor"
import { supabase } from "@/lib/supabase"
import { io } from "socket.io-client"
import { getIglesiaId } from "../../lib/getIglesia"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Cancion {
  id: string
  titulo: string
  tono?: string
  categoria?: string
  iglesia_id?: string | null
  numero?: number
  texto_busqueda?: string
  fecha_creacion?: string
}

interface Parte {
  id?: string
  tipo: string
  texto: string          // campo legacy
  texto_letra?: string   // nombre real en BD
  texto_acordes?: string | null
  tiene_acordes?: boolean
  orden?: number
}

interface ItemLista {
  id?: string
  tipo?: "cancion" | "biblia" | "imagen" | "mensaje" | "espera" | string
  cancion_id?: string
  lista_id?: string
  titulo?: string
  subtitulo?: string
  tono?: string
  categoria?: string
  partes?: Parte[]
  orden?: number
  url?: string
  texto?: string
  modo?: string
  estado_subtitulo?: string
  fondo?: FondoConfig | null
  referencia?: string
  referencia_biblica?: string
  paginas?: string[]
}

interface CultoData {
  id: string
  nombre?: string
  fecha?: string
  iglesia_id?: string
}

interface DatosCargaCancion {
  id?: string
  titulo: string
  tono?: string
  partes: Parte[]
  fondo?: FondoConfig | null
  index?: number
  iglesia?: string
  album?: string
}

interface FondoConfig {
  tipo: "url" | "preset" | "color"
  url?: string
  preset?: string
  color?: string
  oscuridad?: number
  ajuste?: string
}

export default function ControlPage() {
  const { iglesiaId: iglesiaIdCtx, nombreIglesia: nombreIglesiaCtx,
          logoUrl: logoUrlCtx, canciones: cancionesCtx, pinSala } = useApp()
  const [socket, setSocket] = useState<any>(null)
  const [zoomActual, setZoomActual] = useState(() =>
    typeof window !== "undefined" ? Number(localStorage.getItem("proyector-escala-fuente") || "100") : 100
  )
  const zoomActualRef = useRef(typeof window !== "undefined" ? Number(localStorage.getItem("proyector-escala-fuente") || "100") : 100)
  const socketRef2    = useRef<any>(null)
  const [modalServidor, setModalServidor] = useState(false)
  const [socketConectado, setSocketConectado] = useState<boolean | null>(null)
  const [proyectorConectado, setProyectorConectado] = useState(false)
  const [modoLimpio, setModoLimpio] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("proyector-modo-limpio") === "1"
  )
  const [familiaFuenteCtrl, setFamiliaFuenteCtrl] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("proyector-font-family") || "system" : "system"
  )
  const [galeriaImagenes, setGaleriaImagenes] = useState<{url:string,nombre:string,local:boolean}[]>([])
  const [galeriaAbierta, setGaleriaAbierta] = useState(false)
  const [cargandoGaleria, setCargandoGaleria] = useState(false)
  const isElectronCtx = typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")
  const [modoGuardado, setModoGuardado] = useState<"local" | "nube">(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("selah-img-modo") as "local"|"nube") || (isElectronCtx ? "local" : "nube")
      : "nube"
  )
  const [alturaVP, setAlturaVP] = useState<number | null>(null)
  const [sesionExpirando, setSesionExpirando] = useState(false)
  const [canciones, setCanciones] = useState<Cancion[]>([])
  const STORAGE_KEY = "selah_control_estado"
  const estadoGuardado = typeof window !== "undefined" ? (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") } catch (e) { return null }
  })() : null

  const [index, setIndex] = useState(estadoGuardado?.index || 0)
  const [lista, setLista] = useState<ItemLista[]>([])
  const [activaId, setActivaId] = useState<string | null>(estadoGuardado?.activaId || null)
  const [cultos, setCultos] = useState<CultoData[]>([])
  const [listaIdActual, setListaIdActual] = useState<string | null>(null)
  const [filtroTono, setFiltroTono] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaDebounced, setBusquedaDebounced] = useState("")
  const busquedaTimerRef = useRef<any>(null)
  const scrollThrottleRef = useRef<any>(null)

  // Debounce búsqueda 200ms
  const handleBusqueda = useCallback((v: string) => {
    setBusqueda(v)
    clearTimeout(busquedaTimerRef.current)
    if (!v) {
      setBusquedaDebounced("")   // ← vacío inmediato, sin esperar 200ms
    } else {
      busquedaTimerRef.current = setTimeout(() => setBusquedaDebounced(v), 200)
    }
  }, [])

  // ✅ requestAnimationFrame: siempre usa la posición ACTUAL del scroll (nunca stale)
  const handleScrollCanciones = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement
    cancelAnimationFrame(scrollThrottleRef.current as any)
    scrollThrottleRef.current = requestAnimationFrame(() => {
      setScrollTopCanciones(el.scrollTop)
    }) as any
  }, [])
  const [ordenar, setOrdenar] = useState<"numero" | "az" | "za" | "reciente" | "antigua">(() =>
    (typeof window !== "undefined" ? localStorage.getItem("canciones-orden") || "numero" : "numero") as any
  )
  const cambiarOrden = (v: "numero" | "az" | "za" | "reciente" | "antigua") => {
    setOrdenar(v); localStorage.setItem("canciones-orden", v)
  }
  const [nombreCulto, setNombreCulto] = useState("")
  const [partes, setPartes] = useState<Parte[]>(estadoGuardado?.partes || [])
  const [tituloActual, setTituloActual] = useState(estadoGuardado?.titulo || "")

  // ── Auto-avance y aprendizaje de tiempos ─────────────────────────────────
  const [autoAvanceActivo, setAutoAvanceActivo] = useState(false)
  const [contadorAuto, setContadorAuto] = useState(0) // segundos restantes
  const [tiemposAprendidos, setTiemposAprendidos] = useState<number[]>([]) // ms por parte
  const [aprendiendo, setAprendiendo] = useState(false)
  const tiempoInicioParte = useRef<number | null>(null)
  const tiemposRegistrados = useRef<number[]>([])
  const intervaloAutoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [indiceLista, setIndiceLista] = useState<number | null>(null)
  const [autoPlay, setAutoPlay] = useState(false)
  const esCoro = partes[index]?.tipo === "Coro"
  const [loopCoro, setLoopCoro] = useState(false)
  // ✅ Botón "Ir al Coro" — guarda la posición del verso para volver después
  const [versoDespuesCoro, setVersoDespuesCoro] = useState<number | null>(null)
  const [inputBiblia, setInputBiblia] = useState("")
  const [indiceActivoLista, setIndiceActivoLista] = useState<number | null>(null)
  const [paginasBiblia, setPaginasBiblia] = useState<string[]>([])
  const [paginaBibliaActual, setPaginaBibliaActual] = useState(0)
  const [nombreIglesia, setNombreIglesia] = useState(() => {
    // ✅ Leer del cache al inicializar (evita flash vacío)
    if (typeof window === "undefined") return ""
    try {
      const igId = localStorage.getItem("cancionero_iglesia_activa_id") || ""
      if (!igId) return ""
      const cached = localStorage.getItem(`selah-iglesia-${igId}`)
      if (cached) return JSON.parse(cached).nombre || ""
    } catch (e) {}
    return ""
  })
  // ✅ FIX: iglesiaId cacheado en ref para evitar múltiples llamadas
  // concurrentes a supabase.auth.getUser() que causan lock conflicts
  const iglesiaIdRef = useRef<string | null | undefined>(undefined)
  const getIglesiaIdCached = async (): Promise<string | null> => {
    if (iglesiaIdRef.current !== undefined) return iglesiaIdRef.current
    const id = iglesiaIdCtx || await getIglesiaId()
    iglesiaIdRef.current = id
    return id
  }

  // ✅ El pin_sala en localStorage lo escribe AppContext en segundo plano
  // (fetch async sin esperar). Si el socket conecta antes de que ese fetch
  // termine, se leía "sin pin" y el servidor rechazaba la conexión si otro
  // dispositivo ya se había unido con el pin correcto. Se consulta directo
  // a Supabase para no depender de ese timing.
  const pinSalaRef = useRef<string | null | undefined>(undefined)
  const getPinSalaCached = async (igId: string | null): Promise<string | undefined> => {
    if (pinSalaRef.current !== undefined) return pinSalaRef.current || undefined
    if (!igId || igId === "global") return undefined
    try {
      const { data } = await supabase.from("iglesias").select("pin_sala").eq("id", igId).single()
      const pin = data?.pin_sala || null
      pinSalaRef.current = pin
      if (pin) localStorage.setItem("selah-sala-pin", pin)
      return pin || undefined
    } catch {
      // Sin conexión — usar lo que haya en caché como último recurso
      return localStorage.getItem("selah-sala-pin") || undefined
    }
  }

  // ✅ Sincronizar contexto → estados locales (sin queries adicionales)
  useEffect(() => {
    if (iglesiaIdCtx) iglesiaIdRef.current = iglesiaIdCtx
  }, [iglesiaIdCtx])

  // ✅ Autoload de culto cuando viene desde el dashboard
  useEffect(() => {
    const listaAutoload = localStorage.getItem("selah_autoload_lista")
    if (listaAutoload) {
      localStorage.removeItem("selah_autoload_lista")
      // Esperar a que los cultos carguen antes de abrir
      const intentar = (intentos = 0) => {
        setTimeout(() => {
          const lista = document.querySelector(`[data-lista-id="${listaAutoload}"]`)
          if (lista || intentos > 10) {
            cargarListaDesdeBD(listaAutoload)
          } else {
            intentar(intentos + 1)
          }
        }, 300)
      }
      intentar()
    }
  }, [])

  useEffect(() => {
    if (nombreIglesiaCtx) { setNombreIglesia(nombreIglesiaCtx); nombreIglesiaRef.current = nombreIglesiaCtx }
  }, [nombreIglesiaCtx])

  useEffect(() => {
    if (logoUrlCtx) { setLogoEsperaUrl(logoUrlCtx); logoEsperaUrlRef.current = logoUrlCtx }
  }, [logoUrlCtx])

  // ✅ Lock compartido: evita que el efecto de montaje y el efecto que
  // escucha cancionesCtx disparen fetches duplicados si ambos corren
  // cerca uno del otro (carga fría con AppContext aún resolviendo sesión)
  const fetchEnCursoRef = useRef(false)

  useEffect(() => {
    if (cancionesCtx.length > 0 && canciones.length === 0 && !fetchEnCursoRef.current) {
      setCanciones(cancionesCtx)
      const CACHE_TTL_MS = 2 * 60 * 1000  // 2 minutos — igual que en cargarCanciones()
      getIglesiaIdCached().then(igId => {
        const cacheKey = `selah-canciones-v3-${igId}`
        let cacheReciente = false
        try {
          const raw = localStorage.getItem(cacheKey)
          if (raw) {
            const { ts } = JSON.parse(raw)
            cacheReciente = typeof ts === "number" && (Date.now() - ts) < CACHE_TTL_MS
          }
        } catch { /* ignorar */ }
        if (cacheReciente) {
          console.log(`📋 Contexto tiene ${cancionesCtx.length} canciones — caché reciente, sin refetch`)
          return
        }
        console.log(`📋 Contexto tiene ${cancionesCtx.length} canciones — mostrando y refrescando`)
        fetchEnCursoRef.current = true
        _fetchCanciones(igId, cacheKey)
          .catch(() => {})
          .finally(() => { fetchEnCursoRef.current = false })
      })
    }
  }, [cancionesCtx])

  // ✅ Cache de partes: Map<cancion_id, partes[]>
  // Evita fetch a Supabase cada vez que se proyecta una canción
  const partesCacheRef = useRef<Map<string, any[]>>(new Map())

  const nombreIglesiaRef = useRef("")
  const logoEsperaUrlRef = useRef("")

  const listaRef = useRef(lista)
  const indiceListaRef = useRef(indiceLista)
  const indexRef = useRef(index)
  const partesRef = useRef(partes)
  const paginasBibliaRef = useRef(paginasBiblia)
  const paginaBibliaActualRef = useRef(paginaBibliaActual)
  const loopCoroRef = useRef(loopCoro)
  const siguienteRef = useRef<() => Promise<void>>(async () => {})
  const anteriorRef = useRef<() => Promise<void>>(async () => {})
  const audioSilenciosoRef = useRef<HTMLAudioElement | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [mensajeRapido, setMensajeRapido] = useState("Oremos")
  const [bannerUrgente, setBannerUrgente] = useState("")
  const [bannerUrgenteActivo, setBannerUrgenteActivo] = useState(false)
  const [logoEsperaUrl, setLogoEsperaUrl] = useState("")
  const [logoEsperaNombre, setLogoEsperaNombre] = useState("")
  const [menuItemAbierto, setMenuItemAbierto] = useState<number | null>(null)
  const [menuCultoAbierto, setMenuCultoAbierto] = useState<string | null>(null)
  const [mensajeFlash, setMensajeFlash] = useState("")
  const [flashListaCulto, setFlashListaCulto] = useState(false)
  const [idsCancionesConAcordes, setIdsCancionesConAcordes] = useState<string[]>([])
  const [cargandoControl, setCargandoControl] = useState(true)
  const [mensajeCargaControl, setMensajeCargaControl] = useState("Preparando control...")
  const itemListaRefs = useRef<(HTMLDivElement | null)[]>([])
  const indicePendienteScrollRef = useRef<number | null>(null)
  const [indiceItemAgregado, setIndiceItemAgregado] = useState<number | null>(null)
  const cancionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [fondoCancionUrl, setFondoCancionUrl] = useState("")
  const [fondoCancionNombre, setFondoCancionNombre] = useState("")
  const [fondoCancionModo, setFondoCancionModo] = useState<"ninguno" | "preset" | "estatico" | "movimiento" | "video">("preset")
  const [fondoCancionPreset, setFondoCancionPreset] = useState("cielo-dorado")
  const [fondoCancionOscuridad, setFondoCancionOscuridad] = useState(55)
  const [fondoCancionAjuste, setFondoCancionAjuste] = useState<"cover" | "contain">("cover")
  const [iglesiaIdActual, setIglesiaIdActual] = useState<string | null>(null)
  const [fondoCancionConfigLista, setFondoCancionConfigLista] = useState(false)

  // ✅ Emitir fondo al proyector en tiempo real cuando cambia
  useEffect(() => {
    if (!socket || !fondoCancionConfigLista) return
    const fondo = fondoCancionActual()
    socket.emit("cambiar-fondo", fondo)
  }, [fondoCancionUrl, fondoCancionPreset, fondoCancionModo, fondoCancionOscuridad, fondoCancionAjuste])
  const [modalGuardar, setModalGuardar] = useState(false)
// ── Preview panel ─────────────────────────────────────────────────
const [previewCancion, setPreviewCancion] = useState<any>(null)
const [previewPartes, setPreviewPartes] = useState<any[]>([])
const [previewIndex, setPreviewIndex] = useState(0)
const [previewModoMusico, setPreviewModoMusico] = useState(false)
const [tabDerechaMobile, setTabDerechaMobile] = useState<"lista"|"preview">("lista")
const [bottomSheetAbierto, setBottomSheetAbierto] = useState(false)
const [previewHabilitado, setPreviewHabilitado] = useState(true)
// ── Visor Mobile Fullscreen ──────────────────────────────────────────
const [visorAbierto, setVisorAbierto] = useState(false)
const [visorPartes, setVisorPartes] = useState<any[]>([])
const [visorIndex, setVisorIndex] = useState(0)
const [visorModoMusico, setVisorModoMusico] = useState(false)
const [visorTitulo, setVisorTitulo] = useState("")
const [visorTono, setVisorTono] = useState("")
const [visorSemitonos, setVisorSemitonos] = useState(0)
const [visorFormatoAmericano, setVisorFormatoAmericano] = useState(false)
const [nombreModal, setNombreModal] = useState("")
const router = useRouter()
const fondosCancionPreset = [
  {
    id: "cielo-dorado",
    nombre: "Cielo dorado",
    fondo: "radial-gradient(circle at 50% 20%, rgba(251,191,36,0.45), transparent 34%), linear-gradient(135deg, #1e1b4b 0%, #7c2d12 48%, #0f172a 100%)"
  },
  {
    id: "azul-profundo",
    nombre: "Azul profundo",
    fondo: "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.38), transparent 32%), radial-gradient(circle at 80% 70%, rgba(14,165,233,0.25), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%)"
  },
  {
    id: "amanecer-suave",
    nombre: "Amanecer suave",
    fondo: "radial-gradient(circle at 70% 25%, rgba(253,186,116,0.55), transparent 30%), linear-gradient(135deg, #312e81 0%, #9f1239 45%, #431407 100%)"
  },
  {
    id: "verde-esperanza",
    nombre: "Verde esperanza",
    fondo: "radial-gradient(circle at 30% 20%, rgba(34,197,94,0.35), transparent 30%), radial-gradient(circle at 80% 80%, rgba(20,184,166,0.28), transparent 36%), linear-gradient(135deg, #022c22 0%, #064e3b 48%, #020617 100%)"
  },
  {
    id: "purpura-noche",
    nombre: "Púrpura noche",
    fondo: "radial-gradient(circle at 20% 30%, rgba(168,85,247,0.38), transparent 32%), radial-gradient(circle at 85% 65%, rgba(236,72,153,0.28), transparent 32%), linear-gradient(135deg, #020617 0%, #312e81 52%, #581c87 100%)"
  },
  {
    id: "fuego-suave",
    nombre: "Fuego suave",
    fondo: "radial-gradient(circle at 50% 35%, rgba(249,115,22,0.42), transparent 30%), radial-gradient(circle at 75% 75%, rgba(220,38,38,0.25), transparent 34%), linear-gradient(135deg, #1c1917 0%, #7c2d12 50%, #020617 100%)"
  },
  // ✅ Fondos animados
  { id: "aurora",    nombre: "✨ Aurora boreal",  fondo: "animated", animacion: "aurora"    },
  { id: "galaxia",   nombre: "🌌 Galaxia",        fondo: "animated", animacion: "galaxia"   },
  { id: "amanecer",  nombre: "🌅 Amanecer",       fondo: "animated", animacion: "amanecer"  },
  { id: "oceano",    nombre: "🌊 Océano",          fondo: "animated", animacion: "oceano"    },
  { id: "paz",       nombre: "🕊️ Paz",             fondo: "animated", animacion: "paz"       },
  { id: "lluvialuz", nombre: "💫 Lluvia de luz",  fondo: "animated", animacion: "lluvialuz" },
]
  
useEffect(() => {
  document.body.style.overflow = "hidden"
  return () => { document.body.style.overflow = "" }
}, [])

  // ✅ visualViewport: adaptar altura cuando abre el teclado
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handle = () => setAlturaVP(vv.height)
    vv.addEventListener("resize", handle)
    handle()
    return () => vv.removeEventListener("resize", handle)
  }, )

  // ✅ Detectar sesión próxima a expirar y renovar
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") setSesionExpirando(false)
      if (event === "SIGNED_OUT") router.replace("/login")
    })
    return () => subscription.unsubscribe()
  }, [router])

// Audio silencioso para activar Media Session en Android
const audioRef = useRef<HTMLAudioElement | null>(null)
// Solicitar permiso de notificaciones (Android 13+)
if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
  Notification.requestPermission()
}

useEffect(() => {
  // ✅ Sin servidor igual carga el control — solo avisa al intentar proyectar
  const ip = localStorage.getItem("servidor_ip")
  const esCapacitor = (window as any).Capacitor

  if (esCapacitor && !ip) {
    // No hay servidor configurado — carga sin socket, modo local
    return
  }

  const s = io(getSocketUrl())
  s.on("connect", async () => {
    try {
      const sala = (await getIglesiaIdCached()) || "global"
      const pin = await getPinSalaCached(sala)
      if (process.env.NODE_ENV === "development") console.log("🔥 CONTROL conectado a sala:", sala)
      s.emit("unirse-sala", { sala, pantalla: "control", pin })
      setSocketConectado(true)
    } catch (err) {
      console.error("❌ Error en connect control:", err)
    }
  })

  s.on("disconnect", () => setSocketConectado(false))
  s.on("connect_error", () => setSocketConectado(false))
  s.on("reconnect", () => setSocketConectado(true))

  socketRef2.current = s

  // ✅ Estado del proyector: saber si está abierto o cerrado
  s.on("proyector-conectado",    () => { console.log("✅ PROYECTOR CONECTADO"); setProyectorConectado(true) })
  s.on("proyector-desconectado", () => { console.log("❌ PROYECTOR DESCONECTADO"); setProyectorConectado(false) })

  // ✅ Sincronizar zoom cuando el proyector cambia con teclado
  s.on("zoom-info", ({ actual }: { actual: number }) => {
    setZoomActual(actual); zoomActualRef.current = actual
  })

  s.on("pin-invalido", (data: { mensaje?: string }) => {
    alert("🔒 " + (data?.mensaje || "PIN incorrecto. Verifica en configuración."))
  })

  s.on("connect_error", () => {
    // No redirigir — solo limpiar socket para mostrar "Sin conexión"
    if ((window as any).Capacitor) {
      localStorage.removeItem("servidor_ip")
    }
  })

  s.on("cancion-activa", (data: { id?: string }) => {
    setActivaId(data?.id || null)
  })

  s.on("cargar-cancion", (data: DatosCargaCancion) => {
    if (!data?.partes?.length) return
    const cancionId = (data.partes[0] as any)?.cancion_id
    setPartes(data.partes)
    setIndex(data.index || 0)
    setTituloActual(data.titulo || "")
    if (cancionId) setActivaId(cancionId)
  })

  s.on("restaurar-estado-control", (data: DatosCargaCancion) => {
    if (data?.partes?.length) {
      setPartes(data.partes)
      setIndex(data.index || 0)
      setTituloActual(data.titulo || "")
      const cancionId = (data.partes[0] as any)?.cancion_id
      if (cancionId) setActivaId(cancionId)
      if (process.env.NODE_ENV === "development") console.log("♻️ Estado restaurado:", data.titulo)
    }
  })

  // ✅ Cuando proyectar se abre, responde con el estado activo en control
  s.on("proyectar-solicita-estado", () => {
    const partes = partesRef.current
    const index = indexRef.current
    if (partes.length === 0) return // nada activo, proyectar queda en negro
    s.emit("reenviar-estado-a-proyectar", {
      partes,
      index,
      iglesia: nombreIglesiaRef.current || "",
      logo_marca_url: logoEsperaUrlRef.current || "",
    })
  })

  const onSiguiente = async () => {
    await siguienteRef.current()
  }

  const onAnterior = async () => {
    await anteriorRef.current()
  }

  s.on("control-siguiente", onSiguiente)
  s.on("control-anterior", onAnterior)

  setSocket(s)

  // ✅ Reconexión automática al volver al foco (bloqueo/desbloqueo, cambio de app)
  const reconectar = () => {
    if (!s.connected) {
      s.connect()
    }
  }

  // Web / Electron: detecta cuando el tab vuelve a ser visible
  document.addEventListener("visibilitychange", reconectar)

  // Capacitor APK: detecta cuando la app vuelve al frente
  let capacitorListener: { remove: () => void } | null = null
  let desmontado = false
  const setupCapacitorReconexion = async () => {
    if (!(window as any).Capacitor) return
    try {
      const { App } = await import("@capacitor/app")
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) reconectar()
      })
      if (desmontado) { handle.remove(); return }
      capacitorListener = handle
    } catch (e) {}
  }
  setupCapacitorReconexion()

  return () => {
    desmontado = true
    capacitorListener?.remove()
    document.removeEventListener("visibilitychange", reconectar)
    s.off("control-siguiente", onSiguiente)
    s.off("control-anterior", onAnterior)
    s.disconnect()
  }
}, [])


 useEffect(() => {
  if (listaIdActual) {
    cargarLista()
  }
}, [listaIdActual])

useEffect(() => {
  listaRef.current = lista
  indiceListaRef.current = indiceLista
  indexRef.current = index
  partesRef.current = partes
  paginasBibliaRef.current = paginasBiblia
  paginaBibliaActualRef.current = paginaBibliaActual
  loopCoroRef.current = loopCoro
  nombreIglesiaRef.current = nombreIglesia
  logoEsperaUrlRef.current = logoEsperaUrl
}, [lista, indiceLista, index, partes, paginasBiblia, paginaBibliaActual, loopCoro, nombreIglesia, logoEsperaUrl])

useEffect(() => {
  let activo = true

  const cargarInicial = async () => {
    try {
      setCargandoControl(true)
      setMensajeCargaControl("Cargando canciones y cultos...")

      // ✅ FIX: obtener iglesiaId UNA sola vez antes de las llamadas paralelas
      // para evitar que múltiples getUser() compitan por el auth lock de Supabase
      await getIglesiaIdCached()

      // ✅ cargarCultos no tiene cache (siempre pide a Supabase) y es un panel
      // secundario (colapsado por defecto) — no vale la pena que la pantalla
      // de carga espere por él. Antes, su latencia variable (sin caché ni
      // contexto que reusar) era la causa de que Control a veces tardara y
      // a veces no, aunque canciones ya estuviera cacheado.
      cargarCultos()

      await Promise.all([
        cargarCanciones(),
        cargarNombreIglesia()
      ])

      if (!activo) return

      setMensajeCargaControl("Control listo")
    } catch (error) {
      console.error("Error cargando control:", error)

      if (activo) {
        setMensajeCargaControl("Hubo un problema cargando el control")
      }
    } finally {
      if (activo) {
        setTimeout(() => {
          setCargandoControl(false)
        }, 350)
      }
    }
  }

  cargarInicial()

  return () => {
    activo = false
  }
}, [])

useEffect(() => {
  const actualizarPantalla = () => {
    setIsMobile(window.innerWidth < 768)
    setPantallaDetectada(true)
  }

  actualizarPantalla()

  window.addEventListener("resize", actualizarPantalla)

  return () => {
    window.removeEventListener("resize", actualizarPantalla)
  }
}, [])

useEffect(() => {
  if (!socket || lista.length === 0) return
  enviarPrecargaImagenes(lista)
}, [socket, lista])


useEffect(() => {
  if (indiceActivoLista === null || indiceActivoLista === undefined) return

  const el = itemListaRefs.current[indiceActivoLista]

  if (!el) return

  el.scrollIntoView({
    behavior: "smooth",
    block: "center"
  })
}, [indiceActivoLista])

useEffect(() => {
  if (!socket) return
  if (!fondoCancionUrl) return

  socket.emit("precargar-imagenes", [fondoCancionUrl])
}, [socket, fondoCancionUrl])

const [isMobile, setIsMobile] = useState(false)
const [pantallaDetectada, setPantallaDetectada] = useState(false)
const [mostrarCanciones, setMostrarCanciones] = useState(true)
const [mostrarAcciones, setMostrarAcciones] = useState(false)
const [mostrarPalabra, setMostrarPalabra] = useState(false)
const [mostrarCultos, setMostrarCultos] = useState(false)
const [estadoEspecialActivo, setEstadoEspecialActivo] = useState("")
const cargarLista = async () => {
  if (!listaIdActual) return
  await cargarListaDesdeBD(listaIdActual)
}

// ✅ TTL para no repetir el fetch completo de canciones en cada montaje/
// navegación — antes decía "SIEMPRE refrescar" y lo hacía literalmente en
// cada visita a Control, sintiéndose como una recarga constante. El TTL
// sigue garantizando que nunca pase más de CACHE_TTL_MS sin traer la lista
// completa de nuevo (la razón original de refrescar seguido: evitar
// canciones incompletas por un caché viejo/corrupto).
const CACHE_TTL_MS = 2 * 60 * 1000  // 2 minutos

const cargarCanciones = async () => {
  if (fetchEnCursoRef.current) return  // ya hay un fetch corriendo desde el otro trigger
  const igId = await getIglesiaIdCached()
  const CACHE_KEY = `selah-canciones-v3-${igId}`

  // ── 1. Contexto AppContext disponible → usar inmediatamente ────────────────────────────
  if (cancionesCtx.length > 0) {
    setCanciones(cancionesCtx)
    _cargarAcordes()
    let cacheReciente = false
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const { ts } = JSON.parse(raw)
        cacheReciente = typeof ts === "number" && (Date.now() - ts) < CACHE_TTL_MS
      }
    } catch { /* ignorar */ }
    if (cacheReciente) {
      console.log(`📋 Usando contexto: ${cancionesCtx.length} canciones — caché reciente, sin refetch`)
      return
    }
    console.log(`📋 Usando contexto: ${cancionesCtx.length} canciones — refrescando en background`)
    fetchEnCursoRef.current = true
    _fetchCanciones(igId, CACHE_KEY)
      .catch(() => {})
      .finally(() => { fetchEnCursoRef.current = false })
    return
  }

  // ── 2. Cache localStorage → mostrar instantáneo y refrescar si está vieja ────
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const { data: cached, ts } = JSON.parse(raw)
      if (Array.isArray(cached) && cached.length > 0) {
        setCanciones(cached)
        _cargarAcordes()
        if (typeof ts === "number" && (Date.now() - ts) < CACHE_TTL_MS) {
          console.log(`📦 Caché: ${cached.length} canciones — reciente, sin refetch`)
          return
        }
        console.log(`📦 Caché: ${cached.length} canciones — vieja, refrescando en background...`)
        _fetchCanciones(igId, CACHE_KEY).catch(() => {})
        return
      }
    }
  } catch (e) { /* ignorar */ }

  // ── 3. Sin cache → fetch normal (primera carga) ─────────────────────────────
  await _fetchCanciones(igId, CACHE_KEY)
  _cargarAcordes()
}

const _fetchCanciones = async (igId: string | null, cacheKey: string, intento = 1): Promise<void> => {
  const filtro = igId
    ? `iglesia_id.eq.${igId},iglesia_id.is.null`
    : `iglesia_id.is.null`

  const PAGINA = 1000
  let todas: any[] = []
  let desde = 0
  let continuar = true

  while (continuar) {
    const { data, error } = await supabase
      .from("canciones")
      .select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda, fecha_creacion")
      .or(filtro)
      .order("numero", { ascending: true, nullsFirst: false })
      .range(desde, desde + PAGINA - 1)

    if (error) {
      console.error("❌ Error fetch canciones:", error?.message)
      // ✅ Reintentar ante timeouts/errores transitorios del gateway de Supabase
      // (igual que AppContext.cargarCanciones) — antes se rendía al primer error.
      if (intento < 3) {
        await new Promise(r => setTimeout(r, intento * 1000))
        return _fetchCanciones(igId, cacheKey, intento + 1)
      }
      return
    }
    if (!data || data.length === 0) break
    todas = todas.concat(data)
    continuar = data.length === PAGINA
    desde += PAGINA
  }

  console.log(`✅ Fetch canciones: ${todas.length} total`)
  if (todas.length > 0) {
    setCanciones(todas)
    try { localStorage.setItem(cacheKey, JSON.stringify({ data: todas, ts: Date.now() })) } catch (e) {}
  }
}

// Helper: cargar IDs de canciones con acordes (separado para no bloquear el cache path)
const _cargarAcordes = async () => {
  const { data: partesConAcordes, error: errorAcordes } = await supabase
    .from("partes_cancion")
    .select("cancion_id")
    .eq("tiene_acordes", true)
  if (errorAcordes) { setIdsCancionesConAcordes([]); return }
  const idsUnicos = Array.from(
    new Set((partesConAcordes || []).map((p: any) => p.cancion_id).filter(Boolean))
  )
  setIdsCancionesConAcordes(idsUnicos)
}



  const cargarNombreIglesia = async () => {
  const iglesiaId = iglesiaIdCtx || await getIglesiaIdCached()

  if (!iglesiaId) { setFondoCancionConfigLista(true); return }

  setIglesiaIdActual(iglesiaId)

  try {
    const guardado = localStorage.getItem(`fondo-cancion-${iglesiaId}`)
    if (guardado) {
      const config = JSON.parse(guardado)
      setFondoCancionUrl(config.url || "")
      setFondoCancionNombre(config.nombre || "")
      setFondoCancionModo((config.modo || "preset") as "ninguno" | "preset" | "estatico" | "movimiento" | "video")
      setFondoCancionPreset(config.preset || "cielo-dorado")
      setFondoCancionOscuridad(config.oscuridad ?? 55)
      setFondoCancionAjuste(config.ajuste || "cover")
    }
  } catch (e) { /* ignorar */ }
  finally { setFondoCancionConfigLista(true) }

  // ── 1. Mostrar desde localStorage inmediatamente (sin esperar a Supabase) ─
  const igCacheKey = `selah-iglesia-${iglesiaId}`
  try {
    const igCachedRaw = localStorage.getItem(igCacheKey)
    if (igCachedRaw) {
      const { nombre, logo_url, logo_nombre } = JSON.parse(igCachedRaw)
      if (nombre) {
        setNombreIglesia(nombre || "")
        setLogoEsperaUrl(logo_url || "")
        setLogoEsperaNombre(logo_nombre || "")
        nombreIglesiaRef.current = nombre
        logoEsperaUrlRef.current = logo_url || ""
        // Si viene del contexto también lo tenemos; no hace falta query
        if (nombreIglesiaCtx) return
      }
    }
  } catch (e) { /* ignorar */ }

  // ✅ Usar datos del contexto si ya están disponibles
  if (nombreIglesiaCtx) {
    setNombreIglesia(nombreIglesiaCtx)
    setLogoEsperaUrl(logoUrlCtx || "")
    nombreIglesiaRef.current = nombreIglesiaCtx
    logoEsperaUrlRef.current = logoUrlCtx || ""
    // Cargar logo_nombre en background (no bloquear)
    supabase.from("iglesias").select("logo_nombre").eq("id", iglesiaId).limit(1)
      .then(({ data: rows }) => {
        const d = (rows as any[])?.[0]
        if (d) setLogoEsperaNombre(d.logo_nombre || "")
      })
    return
  }

  // ── 2. Query a Supabase con timeout ──────────────────────────────────────────
  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    )
    const queryPromise = supabase
      .from("iglesias").select("nombre, logo_url, logo_nombre")
      .eq("id", iglesiaId).limit(1)

    const { data: rows, error } = await Promise.race([
      queryPromise,
      timeoutPromise.then(() => ({ data: null, error: new Error("timeout") }))
    ]) as any

    if (error) {
      console.warn("Iglesia timeout/error — usando caché localStorage")
      return  // ya mostramos datos del localStorage arriba
    }

    const data = (rows as any[])?.[0] ?? null
    if (!data) return

    setNombreIglesia(data.nombre || "")
    setLogoEsperaUrl(data.logo_url || "")
    setLogoEsperaNombre(data.logo_nombre || "")
    nombreIglesiaRef.current = data.nombre || ""
    logoEsperaUrlRef.current = data.logo_url || ""

    // Guardar en cache para la próxima carga (acceso instantáneo)
    try { localStorage.setItem(igCacheKey, JSON.stringify({ nombre: data.nombre, logo_url: data.logo_url, logo_nombre: data.logo_nombre })) } catch (e) { /* ignorar */ }
  } catch (e) {
    console.warn("Error cargando iglesia:", e)
  }
}

const fondoCancionActual = () => {
  if (fondoCancionModo === "ninguno") return null

  if (fondoCancionModo === "preset") {
    const preset = fondosCancionPreset.find(f => f.id === fondoCancionPreset)
    // ✅ Preset animado
    if (preset?.fondo === "animated") {
      return {
        tipo: "animated",
        animacion: preset.animacion,
        nombre: preset.nombre,
        oscuridad: fondoCancionOscuridad,
      }
    }
    return {
      tipo: "preset",
      preset: fondoCancionPreset,
      fondoCss: preset?.fondo || fondosCancionPreset[0].fondo,
      nombre: preset?.nombre || "Fondo predeterminado",
      oscuridad: fondoCancionOscuridad,
      ajuste: fondoCancionAjuste
    }
  }

  if (!fondoCancionUrl) return null

  return {
    tipo: fondoCancionModo,  // "estatico" | "movimiento" | "video"
    url: fondoCancionUrl,
    nombre: fondoCancionNombre,
    oscuridad: fondoCancionOscuridad,
    ajuste: fondoCancionAjuste
  }
}

const registrarProyeccionCancion = async (cancion: any) => {
  if (!cancion?.id) return

  try {
    const iglesiaId = await getIglesiaIdCached()

    await supabase.from("historial_proyecciones").insert({
      iglesia_id: iglesiaId,
      cancion_id: cancion.id,
      lista_id: listaIdActual || null,
      tipo: "cancion",
      titulo: cancion.titulo || "",
      tono: cancion.tono || "",
      categoria: cancion.categoria || ""
    })
  } catch (error) {
    console.error("Error registrando historial:", error)
  }
}

// ✅ Helper: obtiene partes desde cache o Supabase
const getPartesCancion = async (cancionId: string): Promise<any[]> => {
  if (partesCacheRef.current.has(cancionId)) {
    return partesCacheRef.current.get(cancionId)!
  }
  const { data, error } = await supabase
    .from("partes_cancion")
    .select("cancion_id, tipo, texto, texto_letra, texto_acordes, tiene_acordes, orden")
    .eq("cancion_id", cancionId)
    .order("orden")
  if (error) { console.error(error); return [] }
  // ✅ Normalizar texto_letra → texto
  const partes = (data || []).map(p => ({ ...p, texto: p.texto_letra || (p as any).texto || "" }))
  console.log("🎵 Partes cargadas:", partes.length, partes[0] ? `texto[0]="${partes[0].texto?.slice(0,30)}"` : "sin partes")
  partesCacheRef.current.set(cancionId, partes)
  return partes
}

// ✅ Precarga partes en batch — una sola query para múltiples canciones
const precargarPartesBatch = async (ids: string[]) => {
  const sinCache = ids.filter(id => !partesCacheRef.current.has(id))
  if (sinCache.length === 0) return

  // Lotes de 30 — más seguro con RLS de Supabase
  const LOTE = 30
  for (let i = 0; i < sinCache.length; i += LOTE) {
    const lote = sinCache.slice(i, i + LOTE)
    try {
      const { data, error } = await supabase
        .from("partes_cancion")
        .select("cancion_id, tipo, texto, texto_letra, texto_acordes, tiene_acordes, orden")
        .in("cancion_id", lote)
        .order("orden")

      if (error) {
        console.warn("Precarga parcial:", error.message || error.code || "error RLS")
        continue
      }

      // Agrupar por cancion_id
      const agrupado: Record<string, any[]> = {}
      for (const parte of data || []) {
        if (!agrupado[parte.cancion_id]) agrupado[parte.cancion_id] = []
        // ✅ Normalizar: texto_letra → texto para compatibilidad con el resto del código
        agrupado[parte.cancion_id].push({ ...parte, texto: parte.texto_letra || (parte as any).texto || "" })
      }
      for (const id of lote) {
        partesCacheRef.current.set(id, agrupado[id] || [])
      }
    } catch(e) {
      logCatch(e, "Precarga batch", { tipo: "supabase", pagina: "/control", detalle: { lote: lote.slice(0, 3) } })
    }
  }
}

// ✅ Precarga partes de lista de culto en batch
const precargarPartesLista = (items: any[]) => {
  const ids = items.filter(i => i.tipo === "cancion" && i.id).map(i => i.id)
  if (ids.length === 0) return
  precargarPartesBatch(ids)
}

const activarMediaSession = (titulo: string, partesList: any[], idx: number) => {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return
  if (!audioSilenciosoRef.current) {
    audioSilenciosoRef.current = new Audio(
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAAMTAw"
)
    audioSilenciosoRef.current.loop = true
    audioSilenciosoRef.current.volume = 0.001
  }
  audioSilenciosoRef.current.play().catch(() => {})
  if (!titulo || partesList.length === 0) {
    navigator.mediaSession.metadata = null
    return
  }
  const parteNombre = partesList[idx]?.tipo || `Parte ${idx + 1}`
  navigator.mediaSession.metadata = new MediaMetadata({
    title: titulo,
    artist: `${parteNombre} · ${idx + 1}/${partesList.length}`,
    album: nombreIglesiaRef.current || "Selah Live",
    artwork: logoEsperaUrlRef.current
      ? [{ src: logoEsperaUrlRef.current, sizes: "512x512", type: "image/jpeg" }]
      : [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }]
  })
  navigator.mediaSession.setActionHandler("previoustrack", () => anteriorRef.current())
  navigator.mediaSession.setActionHandler("nexttrack", () => siguienteRef.current())
}

const verificarServidor = (): boolean => {
  if (socket) return true
  setModalServidor(true)
  return false
}

const proyectar = async (id: string) => {
  if (!verificarServidor()) return

  const idxEnLista = lista.findIndex(
    item => item.tipo === "cancion" && item.id === id
  )

  if (idxEnLista !== -1) {
    await irAItemLista(idxEnLista, false)
    return
  }

  const cancion = canciones.find(c => c.id === id)

  // ✅ Desde cache — sin esperar red
  const data = await getPartesCancion(id)

  if (!data.length && !cancion) {
    console.error("No se encontraron partes para la canción")
    return
  }

  setActivaId(id)
  requestAnimationFrame(() => {
    centrarCancionEnLista(id)
  })
  setIndiceLista(null)
  setIndiceActivoLista(null)
  limpiarModoBiblia()
  setEstadoEspecialActivo("")

  setTituloActual(cancion?.titulo || "")
  setPartes(data || [])
  setIndex(0)
  // Iniciar aprendizaje y cargar tiempos guardados
  if (cancion?.id) {
    const guardados = cargarTiempos(cancion.id)
    setTiemposAprendidos(guardados)
    iniciarAprendizaje()
  }
  detenerAutoAvance()
  // Activar audio desde gesto del usuario (requisito Android)
  activarMediaSession(cancion?.titulo || "", data || [], 0)
  registrarProyeccionCancion(cancion) // ✅ fire & forget — no bloquea el socket
  console.log("📤 Enviando partes:", data?.length, "texto[0]:", data?.[0]?.texto?.slice(0, 40))
  socket.emit("cargar-cancion", {
    partes: data,
    index: 0,
    titulo: cancion?.titulo || "",
    tono: cancion?.tono || "",
    iglesia: nombreIglesia || "",
    logo_marca_url: logoEsperaUrl || "",
    fondo: fondoCancionActual()
  })

  socket.emit("cancion-activa", { id })
}

// ── Helpers transposición ───────────────────────────────────────────
const ESCALA_LATINA  = ["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"]
const ESCALA_AMERICANA = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
const BEMOLES_LAT = ["Do","Reb","Re","Mib","Mi","Fa","Solb","Sol","Lab","La","Sib","Si"]
const BEMOLES_AME = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"]

const transponerAcorde = (acorde: string, semitonos: number, americano: boolean): string => {
  const mapaIdx: Record<string,number> = {}
  ESCALA_LATINA.forEach((n,i) => { mapaIdx[n]=i; mapaIdx[n.toLowerCase()]=i })
  BEMOLES_LAT.forEach((n,i) => { if(n!==ESCALA_LATINA[i]) mapaIdx[n]=i })
  ESCALA_AMERICANA.forEach((n,i) => { mapaIdx[n]=i; mapaIdx[n.toLowerCase()]=i })
  BEMOLES_AME.forEach((n,i) => { if(n!==ESCALA_AMERICANA[i]) mapaIdx[n]=i })
  
  // Extraer base del acorde (ej: "Solm7" → base="Sol", sufijo="m7")
  const match = acorde.match(/^(Do#|Do|Re#|Reb|Re|Mib|Mi|Fa#|Solb|Sol#|Sol|Lab|La#|La|Sib|Si|C#|Cb|Db|D#|D|Eb|E|Fb|F#|Gb|G#|Ab|A#|Bb|B|[A-G])(.*)/i)
  if (!match) return acorde
  const base = match[1]
  const sufijo = match[2] || ""
  const idx = mapaIdx[base] ?? mapaIdx[base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()]
  if (idx === undefined) return acorde
  const newIdx = ((idx + semitonos) % 12 + 12) % 12
  const escala = americano ? ESCALA_AMERICANA : ESCALA_LATINA
  return escala[newIdx] + sufijo
}

const transponerTexto = (texto: string, semitonos: number, americano: boolean): string => {
  // ✅ Si no hay transposición Y el texto ya está en la notación correcta → retorno rápido
  const tieneAcordesAmericanos = /\[[A-G][^a-z]|\[[A-G]\]/.test(texto)
  const tieneAcordesLatinos = /\[Do|\[Re|\[Mi|\[Fa|\[Sol|\[La|\[Si/.test(texto)
  if (semitonos === 0) {
    if (!americano && tieneAcordesLatinos && !tieneAcordesAmericanos) return texto
    if (americano && !tieneAcordesLatinos && tieneAcordesAmericanos) return texto
  }
  // Reemplazar acordes en corchetes [Do] → [Re]
  let result = texto.replace(/\[([^\]]+)\]/g, (_,a) => "[" + transponerAcorde(a, semitonos, americano) + "]")
  // Reemplazar acordes en líneas separadas (formato linea)
  result = result.split("\n").map(linea => {
    const tokens = linea.trim().split(/\s+/)
    const soloAcordes = tokens.length > 0 && tokens.every((t:string) => 
      t.match(/^(Do#?|Reb?|Re#?|Mib?|Mi|Fa#?|Solb?|Sol#?|Lab?|La#?|Sib?|Si|[A-G])(b|#)?(m|maj|min|sus|dim|aug)?\d*(\/[A-G])?$/)
    )
    if (soloAcordes && linea.trim()) {
      return linea.split(/\s+/).map((t:string) => 
        t ? transponerAcorde(t, semitonos, americano) : t
      ).join(" ")
    }
    return linea
  }).join("\n")
  return result
}

const cargarPreview = async (c: any) => {
  setPreviewCancion(c)
  setPreviewIndex(0)
  if (isMobile && previewHabilitado) setBottomSheetAbierto(true) // ✅ Abrir bottom sheet en mobile
  // Si ya está en caché → mostrar instantáneamente
  if (partesCacheRef.current.has(c.id)) {
    setPreviewPartes(partesCacheRef.current.get(c.id)!)
    return
  }
  setPreviewPartes([]) // Mostrar "Cargando..." mientras llega
  const data = await getPartesCancion(c.id)
  setPreviewPartes(data || [])
}

const abrirVisor = async (c: any) => {
  setVisorTitulo(c.titulo || "")
  setVisorTono(c.tono || "")
  setVisorIndex(0)
  setVisorSemitonos(0)
  setVisorFormatoAmericano(false)
  setVisorAbierto(true)
  // Si ya está en caché → mostrar instantáneamente
  if (partesCacheRef.current.has(c.id)) {
    setVisorPartes(partesCacheRef.current.get(c.id)!)
    return
  }
  setVisorPartes([])
  const data = await getPartesCancion(c.id)
  setVisorPartes(data || [])
}

const partirEnPaginasCliente = (texto: string, maxChars = 650) => {
  const limpio = texto
    .replace(/\/n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const palabras = limpio.split(" ")
  const paginas: string[] = []
  let actual = ""

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra

    if (candidato.length > maxChars) {
      if (actual) paginas.push(actual)
      actual = palabra
    } else {
      actual = candidato
    }
  }

  if (actual) paginas.push(actual)

  return paginas
}

// ── Helpers de timing ────────────────────────────────────────────────────
const claveTimingCancion = (id: string) => `selah-tiempos-${id}`

const cargarTiempos = (cancionId: string): number[] => {
  try {
    const raw = localStorage.getItem(claveTimingCancion(cancionId))
    return raw ? JSON.parse(raw) : []
  } catch (e) { return [] }
}

const guardarTiempos = (cancionId: string, tiempos: number[]) => {
  try {
    localStorage.setItem(claveTimingCancion(cancionId), JSON.stringify(tiempos))
  } catch (e) {}
}

const iniciarAprendizaje = () => {
  tiempoInicioParte.current = Date.now()
  tiemposRegistrados.current = []
  setAprendiendo(true)
}

const registrarCambioParte = (cancionId?: string) => {
  if (!aprendiendo || tiempoInicioParte.current === null) return
  const elapsed = Date.now() - tiempoInicioParte.current
  tiemposRegistrados.current.push(elapsed)
  tiempoInicioParte.current = Date.now()
  // ✅ Guardar tiempos parciales en cada cambio — no esperar al final
  if (cancionId && tiemposRegistrados.current.length > 0) {
    guardarTiempos(cancionId, tiemposRegistrados.current)
    setTiemposAprendidos([...tiemposRegistrados.current])
  }
}

const finalizarAprendizaje = (cancionId: string) => {
  if (!aprendiendo || tiemposRegistrados.current.length < 1) return
  guardarTiempos(cancionId, tiemposRegistrados.current)
  setTiemposAprendidos(tiemposRegistrados.current)
  setAprendiendo(false)
  tiemposRegistrados.current = []
}

// ── Ir al Coro y volver al siguiente verso ───────────────────────────────
const irAlCoro = () => {
  if (!socket || !partes.length) return
  const esCoro = (p: any) => /coro|estribillo|chorus/i.test(p?.tipo || "")

  // Si ya estamos en el coro y hay un verso guardado → volver al siguiente verso
  if (esCoro(partes[index]) && versoDespuesCoro !== null) {
    const siguiente = versoDespuesCoro
    setVersoDespuesCoro(null)
    setIndex(siguiente)
    socket.emit("cambiar-parte", siguiente)
    return
  }

  // Buscar el siguiente coro hacia adelante, o el primero de la canción
  const siguiente = partes.findIndex((p, i) => i > index && esCoro(p))
  const primero   = partes.findIndex(p => esCoro(p))
  const destino   = siguiente !== -1 ? siguiente : primero

  if (destino === -1) return  // no hay coro
  // Guardar el próximo verso (parte actual + 1 o la siguiente parte no-coro)
  setVersoDespuesCoro(index + 1 < partes.length ? index + 1 : index)
  setIndex(destino)
  socket.emit("cambiar-parte", destino)
}

const iniciarAutoAvance = (tiempos: number[], desde: number) => {
  if (intervaloAutoRef.current) clearInterval(intervaloAutoRef.current)
  const msActual = tiempos[desde] || tiempos[tiempos.length - 1] || 15000
  let restante = Math.round(msActual / 1000)
  setContadorAuto(restante)
  intervaloAutoRef.current = setInterval(() => {
    restante -= 1
    setContadorAuto(restante)
    if (restante <= 0) {
      clearInterval(intervaloAutoRef.current!)
      siguienteRef.current()
    }
  }, 1000)
}

const detenerAutoAvance = () => {
  if (intervaloAutoRef.current) { clearInterval(intervaloAutoRef.current); intervaloAutoRef.current = null }
  setAutoAvanceActivo(false)
  setContadorAuto(0)
}

const siguiente = async () => {
  if (!socket) return

  // Biblia proyectada directa, fuera de lista
  if (indiceLista === null && paginasBiblia.length > 0) {
    if (paginaBibliaActual < paginasBiblia.length - 1) {
      const nuevaPagina = paginaBibliaActual + 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
    }
    return
  }

  // Canción proyectada directa, fuera de lista
  if (indiceLista === null) {
    const ultimo = index >= partes.length - 1
    if (!ultimo) {
      if (loopCoro && esCoro) return
      const nuevo = index + 1
      registrarCambioParte(activaId || undefined)
      setIndex(nuevo)
      socket.emit("cambiar-parte", nuevo)
      if (autoAvanceActivo) iniciarAutoAvance(tiemposAprendidos, nuevo)
    }
    return
  }

  const itemActual = lista[indiceLista]

  // Biblia dentro de la lista
  if (itemActual?.tipo === "biblia") {
    if (paginaBibliaActual < paginasBiblia.length - 1) {
      const nuevaPagina = paginaBibliaActual + 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
      return
    }
  }

  // Canción dentro de la lista
  if (itemActual?.tipo === "cancion") {
    const ultimo = index >= partes.length - 1
    if (!ultimo) {
      if (loopCoro && esCoro) return
      const nuevo = index + 1
      registrarCambioParte(activaId || undefined)
      setIndex(nuevo)
      socket.emit("cambiar-parte", nuevo)
      if (autoAvanceActivo) iniciarAutoAvance(tiemposAprendidos, nuevo)
      return
    } else {
      // Llegó al final → guardar tiempos aprendidos
      if (activaId) finalizarAprendizaje(activaId)
      detenerAutoAvance()
    }
  }

  // Imagen, Biblia terminada, o canción terminada
  if (lista[indiceLista + 1]) {
  await irAItemLista(indiceLista + 1, false)
}
}

const anterior = async () => {
  if (!socket) return

  // Biblia proyectada directa, fuera de lista
  if (indiceLista === null && paginasBiblia.length > 0) {
    if (paginaBibliaActual > 0) {
      const nuevaPagina = paginaBibliaActual - 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
    }
    return
  }

  // Canción proyectada directa, fuera de lista
  if (indiceLista === null) {
    if (index > 0) {
      const nuevo = index - 1
      setIndex(nuevo)
      socket.emit("cambiar-parte", nuevo)
    }
    return
  }

  const itemActual = lista[indiceLista]

  // Biblia dentro de la lista
  if (itemActual?.tipo === "biblia") {
    if (paginaBibliaActual > 0) {
      const nuevaPagina = paginaBibliaActual - 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
      return
    }
  }

  // Canción dentro de la lista
  if (itemActual?.tipo === "cancion" && index > 0) {
    const nuevo = index - 1
    setIndex(nuevo)
    socket.emit("cambiar-parte", nuevo)
    return
  }

  // Imagen, Biblia en página 0, o canción en parte 0
  if (indiceLista > 0) {
  await irAItemLista(indiceLista - 1, true)
  }
}

useEffect(() => {
  siguienteRef.current = siguiente
  anteriorRef.current = anterior

  // ✅ Persistir estado en localStorage para recuperar tras bloqueo
  if (typeof window !== "undefined") {
    if (partes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        partes, index, titulo: tituloActual, activaId
      }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // Media Session se actualiza desde activarMediaSession() llamado en cada acción
}, [siguiente, anterior])

const agregarALista = (cancion: any) => {
  if (listaIdActual) {
    alert("⚠️ Estás editando un culto guardado. Presiona 'Nuevo' para crear otro.")
    return
  }

  const existe = lista.some(c => c.id === cancion.id)

  if (existe) {
    mostrarFeedbackLista("⚠️ Esa canción ya está en la lista")
    return
  }

  agregarItemAListaConFeedback(
  {
    tipo: "cancion",
    id: cancion.id,
    titulo: cancion.titulo
  },
  `✅ Agregada: ${cancion.titulo}`
)
}

const mostrarFeedbackLista = (mensaje: string) => {
  setMensajeFlash(mensaje)
  setFlashListaCulto(true)

  setTimeout(() => {
    setFlashListaCulto(false)
  }, 900)

  setTimeout(() => {
    setMensajeFlash("")
  }, 1600)
}

const moverItemLista = (from: number, to: number) => {
  if (from === to || from < 0 || to < 0) return

  setLista(prev => {
    const nueva = [...prev]
    const [movido] = nueva.splice(from, 1)
    nueva.splice(to, 0, movido)
    return nueva
  })

  setIndiceActivoLista(prev => {
    if (prev === null) return prev
    if (prev === from) return to

    if (from < to && prev > from && prev <= to) return prev - 1
    if (from > to && prev >= to && prev < from) return prev + 1

    return prev
  })

  setIndiceLista(prev => {
    if (prev === null) return prev
    if (prev === from) return to

    if (from < to && prev > from && prev <= to) return prev - 1
    if (from > to && prev >= to && prev < from) return prev + 1

    return prev
  })
}

const subirItemLista = (i: number) => {
  if (i <= 0) return
  setMenuItemAbierto(null)
  moverItemLista(i, i - 1)
}

const bajarItemLista = (i: number) => {
  if (i >= lista.length - 1) return
  setMenuItemAbierto(null)
  moverItemLista(i, i + 1)
}

const eliminarDeLista = async (index: number) => {
  const item = lista[index]

  setLista(prev => prev.filter((_, i) => i !== index))

  if (!listaIdActual) return

  const { data: items } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", listaIdActual)
    .order("orden")

  const itemBD = items?.[index]
  if (!itemBD) return

  await supabase
    .from("items_lista")
    .delete()
    .eq("id", itemBD.id)
}

// ✅ Helper: convierte un item de lista en fila para items_lista
const itemAFila = (item: any, i: number, listaId: string) => ({
  lista_id: listaId,
  orden: i,
  cancion_id: item.tipo === "cancion" ? item.id : null,
  tipo: item.tipo,
  imagen_url: item.tipo === "imagen" ? item.url : null,
  referencia_biblica: item.tipo === "biblia" ? item.referencia : null,
  texto_biblico: item.tipo === "biblia" ? item.texto : null,
  estado_modo: item.tipo === "estado" ? item.modo : null,
  estado_titulo: item.tipo === "estado" ? item.titulo : null,
  estado_subtitulo: item.tipo === "estado" ? item.subtitulo : null,
  estado_url: item.tipo === "estado" ? item.url : null
})


const guardarCulto = async () => {
  if (lista.length === 0) {
    alert("No hay elementos en la lista de culto para guardar.")
    return
  }

  const mensajePrompt = listaIdActual
    ? "Actualizar nombre del culto"
    : "Nombre para la nueva lista de culto"

  const nombre = prompt(mensajePrompt, nombreCulto || "")
  if (!nombre || !nombre.trim()) return

  let listaIdFinal = listaIdActual

  if (listaIdActual) {
    // ACTUALIZAR CULTO EXISTENTE
    const { error: deleteError } = await supabase
      .from("items_lista")
      .delete()
      .eq("lista_id", listaIdActual)

    if (deleteError) {
      console.error("Error borrando items antiguos:", deleteError)
      alert("No se pudieron actualizar los items del culto")
      return
    }

    // ✅ Batch insert: una sola llamada en vez de N paralelas
    const { error: errorInsert } = await supabase
      .from("items_lista")
      .insert(lista.map((item, i) => itemAFila(item, i, listaIdActual!)))

    if (errorInsert) {
      console.error("Error insertando items:", errorInsert)
      alert("No se pudieron guardar todos los elementos del culto")
      return
    }

    setNombreCulto(nombre.trim())
    alert("✅ Lista de culto actualizada correctamente")
  } else {
    // CREAR CULTO NUEVO
    const iglesiaId = await getIglesiaIdCached()

    const { data, error } = await supabase
      .from("listas_culto")
      .insert({
        nombre: nombre.trim(),
        iglesia_id: iglesiaId,
        fecha: new Date().toISOString().split("T")[0]  // ✅ fecha del culto (YYYY-MM-DD)
      })
      .select()
      .single()

    if (error || !data) {
      console.error("Error creando culto:", error)
      alert("No se pudo crear el culto")
      return
    }

    const nuevaId = data.id
    listaIdFinal = nuevaId

    // ✅ Batch insert
    const { error: errorInsert } = await supabase
      .from("items_lista")
      .insert(lista.map((item, i) => itemAFila(item, i, nuevaId)))

    if (errorInsert) {
      console.error("Error insertando items:", errorInsert)
      alert("El culto se creó, pero falló el guardado de elementos")
      return
    }

    setListaIdActual(nuevaId)
    setNombreCulto(nombre.trim())
    alert("✅ Nueva lista de culto guardada correctamente")
  }
  setNombreCulto(nombre.trim())
  await cargarCultos()

  if (listaIdFinal) {
    await cargarListaDesdeBD(listaIdFinal)
  }
}

const guardarCultoComoCopia = async () => {
  const nombreBase = nombreCulto?.trim() || "Culto"
  const nombre = prompt("Nombre de la copia", `${nombreBase} (copia)`)
  if (!nombre) return

  const iglesiaId = await getIglesiaIdCached()

  const { data, error } = await supabase
    .from("listas_culto")
    .insert({
      nombre: nombre.trim(),
      iglesia_id: iglesiaId
    })
    .select()
    .single()

  if (error || !data) {
    console.error("Error creando copia:", error)
    alert("No se pudo crear la copia")
    return
  }

  const nuevaId = data.id

  // ✅ Batch insert
  const { error: errorInsert } = await supabase
    .from("items_lista")
    .insert(lista.map((item, i) => itemAFila(item, i, nuevaId)))

  if (errorInsert) {
    console.error("Error copiando items:", errorInsert)
    alert("La copia se creó, pero falló el guardado de elementos")
    return
  }

  setListaIdActual(nuevaId)
  setNombreCulto(nombre.trim())
  await cargarCultos()
  alert("✅ Copia creada")
}

const renombrarCulto = async (culto: any) => {
  const nuevoNombre = prompt("Nuevo nombre del culto", culto.nombre || "")
  if (!nuevoNombre || !nuevoNombre.trim()) return

  const { error } = await supabase
    .from("listas_culto")
    .update({ nombre: nuevoNombre.trim() })
    .eq("id", culto.id)

  if (error) {
    console.error("Error renombrando culto:", error)
    alert("No se pudo renombrar el culto")
    return
  }

  if (listaIdActual === culto.id) {
    setNombreCulto(nuevoNombre.trim())
  }

  await cargarCultos()
  alert("✅ Culto renombrado")
}

const duplicarCulto = async (culto: any) => {
  const nuevoNombre = prompt(
    "Nombre para la copia",
    `${culto.nombre || "Culto"} (copia)`
  )
  if (!nuevoNombre || !nuevoNombre.trim()) return

  const iglesiaId = await getIglesiaIdCached()

  const { data: nuevoCulto, error: errorCulto } = await supabase
    .from("listas_culto")
    .insert({
      nombre: nuevoNombre.trim(),
      iglesia_id: iglesiaId
    })
    .select()
    .single()

  if (errorCulto || !nuevoCulto) {
    console.error("Error duplicando culto:", errorCulto)
    alert("No se pudo crear la copia del culto")
    return
  }

  const { data: items, error: errorItems } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", culto.id)
    .order("orden")

  if (errorItems) {
    console.error("Error leyendo items del culto:", errorItems)
    alert("La copia del culto se creó, pero no se pudieron leer los items")
    return
  }

  if (items && items.length > 0) {
    const inserts = items.map((item) => ({
      lista_id: nuevoCulto.id,
      orden: item.orden,
      cancion_id: item.cancion_id,
      tipo: item.tipo,
      imagen_url: item.imagen_url,
      referencia_biblica: item.referencia_biblica,
      texto_biblico: item.texto_biblico,
      estado_modo: item.estado_modo,
      estado_titulo: item.estado_titulo,
      estado_subtitulo: item.estado_subtitulo,
      estado_url: item.estado_url
    }))

    const { error: errorInsert } = await supabase
      .from("items_lista")
      .insert(inserts)

    if (errorInsert) {
      console.error("Error copiando items:", errorInsert)
      alert("El culto se duplicó, pero falló la copia de elementos")
      return
    }
  }

  await cargarCultos()
  alert("✅ Culto duplicado")
}

const cargarCultos = async () => {
  const igId = await getIglesiaIdCached()
  const query = supabase
    .from("listas_culto")
    .select("*")
    .order("fecha", { ascending: false })

  // ✅ Filtrar por iglesia si hay sesión activa
  if (igId) query.eq("iglesia_id", igId)

  const { data, error } = await query

  if (data) setCultos(data)
}

const nombreImagenAmigable = (url?: string, fallback = "Imagen") => {
  if (!url) return fallback

  const ultimo = url.split("/").pop() || fallback
  const sinExtension = ultimo.replace(/\.[^/.]+$/, "")
  const sinPrefijo = sinExtension.replace(/^\d+-[a-z0-9]+-/i, "")
  const limpio = sinPrefijo
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return limpio || fallback
}

const cargarListaDesdeBD = async (id: string) => {
  setListaIdActual(id)

  const culto = cultos.find(c => c.id === id)
  setNombreCulto(culto?.nombre || "")

  const { data: items, error } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", id)
    .order("orden")

  if (error || !items) {
    console.error("Error items:", error)
    return
  }

  const ids = items
    .map(i => i.cancion_id)
    .filter(Boolean)

  let cancionesBD: any[] = []

  if (ids.length > 0) {
    const { data: canciones, error: error2 } = await supabase
      .from("canciones")
      .select("*")
      .in("id", ids)

    if (error2) {
      console.error("Error canciones:", error2)
      return
    }

    cancionesBD = canciones || []
  }

  const listaOrdenada = items.map(item => {
    if (item.tipo === "imagen") {
      return {
        tipo: "imagen",
        url: item.imagen_url,
        titulo: nombreImagenAmigable(item.imagen_url, "Imagen")
      }
    }

    if (item.tipo === "biblia") {
  const texto = item.texto_biblico || ""
  return {
    tipo: "biblia",
    referencia: item.referencia_biblica,
    texto,
    paginas: partirEnPaginasCliente(texto),
    titulo: `📖 ${item.referencia_biblica || "Palabra"}`
      }
  
    }
    if (item.tipo === "estado") {
      return {
        tipo: "estado",
        modo: item.estado_modo,
        titulo: item.estado_titulo || "Estado",
        subtitulo: item.estado_subtitulo || "",
        url: item.estado_url || ""
      }
    }

    const cancion = cancionesBD.find(c => c.id === item.cancion_id)

    return {
      tipo: "cancion",
      id: cancion?.id || item.cancion_id,
      titulo: cancion?.titulo || "⚠️ Sin título"
    }
  })

  setLista(listaOrdenada)
  precargarPartesLista(listaOrdenada) // ✅ precarga partes en segundo plano
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setActivaId(null)
  setTituloActual("")
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY)
}


const irAItemLista = async (i: number, alFinal = false) => {
  if (!socket) return

  const item = lista[i]
  if (!item) return

  setIndiceLista(i)
  setIndiceActivoLista(i)

  if (item.tipo === "imagen") {
    setActivaId(null); setPartes([]); setIndex(0); limpiarModoBiblia()
    setAprendiendo(false); detenerAutoAvance(); setEstadoEspecialActivo("")
    socket.emit("mostrar-imagen", { url: item.url, iglesia: "" })
    return
  }

  if (item.tipo === "biblia") {
    setActivaId(null)
    setPartes([])
    setIndex(0)
    setAprendiendo(false)   // ✅ detener aprendizaje al cambiar a biblia
    detenerAutoAvance()     // ✅ detener auto-avance si estaba activo
    setEstadoEspecialActivo("")

    const paginas = item.paginas || [item.texto].filter((t): t is string => !!t)
    const pagina = alFinal ? Math.max(0, paginas.length - 1) : 0

    setPaginasBiblia(paginas)
    setPaginaBibliaActual(pagina)

    socket.emit("mostrar-biblia", {
      referencia: item.referencia,
      texto: item.texto,
      paginas,
      pagina,
      iglesia: nombreIglesia || "",
      logo_marca_url: logoEsperaUrl || "",
      fondo: fondoCancionActual()  // ✅ Bug 2: enviar fondo al proyector
    })
    return
  }

  if (item.tipo === "estado") {
    setActivaId(null)
    setPartes([])
    setIndex(0)
    limpiarModoBiblia()
    setAprendiendo(false)
    detenerAutoAvance()
    setEstadoEspecialActivo(item.titulo || item.modo || "Pantalla especial")

    // ✅ Para pantalla negra usar fondo actual o el preset por defecto
    const fondoParaEstado = item.modo === "negro"
      ? (fondoCancionActual() || { preset: fondoCancionPreset, tipo: "preset", oscuridad: fondoCancionOscuridad })
      : fondoCancionActual()

    socket.emit("mostrar-estado", {
      tipo: item.modo,
      titulo: item.titulo || "",
      subtitulo: item.subtitulo || "",
      url: item.url || "",
      logo_marca_url: logoEsperaUrl || "",
      fondo: fondoParaEstado
    })
    return
  }

  // ✅ Desde cache — sin esperar red
  const partesCancion = await getPartesCancion(item.id || "")
  const parteInicial = alFinal ? Math.max(0, partesCancion.length - 1) : 0

  setActivaId(item.id || null)
  limpiarModoBiblia()
  setEstadoEspecialActivo("")
  setPartes(partesCancion)
  setIndex(parteInicial)

  const cancion = canciones.find(c => c.id === item.id)
  registrarProyeccionCancion(cancion || item) // ✅ fire & forget
  socket.emit("cargar-cancion", {
  partes: partesCancion,
  index: parteInicial,
  titulo: cancion?.titulo || item.titulo || "",
  tono: cancion?.tono || "",
  iglesia: nombreIglesia || "",
  logo_marca_url: logoEsperaUrl || "",
  fondo: fondoCancionActual()
})

  socket.emit("cancion-activa", { id: item.id })
}

const proyectarDesdeLista = async (i: number) => {
  setMenuItemAbierto(null)
  await irAItemLista(i, false)
}

const optimizarImagen = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = () => {
      img.src = reader.result as string
    }

    reader.onerror = reject

    img.onload = () => {
      const maxWidth = 1920
      const maxHeight = 1080

      let { width, height } = img

      const scale = Math.min(
        1,
        maxWidth / width,
        maxHeight / height
      )

      const newWidth = Math.round(width * scale)
      const newHeight = Math.round(height * scale)

      const canvas = document.createElement("canvas")
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("No se pudo crear canvas"))
        return
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo optimizar la imagen"))
            return
          }

          const nombreBase = file.name.replace(/\.[^/.]+$/, "")
          const optimizedFile = new File(
            [blob],
            `${nombreBase}.webp`,
            { type: "image/webp" }
          )

          resolve(optimizedFile)
        },
        "image/webp",
        0.82
      )
    }

    img.onerror = reject
    reader.readAsDataURL(file)
  })
}

const limpiarModoBiblia = () => {
  setPaginasBiblia([])
  setPaginaBibliaActual(0)
}

const limpiarCultoActual = () => {
  setLista([])
  setListaIdActual(null)
  setNombreCulto("")
  setActivaId(null)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()
}

const categoriasDisponibles = Array.from(
  new Set(
    canciones
      .map(c => c.categoria)
      .filter(Boolean)
  )
).sort()

const nombreTono = (tono?: string) => {
  if (!tono) return ""
  return tono
}

useEffect(() => {
  if (!autoPlay) return

  const intervalo = setInterval(() => {
    siguiente()
  }, 5000) // cada 5 segundos

  return () => clearInterval(intervalo)
}, [autoPlay, index, partes])

const LIMITE_IMAGENES_NUBE = 20

const subirImagen = async (file: File) => {
  try {
    const iglesiaId = await getIglesiaIdCached()
    const archivoOptimizado = await optimizarImagen(file)
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").trim()
    const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`

    // ✅ En Electron: guardar local o nube según preferencia del usuario
    const isElectron = typeof window !== "undefined" && navigator.userAgent.includes("Electron")
    if (isElectron && modoGuardado === "local") {
      const formData = new FormData()
      formData.append("imagen", archivoOptimizado, nombreArchivo)
      const res = await fetch(`http://localhost:4000/api/imagenes/guardar`, {
        method: "POST", body: formData
      })
      if (res.ok) {
        const { url } = await res.json()
        return { url, nombre: baseName || "Imagen", local: true }
      }
    }

    // ✅ En web/APK: subir a Supabase con carpeta por iglesia
    const ruta = iglesiaId ? `${iglesiaId}/${nombreArchivo}` : nombreArchivo

    // Verificar límite
    if (iglesiaId) {
      const { data: archivos } = await supabase.storage
        .from("imagenes-culto").list(iglesiaId, { limit: LIMITE_IMAGENES_NUBE + 1 })
      if ((archivos?.length || 0) >= LIMITE_IMAGENES_NUBE) {
        alert(`Límite de ${LIMITE_IMAGENES_NUBE} imágenes en nube alcanzado. Elimina alguna para continuar.`)
        return null
      }
    }

    const { error } = await supabase.storage
      .from("imagenes-culto")
      .upload(ruta, archivoOptimizado, { cacheControl: "3600", upsert: false })

    if (error) { alert(`Error subiendo imagen: ${error.message}`); return null }

    const { data } = supabase.storage.from("imagenes-culto").getPublicUrl(ruta)
    return { url: data.publicUrl, nombre: baseName || "Imagen", local: false }

  } catch (e) {
    console.error(e); alert("Falló la subida de imagen"); return null
  }
}

// ✅ Cargar galería de imágenes de la iglesia
const cargarGaleriaImagenes = async (): Promise<{url: string, nombre: string, local: boolean}[]> => {
  const iglesiaId = await getIglesiaIdCached()
  const isElectron = typeof window !== "undefined" && navigator.userAgent.includes("Electron")
  const resultado: {url: string, nombre: string, local: boolean}[] = []

  // Imágenes locales (Electron)
  if (isElectron) {
    try {
      const res = await fetch("http://localhost:4000/api/imagenes/listar")
      if (res.ok) {
        const { imagenes } = await res.json()
        imagenes.forEach((img: any) => resultado.push({ ...img, local: true }))
      }
    } catch(e) {}
  }

  // Imágenes en nube
  if (iglesiaId) {
    const { data } = await supabase.storage
      .from("imagenes-culto").list(iglesiaId, { limit: 100, sortBy: { column: "created_at", order: "desc" } })
    if (data) {
      data.forEach(f => {
        const { data: pub } = supabase.storage.from("imagenes-culto")
          .getPublicUrl(`${iglesiaId}/${f.name}`)
        resultado.push({ url: pub.publicUrl, nombre: f.name.replace(/^\d+-[a-z0-9]+\.webp$/, "Imagen"), local: false })
      })
    }
  }
  return resultado
}

const enviarPrecargaImagenes = (items: any[]) => {
  if (!socket) return

  const urls = items
    .filter((item) => item?.tipo === "imagen" && item?.url)
    .map((item) => item.url)

  if (urls.length > 0) {
    socket.emit("precargar-imagenes", urls)
  }
}

const subirLogoEspera = async (file: File) => {
  const resultado = await subirImagen(file)
  if (!resultado?.url) return

  const iglesiaId = await getIglesiaIdCached()
  if (!iglesiaId) {
    alert("No se encontró la iglesia actual")
    return
  }

  const { error } = await supabase
    .from("iglesias")
    .update({
      logo_url: resultado.url,
      logo_nombre: resultado.nombre || "Logo"
    })
    .eq("id", iglesiaId)

  if (error) {
    console.error("Error guardando logo en iglesia:", error)
    alert("El logo se subió, pero no se pudo guardar en la iglesia")
    return
  }

  setLogoEsperaUrl(resultado.url)
  setLogoEsperaNombre(resultado.nombre || "Logo")
}

const buscarVersiculo = (ref: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!socket) { reject(new Error("Sin conexión al servidor")); return }
    socket.emit("buscar-biblia", ref, (response: any) => {
      if (response?.error) reject(new Error(response.error))
      else resolve(response)
    })
  })
}

const proyectarBiblia = async (ref: string) => {
  if (!socket) return

  try {
    const data = await buscarVersiculo(ref)

    setActivaId(null)
    setIndiceLista(null)
    setIndiceActivoLista(null)
    setPartes([])
    setIndex(0)
    setAprendiendo(false)   // ✅ Bug 1: detener aprendizaje en AMBAS rutas de biblia
    detenerAutoAvance()     // ✅ detener auto-avance si estaba activo
    setEstadoEspecialActivo("")

    setPaginasBiblia(data.paginas || [data.texto].filter((t): t is string => !!t).filter((t): t is string => !!t))
    setPaginaBibliaActual(0)

    socket.emit("mostrar-biblia", {
    referencia: data.referencia,
    texto: data.texto,
    paginas: data.paginas || [data.texto].filter((t): t is string => !!t),
    pagina: 0,
    iglesia: nombreIglesia || "",
    logo_marca_url: logoEsperaUrl || "",
    fondo: fondoCancionActual()  // ✅ Bug 2: enviar fondo al proyector
  })
  } catch (error: any) {
    alert(error.message || "No se pudo cargar el versículo")
  }
}

const agregarBibliaALista = async (ref: string) => {
  if (!ref.trim()) return

  try {
    const data = await buscarVersiculo(ref)

    agregarItemAListaConFeedback(
    {
      tipo: "biblia",
      referencia: data.referencia,
      texto: data.texto,
      paginas: data.paginas || [data.texto].filter((t): t is string => !!t),
      titulo: `📖 ${data.referencia}`
    },
    `✅ Palabra agregada: ${data.referencia}`
  )
  } catch (error: any) {
    alert(error.message || "No se pudo agregar la cita")
  }
}

// ✅ Banner de urgencia — se superpone a lo que sea que esté proyectando
// (canción, mensaje, biblia) sin reemplazarlo. Pensado para avisos que no
// pueden esperar (ej. "mover auto patente XYZ") en medio de la alabanza
// o el mensaje. A diferencia de "Mensaje rápido" (que sí reemplaza la
// pantalla, para separadores entre secciones), este no toca partes/index.
const mostrarBannerUrgente = () => {
  if (!socket || !bannerUrgente.trim()) return
  setBannerUrgenteActivo(true)
  socket.emit("mostrar-banner-urgente", bannerUrgente.trim())
}

const ocultarBannerUrgente = () => {
  if (!socket) return
  setBannerUrgenteActivo(false)
  socket.emit("ocultar-banner-urgente")
}

const proyectarMensajeRapido = () => {
  if (!socket) return
  setActivaId(null); setIndiceLista(null); setIndiceActivoLista(null)
  setPartes([]); setIndex(0); limpiarModoBiblia()
  setAprendiendo(false); detenerAutoAvance()
  setEstadoEspecialActivo("✍️ Mensaje")
  socket.emit("mostrar-estado", {
    tipo: "mensaje",
    titulo: mensajeRapido || "Espere un momento",
    subtitulo: nombreIglesia || "",
    fondo: fondoCancionActual()
  })
}

const proyectarPantallaLogo = () => {
  if (!socket) return
  if (!logoEsperaUrl.trim()) {
    alert("Primero ingresa la URL del logo o imagen")
    return
  }

  setActivaId(null); setIndiceLista(null); setIndiceActivoLista(null)
  setPartes([]); setIndex(0); limpiarModoBiblia()
  setAprendiendo(false); detenerAutoAvance()
  setEstadoEspecialActivo("🖼️ Logo")

  socket.emit("mostrar-estado", {
    tipo: "logo",
    url: logoEsperaUrl.trim(),
    titulo: nombreIglesia || "",
    subtitulo: "Espere un momento",
    fondo: fondoCancionActual()
  })
}

const proyectarPantallaNegra = () => {
  if (!socket) return

  setActivaId(null); setIndiceLista(null); setIndiceActivoLista(null)
  setPartes([]); setIndex(0); limpiarModoBiblia()
  setAprendiendo(false); detenerAutoAvance()
  if (typeof window !== "undefined") localStorage.removeItem("selah_control_estado")
  setEstadoEspecialActivo("🌑 Pantalla de descanso")

  // Pantalla de descanso: solo el fondo configurado, sin logo ni texto
  socket.emit("mostrar-estado", {
    tipo: "descanso",
    fondo: fondoCancionActual()
  })
}

const proyectarPantallaEspera = () => {
  if (!socket) return

  setActivaId(null); setIndiceLista(null); setIndiceActivoLista(null)
  setPartes([]); setIndex(0); limpiarModoBiblia()
  setAprendiendo(false); detenerAutoAvance()
  setEstadoEspecialActivo("⏳ Pantalla de espera")

  socket.emit("mostrar-estado", {
    tipo: "espera",
    titulo: "Espere un momento",
    subtitulo: nombreIglesia || "",
    fondo: fondoCancionActual()
  })
}

const agregarNegroALista = () => {
  agregarItemAListaConFeedback(
    {
      tipo: "estado",
      modo: "negro",
      titulo: "Pantalla negra"
    },
    "✅ Pantalla negra agregada"
  )
}

const agregarEsperaALista = () => {
  agregarItemAListaConFeedback(
    {
      tipo: "estado",
      modo: "espera",
      titulo: "Pantalla de espera",
      subtitulo: nombreIglesia || ""
    },
    "✅ Pantalla de espera agregada"
  )
}

const agregarMensajeALista = () => {
  agregarItemAListaConFeedback(
    {
      tipo: "estado",
      modo: "mensaje",
      titulo: mensajeRapido || "Mensaje rápido",
      subtitulo: nombreIglesia || ""
    },
    "✅ Mensaje agregado"
  )
}

const agregarLogoALista = () => {
  if (!logoEsperaUrl.trim()) {
    alert("Primero carga un logo")
    return
  }

  agregarItemAListaConFeedback(
  {
    tipo: "estado",
    modo: "logo",
    titulo: logoEsperaNombre || "Logo de espera",
    subtitulo: nombreIglesia || "",
    url: logoEsperaUrl,
    nombre: logoEsperaNombre || "Logo"
  },
  "✅ Logo agregado"
)
}

const limpiarTituloLista = (titulo?: string) => {
  return (titulo || "")
    .replace(/^(🎵|📖|🖼️|⚫|⏳|✍️|✨)\s*/u, "")
    .trim()
}

const resumirTexto = (texto?: string, max = 45) => {
  const limpio = (texto || "").trim()
  if (limpio.length <= max) return limpio
  return limpio.slice(0, max).trimEnd() + "..."
}

const subtituloItemLista = (item: any) => {
  if (item?.tipo === "cancion") return "Canción"
  if (item?.tipo === "biblia") return "Palabra"
  if (item?.tipo === "imagen") return "Imagen"

  if (item?.tipo === "estado") {
    if (item.modo === "mensaje") return "Mensaje"
    if (item.modo === "espera") return "Espera"
    if (item.modo === "negro") return "Pantalla negra"
    if (item.modo === "logo") return "Logo"
    return "Estado"
  }

  return ""
}

const iconoItemLista = (item: any) => {
  if (item?.tipo === "cancion") return "🎵"
  if (item?.tipo === "biblia") return "📖"
  if (item?.tipo === "imagen") return "🖼️"

  if (item?.tipo === "estado") {
    if (item.modo === "negro") return "⚫"
    if (item.modo === "espera") return "⏳"
    if (item.modo === "mensaje") return "✍️"
    if (item.modo === "logo") return "🖼️"
    return "✨"
  }

  return "•"
}

const tituloCancionVisible = (c: any) => {
  const numero = c?.numero ? `${c.numero}. ` : ""
  return `${numero}${c?.titulo || "Sin título"}`
}

const subtituloCancionVisible = (c: any) => {
  const partes: string[] = []

  if (c?.categoria) partes.push(c.categoria)
  if (c?.tono) partes.push(nombreTono(c.tono))
  if (idsCancionesConAcordes.includes(c?.id)) partes.push("Con acordes")

  return partes.join(" • ")
}


const sugerenciasBiblia = [
  "Génesis 1",
  "Éxodo 20",
  "Josué 1",
  "Salmos 1",
  "Salmos 23",
  "Salmos 91",
  "Proverbios 3",
  "Isaías 53",
  "Jeremías 29:11",
  "Mateo 5",
  "Mateo 6",
  "Juan 1",
  "Juan 3:16",
  "Juan 14",
  "Hechos 2",
  "Romanos 8",
  "1 Corintios 13",
  "2 Corintios 5:17",
  "Gálatas 5",
  "Efesios 6",
  "Filipenses 4:13",
  "Hebreos 11",
  "Santiago 1",
  "1 Pedro 1",
  "Apocalipsis 21"
]


function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const obtenerFragmentoBusqueda = (
  texto: string,
  busqueda: string,
  largo = 90
) => {
  if (!texto || !busqueda) return ""

  const textoNorm = normalizar(texto)
  const busquedaNorm = normalizar(busqueda)

  const index = textoNorm.indexOf(busquedaNorm)

  if (index === -1) return ""

  const inicio = Math.max(0, index - 30)
  const fin = Math.min(texto.length, index + largo)

  let fragmento = texto.slice(inicio, fin).trim()

  if (inicio > 0) fragmento = "..." + fragmento
  if (fin < texto.length) fragmento += "..."

  return fragmento
}


const cancionesFiltradas = useMemo(() => {
  const q = normalizar(busquedaDebounced || "").trim()

  // ✅ Detectar patrones de búsqueda:
  // "263"           → solo número
  // "263 yo quiero" → número + texto (muy común en iglesias)
  // "yo quiero"     → solo texto
  const esNumero = /^\d+$/.test(q)
  const matchNumTexto = q.match(/^(\d+)\s+(.+)$/)  // ej: "263 yo quiero trabajar"
  const numParte   = matchNumTexto?.[1] || ""       // "263"
  const textoParte = matchNumTexto?.[2] || ""       // "yo quiero trabajar"

  const scored = canciones
    .map(c => {
      if (!q) return { c, score: 0, pass: true }

      const titulo    = normalizar(c.titulo || "")
      const numero    = String(c.numero || "")
      const categoria = normalizar(c.categoria || "")

      // ── Búsqueda "263 yo quiero trabajar" (número + texto) ──────────────
      if (matchNumTexto) {
        const numOk    = numero === numParte || numero.startsWith(numParte)
        const tituloOk = titulo.includes(textoParte)
        if (numOk && tituloOk) return { c, score: 100, pass: true }
        if (numOk)             return { c, score: 80,  pass: true }
        if (tituloOk)          return { c, score: 60,  pass: true }
        return { c, score: 0, pass: false }
      }

      // ── Búsqueda solo por número ─────────────────────────────────────────
      if (esNumero) {
        if (numero === q)          return { c, score: 100, pass: true }
        if (numero.startsWith(q))  return { c, score: 80,  pass: true }
        return { c, score: 0, pass: false }
      }

      // ── Búsqueda por texto ───────────────────────────────────────────────
      if (titulo === q)            return { c, score: 100, pass: true }
      if (titulo.startsWith(q))    return { c, score: 90,  pass: true }
      if (titulo.includes(q))      return { c, score: 70,  pass: true }
      if (categoria.includes(q))   return { c, score: 30,  pass: true }
      const texto = normalizar(c.texto_busqueda || "")
      if (texto.includes(q))       return { c, score: 10,  pass: true }

      return { c, score: 0, pass: false }
    })
    .filter(x => x.pass)
    .filter(x => !filtroTono     || x.c.tono === filtroTono)
    .filter(x => !filtroCategoria || x.c.categoria === filtroCategoria)

  // Si hay búsqueda activa ordenar por relevancia, si no por el orden elegido
  if (q) {
    return scored
      .sort((a, b) => b.score - a.score || (a.c.numero ?? 999999) - (b.c.numero ?? 999999))
      .map(x => x.c)
  }

  return scored
    .map(x => x.c)
    .sort((a, b) => {
      if (ordenar === "az")       return (a.titulo || "").localeCompare(b.titulo || "")
      if (ordenar === "za")       return (b.titulo || "").localeCompare(a.titulo || "")
      if (ordenar === "reciente") return new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
      if (ordenar === "antigua")  return new Date(a.fecha_creacion || 0).getTime() - new Date(b.fecha_creacion || 0).getTime()
      const na = a.numero ?? 999999, nb = b.numero ?? 999999
      if (na !== nb) return na - nb
      return (a.titulo || "").localeCompare(b.titulo || "")
    })
}, [canciones, busquedaDebounced, filtroTono, filtroCategoria, ordenar])

const scrollCancionesRef = useRef<HTMLDivElement | null>(null)
const [scrollTopCanciones, setScrollTopCanciones] = useState(0)

const ALTURA_ITEM_CANCION = 64  // achicado de 88 — más canciones visibles sin scrollear
const OVERSCAN_CANCIONES = 10   // margen amplio para evitar gaps visibles

const inicioVirtualCanciones = Math.max(
  0,
  Math.floor(scrollTopCanciones / ALTURA_ITEM_CANCION) - OVERSCAN_CANCIONES
)

const cantidadVisibleCanciones = 15

const finVirtualCanciones = Math.min(
  cancionesFiltradas.length,
  inicioVirtualCanciones + cantidadVisibleCanciones + OVERSCAN_CANCIONES * 2
)

// ── Precarga en background las primeras 100 canciones visibles (batch) ──
useEffect(() => {
  const ids = cancionesFiltradas.slice(0, 100).map(c => c.id)
  precargarPartesBatch(ids)
}, [cancionesFiltradas.length])

useEffect(() => {
  if (isMobile) return
  const contenedor = scrollCancionesRef.current
  if (!contenedor) return
  // Ir siempre al primer resultado — con o sin búsqueda activa,
  // el usuario espera ver lo más relevante arriba de inmediato
  requestAnimationFrame(() => {
    contenedor.scrollTo({ top: 0, behavior: "smooth" })
  })
}, [busquedaDebounced, isMobile])

const cancionesVirtuales = cancionesFiltradas.slice(
  inicioVirtualCanciones,
  finVirtualCanciones
)

useEffect(() => {
  if (isMobile || !activaId) return

  const contenedor = scrollCancionesRef.current
  if (!contenedor) return

  const posicion = cancionesFiltradas.findIndex((c) => c.id === activaId)
  if (posicion === -1) return

  const top = Math.max(
    0,
    posicion * ALTURA_ITEM_CANCION -
      contenedor.clientHeight / 2 +
      ALTURA_ITEM_CANCION / 2
  )

  requestAnimationFrame(() => {
    contenedor.scrollTo({
      top,
      behavior: "smooth"
    })
  })
}, [isMobile, activaId, cancionesFiltradas.length])

const centrarCancionEnLista = (id: string) => {
  if (isMobile) return

  const contenedor = scrollCancionesRef.current
  if (!contenedor) {
    console.log("❌ No existe scrollCancionesRef")
    return
  }

  const posicion = cancionesFiltradas.findIndex((c) => c.id === id)

  if (posicion === -1) {
    console.log("❌ Canción activa no está en cancionesFiltradas:", id)
    return
  }

  const top = Math.max(
    0,
    posicion * ALTURA_ITEM_CANCION -
      contenedor.clientHeight / 2 +
      ALTURA_ITEM_CANCION / 2
  )

  console.log("🎯 centrando canción:", {
    id,
    posicion,
    top,
    alturaItem: ALTURA_ITEM_CANCION,
    altoContenedor: contenedor.clientHeight
  })

  contenedor.scrollTo({
    top,
    behavior: "smooth"
  })
}

useEffect(() => {
  if (isMobile) return
  if (!activaId) return

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      centrarCancionEnLista(activaId)
    })
  })
}, [isMobile, activaId, cancionesFiltradas.length])

// ✅ Auto-scroll al cargar el control si ya había una canción activa
useEffect(() => {
  if (cargandoControl || !activaId || isMobile) return
  setTimeout(() => centrarCancionEnLista(activaId), 500)
}, [cargandoControl])

const agregarItemAListaConFeedback = (item: any, mensaje: string) => {
  setLista(prev => {
    indicePendienteScrollRef.current = prev.length
    return [...prev, item]
  })

  mostrarFeedbackLista(mensaje)
}

useEffect(() => {
  const indice = indicePendienteScrollRef.current
  if (indice === null) return
  indicePendienteScrollRef.current = null
  setIndiceItemAgregado(indice)
  const timeout = setTimeout(() => setIndiceItemAgregado(null), 1400)
  return () => clearTimeout(timeout)
}, [lista.length])

useEffect(() => {
  if (!iglesiaIdActual) return
  if (!fondoCancionConfigLista) return

  const config = {
    url: fondoCancionUrl,
    nombre: fondoCancionNombre,
    modo: fondoCancionModo,
    preset: fondoCancionPreset,
    oscuridad: fondoCancionOscuridad,
    ajuste: fondoCancionAjuste
  }

  localStorage.setItem(
    `fondo-cancion-${iglesiaIdActual}`,
    JSON.stringify(config)
  )
}, [
  iglesiaIdActual,
  fondoCancionConfigLista,
  fondoCancionUrl,
  fondoCancionNombre,
  fondoCancionModo,
  fondoCancionPreset,
  fondoCancionOscuridad,
  fondoCancionAjuste
])

const guardarCultoConNombre = async (nombre: string) => {
  if (!nombre.trim()) return
  setNombreCulto(nombre.trim())
  await guardarCulto()
}

const etiquetaBoton = (texto: string) => {
  return isMobile ? "" : ` ${texto}`
}

if (!pantallaDetectada) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)"
      }}
    />
  )
}
if (cargandoControl) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(30, 41, 59, 0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "22px",
          padding: "28px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "58px",
            height: "58px",
            borderRadius: "999px",
            border: "4px solid rgba(255,255,255,0.16)",
            borderTopColor: "#38bdf8",
            margin: "0 auto 18px auto",
            animation: "spinCargaControl 0.9s linear infinite"
          }}
        />

        <style>{`
          @keyframes spinCargaControl {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            marginBottom: "8px"
          }}
        >
          Control de Culto
        </div>

        <div
          style={{
            fontSize: "14px",
            opacity: 0.78,
            lineHeight: 1.5
          }}
        >
          {mensajeCargaControl}
        </div>

        <div
          style={{
            marginTop: "18px",
            height: "8px",
            borderRadius: "999px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)"
          }}
        >
          <div
            style={{
              height: "100%",
              width: "68%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
              animation: "barraCargaControl 1.2s ease-in-out infinite"
            }}
          />
        </div>

        <style>{`
          @keyframes barraCargaControl {
            0% {
              transform: translateX(-110%);
            }
            50% {
              transform: translateX(30%);
            }
            100% {
              transform: translateX(160%);
            }
          }
        `}</style>
      </div>
    </div>
  )
}

const etiquetaParteControl = (() => {
  if (estadoEspecialActivo) return estadoEspecialActivo
  if (paginasBiblia.length > 0) {
    return `📖 Palabra • Página ${paginaBibliaActual + 1} de ${paginasBiblia.length}`
  }

  if (partes.length > 0) {
    const parteActual = partes[index]
    const tipo = parteActual?.tipo || "Parte"

    let nombreParte = tipo

    if (tipo === "Verso") {
      let numeroVerso = 0

      for (let i = 0; i <= index; i++) {
        if (partes[i]?.tipo === "Verso") {
          numeroVerso++
        }
      }

      nombreParte = `Verso ${numeroVerso}`
    }

    return `🎵 ${nombreParte} • Parte ${index + 1} de ${partes.length}`
  }

  if (indiceActivoLista !== null && lista[indiceActivoLista]) {
    return `📋 Elemento ${indiceActivoLista + 1} de ${lista.length}`
  }

  return "Sin proyección activa"
})()

const container: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
  color: "white",
  padding: isMobile ? "0px" : "18px",
  paddingTop: isMobile ? "6px" : "18px",
  display: "flex",
  flexDirection: "column",
  gap: isMobile ? "8px" : "16px",
  boxSizing: "border-box"
}

const topbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "12px"
}

const controles: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
  flexWrap: "nowrap",
  background: "rgba(15, 23, 42, 0.97)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: isMobile ? "8px 10px" : "14px",
  position: "sticky",
  top: isMobile ? "8px" : "12px",
  zIndex: 80,
  backdropFilter: "blur(8px)",
  boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
  alignSelf: "stretch"
}

const seccion: CSSProperties = {
  background: "rgba(30, 41, 59, 0.96)",
  padding: isMobile ? "12px" : "16px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.22)"
}

const titulo: CSSProperties = {
  fontSize: isMobile ? "18px" : "22px",
  fontWeight: 700,
  marginBottom: "12px"
}

const subtitulo: CSSProperties = {
  fontSize: "14px",
  opacity: 0.75,
  marginBottom: "10px"
}

const card: CSSProperties = {
  background: "#243449",
  padding: isMobile ? "8px 10px" : "12px",
  borderRadius: "12px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: isMobile ? "flex-start" : "center",
  gap: "10px"
}

const acciones: CSSProperties = isMobile
  ? {
      display: "grid",
      gridTemplateColumns: "repeat(2, 42px)",
      gap: "6px",
      flexShrink: 0
    }
  : {
      display: "flex",
      gap: "8px",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      flexShrink: 0
    }

const btn: CSSProperties = {
  padding: isMobile ? "8px 10px" : "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700
}

const btnSecundario: CSSProperties = {
  ...btn,
  background: "#334155",
  padding: isMobile ? "8px 10px" : "10px 14px"
}

const btnVerde: CSSProperties = {
  ...btn,
  background: "#16a34a"
}

const btnRojo: CSSProperties = {
  ...btn,
  background: "#dc2626"
}

const btnGrande: CSSProperties = {
  padding: isMobile ? "8px 12px" : "12px 16px",
  fontSize: isMobile ? "16px" : "18px",
  borderRadius: "12px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minWidth: isMobile ? "56px" : "64px"
}

const input: CSSProperties = {
  width: "100%",
  padding: isMobile ? "10px 12px" : "12px 14px",
  marginBottom: "10px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0f172a",
  color: "white",
  outline: "none",
  fontSize: isMobile ? "14px" : "15px"
}

const fila: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  alignItems: "center"
}

const gridDesktop: CSSProperties = {
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
  gap: isMobile ? "16px" : "28px",
  alignItems: "start",
  width: "100%",
  boxSizing: "border-box"
}

const columna: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px"
}

const columnaLista: CSSProperties = {
 display: "flex",
  flexDirection: "column",
  gap: "16px",
  height: "100%",
  minHeight: 0
}



const btnListaMini: CSSProperties = {
  width: "42px",
  height: "42px",
  padding: 0,
  borderRadius: "10px",
  border: "none",
  background: "#334155",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}
const btnListaPlay: CSSProperties = {
  ...btnListaMini,
  background: "#2563eb"
}
const btnListaDelete: CSSProperties = {
  ...btnListaMini,
  background: "#dc2626"
}

const btnListaMenu: CSSProperties = {
  ...btnListaMini,
  background: "#475569"
}

const textoCardPrincipal: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  alignSelf: "stretch"
}

const tituloCardResponsive = (isMobile: boolean): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: isMobile ? 2 : 1,
  WebkitBoxOrient: "vertical" as any,
  fontWeight: 700,
  minWidth: 0,
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  wordBreak: "break-word"
})

const subtituloCardResponsive = (isMobile: boolean): CSSProperties => ({
  fontSize: isMobile ? "11px" : "12px",
  opacity: 0.68,
  marginTop: "4px",
  whiteSpace: isMobile ? "normal" : "nowrap",
  overflow: "hidden",
  textOverflow: isMobile ? "clip" : "ellipsis",
  wordBreak: "break-word",
  lineHeight: 1.2
})

const colorCategoria = (cat?: string): { bg: string; border: string; text: string } => {
  switch ((cat || "").toLowerCase()) {
    case "alabanza":    return { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)",  text: "#fcd34d" }
    case "adoración":   return { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", text: "#c4b5fd" }
    case "avivamiento": return { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",   text: "#fca5a5" }
    case "comunión":    return { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.35)",  text: "#6ee7b7" }
    case "evangelismo": return { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.35)",  text: "#fdba74" }
    case "gratitud":    return { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)",   text: "#86efac" }
    case "ofrenda":     return { bg: "rgba(14,165,233,0.12)",  border: "rgba(14,165,233,0.35)",  text: "#7dd3fc" }
    case "bienvenida":  return { bg: "rgba(99,179,237,0.12)",  border: "rgba(99,179,237,0.35)",  text: "#93c5fd" }
    case "cierre":      return { bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.35)", text: "#d1d5db" }
    default:            return { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.55)" }
  }
}

return (
<>
<style>{`
  @keyframes spinCtrl { to { transform: rotate(360deg) } }
  /* Fallback height para browsers sin svh */
  html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; }
  @keyframes toastIn  { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
  /* Scrollbar global desktop */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.22);
}

#scroll-canciones::-webkit-scrollbar { width: 6px }
  #scroll-canciones::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px }
  #scroll-canciones::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 999px }
  #scroll-lista::-webkit-scrollbar { width: 6px }
  #scroll-lista::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px }
  #scroll-lista::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 999px }
  .ctrl-btn { transition: opacity 0.15s, transform 0.1s }
  .ctrl-btn:active { transform: scale(0.95) }
  .ctrl-btn:disabled { opacity: 0.4 !important; cursor: not-allowed }
`}</style>


{/* ── BOTTOM SHEET MOBILE (preview rápido) ──────────────────────── */}
{isMobile && bottomSheetAbierto && previewCancion && (
  <>
    {/* Overlay */}
    <div onClick={() => setBottomSheetAbierto(false)} style={{
      position: "fixed", inset: 0, zIndex: 9990,
      background: "rgba(0,0,0,0.5)"
    }} />
    {/* Sheet */}
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      zIndex: 9991, background: "#0d1b2e",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px 16px 0 0",
      padding: "0 0 env(safe-area-inset-bottom)",
      maxHeight: "70dvh", display: "flex", flexDirection: "column"
    }}>
      {/* Handle — click para cerrar */}
      <div onClick={() => setBottomSheetAbierto(false)}
        style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", cursor: "pointer" }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.3)" }} />
      </div>

      {/* Header */}
      <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {previewCancion.titulo}
          </div>
          {previewCancion.tono && <div style={{ fontSize: 12, opacity: 0.5 }}>{previewCancion.tono}</div>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: 2 }}>
            <button onClick={() => setPreviewModoMusico(false)} style={{
              padding: "4px 9px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: !previewModoMusico ? "#2563eb" : "transparent", color: "white"
            }}>A</button>
            <button onClick={() => setPreviewModoMusico(true)} style={{
              padding: "4px 9px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: previewModoMusico ? "#f59e0b" : "transparent", color: "white"
            }}>🎸</button>
          </div>
          <button onClick={() => { setBottomSheetAbierto(false); abrirVisor(previewCancion) }} style={{
            padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer"
          }}>⛶</button>
        </div>
      </div>

      {/* Tabs de partes */}
      {previewPartes.length > 0 && (
        <div style={{ display: "flex", gap: 4, padding: "0 14px 8px", overflowX: "auto" }}>
          {previewPartes.map((p, i) => (
            <button key={i} onClick={() => setPreviewIndex(i)} style={{
              padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              background: previewIndex === i ? "#2563eb" : "rgba(255,255,255,0.07)",
              color: previewIndex === i ? "white" : "rgba(255,255,255,0.5)"
            }}>{p.tipo || `Parte ${i+1}`}</button>
          ))}
        </div>
      )}

      {/* Contenido letra */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px", minHeight: 80 }}>
        {previewPartes.length === 0 ? (
          <div style={{ opacity: 0.4, fontSize: 13 }}>Cargando...</div>
        ) : (() => {
          const parte = previewPartes[previewIndex]
          if (!parte) return null
          const texto = parte.texto || parte.texto_acordes || ""
          if (!previewModoMusico) {
            const limpio = texto.split("\n")
              .filter((l: string) => {
                if (!l.trim()) return false
                const tokens = l.trim().split(/\s+/)
                return !tokens.every((t: string) => t.length <= 6 &&
                  /^(Do#?|Reb?|Re#?|Mib?|Mi|Fa#?|Solb?|Sol#?|Lab?|La#?|Sib?|Si|[A-G])(b|#)?(m|maj|min|sus|dim|aug|add)?\d*$/.test(t))
              })
              .map((l: string) => l.replace(/\[[^\]]*\]/g, "").trim())
              .join("\n")
            return <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.7, fontWeight: 500, color: "rgba(255,255,255,0.92)" }}>{limpio.trim()}</pre>
          }
          return (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.75, color: "white" }}>
              {texto.split("\n").map((linea: string, i: number) => {
                if (linea.includes("[")) {
                  const parts: React.ReactNode[] = []
                  let last = 0
                  const re = /\[([^\]]+)\]/g
                  let m: RegExpExecArray | null
                  while ((m = re.exec(linea)) !== null) {
                    if (m.index > last) parts.push(<span key={"t"+last}>{linea.slice(last, m.index)}</span>)
                    parts.push(<span key={"a"+m.index} style={{ color: "#fbbf24", fontWeight: 800, fontSize: "0.75em", verticalAlign: "super" }}>{m[1]}</span>)
                    last = m.index + m[0].length
                  }
                  if (last < linea.length) parts.push(<span key={"t"+last}>{linea.slice(last)}</span>)
                  return <div key={i}>{parts}</div>
                }
                if (!linea.trim()) return <div key={i} style={{ height: 4 }} />
                return <div key={i} style={{ color: "white" }}>{linea}</div>
              })}
            </div>
          )
        })()}
      </div>

      {/* Acciones */}
      <div style={{ padding: "8px 14px 12px", display: "flex", gap: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => { proyectar(previewCancion.id); setBottomSheetAbierto(false) }} style={{
          flex: 1, padding: "11px", borderRadius: 10, border: "none",
          background: socket ? "#2563eb" : "rgba(255,255,255,0.07)",
          color: "white", fontWeight: 800, fontSize: 14, cursor: socket ? "pointer" : "not-allowed",
          opacity: socket ? 1 : 0.5
        }}>▶ Proyectar</button>
        <button onClick={() => { agregarALista(previewCancion); setBottomSheetAbierto(false) }} style={{
          padding: "11px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer"
        }}>+</button>
      </div>
    </div>
  </>
)}

{/* ── MODAL CONECTAR SERVIDOR ───────────────────────────────────── */}
{modalServidor && (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9995,
    background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24
  }}>
    <div style={{
      background: "#0d1b2e", borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.1)",
      padding: 24, maxWidth: 320, width: "100%", textAlign: "center"
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Sin conexión al servidor</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20, lineHeight: 1.5 }}>
        Para proyectar en el PC necesitas estar conectado al servidor de la iglesia.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => { setModalServidor(false); router.push("/configurar-servidor") }} style={{
          padding: "12px", borderRadius: 10, border: "none",
          background: "#2563eb", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer"
        }}>🔍 Buscar servidor</button>
        <button onClick={() => setModalServidor(false)} style={{
          padding: "12px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)", color: "white",
          fontWeight: 600, fontSize: 13, cursor: "pointer"
        }}>Seguir sin proyectar</button>
      </div>
    </div>
  </div>
)}

{/* ── VISOR FULLSCREEN MOBILE ──────────────────────────────────── */}
{visorAbierto && (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "#000", color: "white",
    display: "flex", flexDirection: "column",
    fontFamily: "'Segoe UI', system-ui, sans-serif"
  }}>
    {/* Header */}
    <div style={{
      flexShrink: 0, display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      background: "rgba(255,255,255,0.05)",
      borderBottom: "1px solid rgba(255,255,255,0.08)"
    }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{visorTitulo}</div>
        {visorTono && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{visorTono}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* Toggle Letra / Músico */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 2 }}>
          <button onClick={() => setVisorModoMusico(false)} style={{
            padding: "5px 9px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: !visorModoMusico ? "#2563eb" : "transparent", color: "white"
          }}>Letra</button>
          <button onClick={() => setVisorModoMusico(true)} style={{
            padding: "5px 9px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: visorModoMusico ? "#f59e0b" : "transparent", color: "white"
          }}>🎸</button>
        </div>
        {/* Toggle Do / C */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 2 }}>
          <button onClick={() => setVisorFormatoAmericano(false)} style={{
            padding: "5px 9px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: !visorFormatoAmericano ? "rgba(255,255,255,0.18)" : "transparent", color: "white"
          }}>Do</button>
          <button onClick={() => setVisorFormatoAmericano(true)} style={{
            padding: "5px 9px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: visorFormatoAmericano ? "rgba(255,255,255,0.18)" : "transparent", color: "white"
          }}>C</button>
        </div>
        <button onClick={() => setVisorAbierto(false)} style={{
          width: 34, height: 34, borderRadius: 8, border: "none",
          background: "rgba(239,68,68,0.15)", color: "#fca5a5",
          fontWeight: 800, fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>✕</button>
      </div>
    </div>

    {/* Indicador parte */}
    <div style={{
      flexShrink: 0, textAlign: "center", padding: "6px 16px",
      fontSize: 12, fontWeight: 700, opacity: 0.5,
      background: "rgba(255,255,255,0.03)"
    }}>
      {visorPartes[visorIndex]?.tipo || "Parte"} {visorIndex + 1}/{visorPartes.length}
    </div>

    {/* Contenido letra */}
    <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
      {visorPartes[visorIndex] && (() => {
        const textoOriginal = visorPartes[visorIndex].texto_acordes || visorPartes[visorIndex].texto || ""
        const texto = transponerTexto(textoOriginal, visorSemitonos, visorFormatoAmericano)
        // Detectar si una línea es solo acordes (sin letra)
        const esSoloAcordes = (l: string) => {
          if (!l.trim()) return false
          const tokens = l.trim().split(/\s+/)
          return tokens.every((t: string) =>
            t.match(/^(Do#?|Reb?|Re#?|Mib?|Mi|Fa#?|Solb?|Sol#?|Lab?|La#?|Sib?|Si|[A-G])(b|#)?(m|maj|min|sus|dim|aug|add)?\d*(\/[A-G])?$/)
          )
        }

        if (!visorModoMusico) {
          // Modo Letra: quitar acordes en corchetes Y líneas de solo acordes
          const limpio = texto.split("\n")
            .filter((l: string) => !esSoloAcordes(l))
            .map((l: string) => l.replace(/\[[A-Za-z#b0-9m7dimsus/]+\]/g, "").trim())
            .filter((l: string, i: number, arr: string[]) => !(l === "" && arr[i-1] === ""))
            .join("\n")
          return <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.85, fontSize: "clamp(20px, 4.5vw, 30px)", fontWeight: 600 }}>{limpio.trim()}</pre>
        }

        // Modo Músico: renderizar acordes de forma limpia
        return (
          <div style={{ fontFamily: "'Courier New', monospace", lineHeight: 1.85 }}>
            {texto.split("\n").map((linea: string, i: number) => {
              // Línea con acordes en corchetes [Do]
              if (linea.includes("[")) {
                const parts: React.ReactNode[] = []
                let last = 0
                const re = /\[([A-Za-z#b0-9m7dimsus/]+)\]/g
                let m: RegExpExecArray | null
                while ((m = re.exec(linea)) !== null) {
                  if (m.index > last) parts.push(<span key={"t"+last}>{linea.slice(last, m.index)}</span>)
                  parts.push(
                    <span key={"a"+m.index} style={{
                      color: "#fbbf24", fontWeight: 800,
                      fontSize: "0.75em", verticalAlign: "super",
                      letterSpacing: "0.02em", margin: "0 1px"
                    }}>{m[1]}</span>
                  )
                  last = m.index + m[0].length
                }
                if (last < linea.length) parts.push(<span key={"t"+last}>{linea.slice(last)}</span>)
                return <div key={i} style={{ fontSize: "clamp(16px, 3.8vw, 26px)", fontWeight: 600, marginBottom: 2 }}>{parts}</div>
              }
              // Línea de solo acordes
              if (esSoloAcordes(linea)) {
                return (
                  <div key={i} style={{ fontSize: "clamp(14px, 3vw, 20px)", fontWeight: 800, color: "#fbbf24", letterSpacing: 3, marginTop: 6, marginBottom: 0 }}>
                    {linea}
                  </div>
                )
              }
              if (!linea.trim()) return <div key={i} style={{ height: 6 }} />
              return <div key={i} style={{ fontSize: "clamp(16px, 3.8vw, 26px)", fontWeight: 600 }}>{linea}</div>
            })}
          </div>
        )
      })()}
    </div>

    {/* Transposición */}
    <div style={{
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "8px 16px",
      background: "rgba(255,255,255,0.02)",
      borderTop: "1px solid rgba(255,255,255,0.04)"
    }}>
      <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 700 }}>TONO</span>
      <button onClick={() => setVisorSemitonos(s => s - 1)} style={{
        width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.07)", color: "white", fontSize: 16, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800
      }}>−</button>
      <div style={{
        minWidth: 70, textAlign: "center", fontSize: 14, fontWeight: 800,
        color: visorSemitonos === 0 ? "rgba(255,255,255,0.6)" : "#fbbf24"
      }}>
        {visorSemitonos === 0 ? "Original" : (visorSemitonos > 0 ? `+${visorSemitonos}` : visorSemitonos) + " st"}
      </div>
      <button onClick={() => setVisorSemitonos(s => s + 1)} style={{
        width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.07)", color: "white", fontSize: 16, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800
      }}>+</button>
      {visorSemitonos !== 0 && (
        <button onClick={() => setVisorSemitonos(0)} style={{
          padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.3)",
          background: "rgba(251,191,36,0.08)", color: "#fbbf24", fontSize: 11, fontWeight: 700, cursor: "pointer"
        }}>reset</button>
      )}
    </div>

    {/* Navegación */}
    <div style={{
      flexShrink: 0, display: "flex", gap: 10,
      padding: "12px 16px", justifyContent: "center", alignItems: "center",
      background: "rgba(255,255,255,0.03)",
      borderTop: "1px solid rgba(255,255,255,0.06)"
    }}>
      <button onClick={() => setVisorIndex(i => Math.max(0, i - 1))} disabled={visorIndex === 0}
        style={{
          flex: 1, maxWidth: 100, padding: "12px", borderRadius: 12, border: "none",
          background: visorIndex === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)",
          color: "white", fontSize: 20, cursor: visorIndex === 0 ? "not-allowed" : "pointer", opacity: visorIndex === 0 ? 0.3 : 1
        }}>⬅️</button>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {visorPartes.map((_, i) => (
          <div key={i} onClick={() => setVisorIndex(i)} style={{
            width: i === visorIndex ? 18 : 7, height: 7, borderRadius: 4, cursor: "pointer",
            transition: "all 0.2s", background: i === visorIndex ? "#2563eb" : "rgba(255,255,255,0.2)"
          }} />
        ))}
      </div>
      <button onClick={() => setVisorIndex(i => Math.min(visorPartes.length - 1, i + 1))} disabled={visorIndex === visorPartes.length - 1}
        style={{
          flex: 1, maxWidth: 100, padding: "12px", borderRadius: 12, border: "none",
          background: visorIndex === visorPartes.length - 1 ? "rgba(255,255,255,0.05)" : "#2563eb",
          color: "white", fontSize: 20, cursor: visorIndex === visorPartes.length - 1 ? "not-allowed" : "pointer",
          opacity: visorIndex === visorPartes.length - 1 ? 0.3 : 1
        }}>➡️</button>
    </div>

    {/* Proyectar al PC */}
    <div style={{ flexShrink: 0, padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      <button
        onClick={() => {
          if (!socket) { alert("Sin conexión al servidor"); return }
          const cancionId = visorPartes[0]?.cancion_id
          if (cancionId) proyectar(cancionId)
          setVisorAbierto(false)
        }}
        style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          background: socket ? "linear-gradient(135deg, #2563eb, #6366f1)" : "rgba(255,255,255,0.06)",
          color: "white", fontWeight: 800, fontSize: 15, cursor: socket ? "pointer" : "not-allowed",
          opacity: socket ? 1 : 0.5
        }}
      >{socket ? "🖥️ Proyectar en PC" : "Sin conexión al servidor"}</button>
    </div>
  </div>
)}

{/* Toast fijo */}
{mensajeFlash && (
  <div style={{
    position: "fixed", top: isMobile ? 68 : 68, left: "50%",
    transform: "translateX(-50%)", zIndex: 999,
    background: mensajeFlash.startsWith("⚠️") ? "rgba(202,138,4,0.97)" : "rgba(22,163,74,0.97)",
    color: "white", fontWeight: 700, fontSize: 13,
    padding: "8px 18px", borderRadius: 20,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    whiteSpace: "nowrap", animation: "toastIn 0.2s ease",
    pointerEvents: "none"
  }}>{mensajeFlash}</div>
)}

{/* ── Modal guardar culto ─────────────────────────────────────────────────── */}
{modalGuardar && (
  <div style={{
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
  }}>
    <div style={{
      background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 20, padding: 24, width: "100%", maxWidth: 420,
      boxShadow: "0 24px 60px rgba(0,0,0,0.5)"
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
        💾 {listaIdActual ? "Actualizar culto" : "Guardar lista de culto"}
      </div>
      <input
        autoFocus
        value={nombreModal}
        onChange={e => setNombreModal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            setModalGuardar(false)
            guardarCultoConNombre(nombreModal)
          }
          if (e.key === "Escape") setModalGuardar(false)
        }}
        placeholder="Nombre del culto..."
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)", background: "#0a1525",
          color: "white", fontSize: 16, outline: "none", boxSizing: "border-box",
          marginBottom: 16
        }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="ctrl-btn"
          onClick={() => { setModalGuardar(false); guardarCultoConNombre(nombreModal) }}
          style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none",
            background: "#2563eb", color: "white", fontWeight: 800,
            fontSize: 15, cursor: "pointer"
          }}
        >
          Guardar
        </button>
        <button
          className="ctrl-btn"
          onClick={() => setModalGuardar(false)}
          style={{
            padding: "12px 18px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)", color: "white",
            fontWeight: 700, fontSize: 15, cursor: "pointer"
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

<div style={{
  height: isMobile && alturaVP ? `${alturaVP - 52}px` : "calc(100dvh - 52px)",
  width: "100%",
  background: "linear-gradient(180deg, #060d1a 0%, #0f172a 100%)",
  color: "white",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  display: "flex", flexDirection: "column",
  boxSizing: "border-box",
}}>

  {/* ── BARRA DE NAVEGACIÓN SUPERIOR ─────────────────────────────────────── */}
  <div style={{
    flexShrink: 0, zIndex: 80,
    background: "rgba(6,13,26,0.97)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    padding: isMobile ? "6px 10px" : "10px 20px",
  }}>
    {/* Fila 1: título + flechas */}
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 800, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 5 }}>
          🎛️ Control
          {(socketConectado === false || (socketConectado === null && !!(window as any).Capacitor)) && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
              background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)"
            }}>● SIN CONEXIÓN</span>
          )}
          {socketConectado === true && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
              background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)"
            }}>● EN LÍNEA</span>
          )}
          {proyectorConectado && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
              background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)"
            }}>🖥️ Proyector</span>
          )}
        </div>
        {nombreCulto && (
          <div style={{ fontSize: 10, opacity: 0.4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {listaIdActual ? "✏️ " : ""}{nombreCulto}
          </div>
        )}
      </div>
      <button data-tour="controles-nav" className="ctrl-btn" onClick={anterior} style={{
        width: isMobile ? 40 : 56, height: isMobile ? 40 : 56, borderRadius: 10, border: "none",
        background: "rgba(255,255,255,0.08)", color: "white", fontSize: isMobile ? 18 : 22,
        cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>⬅️</button>
      <button className="ctrl-btn" onClick={siguiente} style={{
        width: isMobile ? 40 : 56, height: isMobile ? 40 : 56, borderRadius: 10, border: "none",
        background: "#2563eb", color: "white", fontSize: isMobile ? 18 : 22,
        cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>➡️</button>
      {!isMobile && (
        <button className="ctrl-btn" onClick={proyectarPantallaNegra} title="Pantalla negra" style={{
          width: 52, height: 52, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
          background: "#111", color: "white", fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>⚫</button>
      )}
    </div>

    {/* Fila 2 — solo mobile: botones secundarios compactos */}
    {isMobile && (
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
        {partes.some(p => /coro|estribillo/i.test(p?.tipo || "")) && (
          <button data-tour="btn-coro" onClick={irAlCoro} style={{
            padding: "4px 9px", borderRadius: 8, flexShrink: 0,
            border: `1px solid ${versoDespuesCoro !== null ? "rgba(251,191,36,0.4)" : "rgba(99,102,241,0.4)"}`,
            background: versoDespuesCoro !== null ? "rgba(251,191,36,0.12)" : "rgba(99,102,241,0.12)",
            color: versoDespuesCoro !== null ? "#fbbf24" : "#a5b4fc",
            fontSize: 11, fontWeight: 700, cursor: "pointer"
          }}>{versoDespuesCoro !== null ? "↩ Verso" : "🎵 Coro"}</button>
        )}
        {tiemposAprendidos.length > 0 && !autoAvanceActivo && partes.length > 0 && (
          <button data-tour="btn-auto" onClick={() => { setAutoAvanceActivo(true); iniciarAutoAvance(tiemposAprendidos, index) }} style={{
            padding: "4px 9px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)",
            background: "rgba(34,197,94,0.1)", color: "#4ade80",
            fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0
          }}>▶ Auto</button>
        )}
        {tiemposAprendidos.length > 0 && !autoAvanceActivo && activaId && (
          <button onClick={() => {
            if (!window.confirm("¿Borrar tiempos?")) return
            try { localStorage.removeItem(`selah-tiempos-${activaId}`) } catch (e) {}
            setTiemposAprendidos([]); tiemposRegistrados.current = []; iniciarAprendizaje()
          }} style={{
            padding: "4px 7px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)",
            background: "transparent", color: "rgba(239,68,68,0.5)", fontSize: 11, cursor: "pointer", flexShrink: 0
          }}>⏱×</button>
        )}
        {autoAvanceActivo && (
          <button onClick={detenerAutoAvance} style={{
            padding: "4px 9px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.1)", color: "#fca5a5",
            fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0
          }}>⏹ {contadorAuto}s</button>
        )}
        <button onClick={proyectarPantallaNegra} style={{
          marginLeft: "auto", padding: "4px 9px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)", background: "#111",
          color: "white", fontSize: 12, cursor: "pointer", flexShrink: 0
        }}>⚫ Apagar</button>

        {/* Zoom remoto */}
        {socket && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <button onClick={() => {
              const v = Math.max(50, zoomActualRef.current - 10)
              setZoomActual(v); zoomActualRef.current = v; socket?.emit("ajustar-zoom", { valor: v })
              localStorage.setItem("proyector-escala-fuente", String(v))
            }} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: zoomActual >= 190 ? "#fbbf24" : "rgba(255,255,255,0.6)", minWidth: 36, textAlign: "center" }}>{zoomActual}%</span>
            <button onClick={() => {
              const v = Math.min(200, zoomActualRef.current + 10)
              setZoomActual(v); zoomActualRef.current = v; socket?.emit("ajustar-zoom", { valor: v })
              localStorage.setItem("proyector-escala-fuente", String(v))
            }} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
        )}
      </div>
    )}

    {/* Desktop fila 2: botones secundarios */}
    {!isMobile && (
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        {partes.some(p => /coro|estribillo/i.test(p?.tipo || "")) && (
          <button data-tour="btn-coro" onClick={irAlCoro} style={{
            padding: "6px 12px", borderRadius: 8, flexShrink: 0,
            border: `1px solid ${versoDespuesCoro !== null ? "rgba(251,191,36,0.4)" : "rgba(99,102,241,0.4)"}`,
            background: versoDespuesCoro !== null ? "rgba(251,191,36,0.12)" : "rgba(99,102,241,0.12)",
            color: versoDespuesCoro !== null ? "#fbbf24" : "#a5b4fc",
            fontSize: 12, fontWeight: 700, cursor: "pointer"
          }}>{versoDespuesCoro !== null ? "↩ Verso" : "🎵 Coro"}</button>
        )}
        {tiemposAprendidos.length > 0 && !autoAvanceActivo && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
            color: "#4ade80", fontWeight: 600 }}>✓ {tiemposAprendidos.length}p</span>
        )}
        {tiemposAprendidos.length > 0 && !autoAvanceActivo && partes.length > 0 && (
          <button data-tour="btn-auto" onClick={() => { setAutoAvanceActivo(true); iniciarAutoAvance(tiemposAprendidos, index) }} style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)",
            background: "rgba(34,197,94,0.1)", color: "#4ade80",
            fontSize: 12, fontWeight: 700, cursor: "pointer"
          }}>▶ Auto</button>
        )}
        {tiemposAprendidos.length > 0 && !autoAvanceActivo && activaId && (
          <button onClick={() => {
            if (!window.confirm("¿Borrar tiempos aprendidos?")) return
            try { localStorage.removeItem(`selah-tiempos-${activaId}`) } catch (e) {}
            setTiemposAprendidos([]); tiemposRegistrados.current = []; iniciarAprendizaje()
          }} style={{
            padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)",
            background: "transparent", color: "rgba(239,68,68,0.5)", fontSize: 12, cursor: "pointer"
          }}>⏱×</button>
        )}
        {autoAvanceActivo && (
          <button onClick={detenerAutoAvance} style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.1)", color: "#fca5a5",
            fontSize: 12, fontWeight: 700, cursor: "pointer"
          }}>⏹ Stop {contadorAuto}s</button>
        )}

        {/* Zoom remoto desktop */}
        {socket && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, opacity: 0.4 }}>Zoom:</span>
            <button onClick={() => {
              const v = Math.max(50, zoomActualRef.current - 10)
              setZoomActual(v); zoomActualRef.current = v; socket?.emit("ajustar-zoom", { valor: v })
              localStorage.setItem("proyector-escala-fuente", String(v))
            }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 42, textAlign: "center", color: zoomActual >= 190 ? "#fbbf24" : "white" }}>{zoomActual}%</span>
            <button onClick={() => {
              const v = Math.min(200, zoomActualRef.current + 10)
              setZoomActual(v); zoomActualRef.current = v; socket?.emit("ajustar-zoom", { valor: v })
              localStorage.setItem("proyector-escala-fuente", String(v))
            }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            {zoomActual >= 190 && <span style={{ fontSize: 10, color: "#fbbf24" }}>máx</span>}
          </div>
        )}
      </div>
    )}
  </div>

  {/* ── INDICADOR PARTE ACTUAL ──────────────────────────────────────────── */}
  <div style={{
    flexShrink: 0,
    background: "rgba(15,23,42,0.97)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: isMobile ? "6px 14px" : "8px 20px",
    fontSize: isMobile ? 12 : 13,
    fontWeight: 700, opacity: 0.85,
    textAlign: "center",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8
  }}>
    {etiquetaParteControl}
    {aprendiendo && !autoAvanceActivo && tiemposAprendidos.length === 0 && (
      <span style={{
        fontSize: 9, padding: "1px 5px", borderRadius: 4,
        background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)",
        color: "rgba(251,191,36,0.5)", fontWeight: 600
      }}>⏱</span>
    )}
    {tiemposAprendidos.length > 0 && !autoAvanceActivo && (
      <span style={{
        fontSize: 9, padding: "1px 5px", borderRadius: 4,
        background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
        color: "#4ade80", fontWeight: 600
      }}>✓ {tiemposAprendidos.length}p</span>
    )}
    {autoAvanceActivo && (
      <span style={{
        fontSize: 10, padding: "2px 6px", borderRadius: 5,
        background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)",
        color: "#fca5a5", fontWeight: 700
      }}>⏹ {contadorAuto}s</span>
    )}
  </div>

  {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── */}
<div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
<div style={{
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr",
  alignItems: "start",
  padding: isMobile ? "4px 0px" : "20px",
  gap: isMobile ? 10 : 20,
  boxSizing: "border-box",
  width: "100%"
}}>

    {/* ══ COLUMNA IZQUIERDA: Canciones + Herramientas ═══════════════════ */}
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 16 }}>

      {/* ── Canciones ─────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        {/* Header canciones */}
        <div
          onClick={() => setMostrarCanciones(v => !v)}
          style={{
            padding: isMobile ? "10px 10px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarCanciones ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>
            🎵 Canciones
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600,
              background: "rgba(59,130,246,0.15)", color: "#93c5fd",
              borderRadius: 6, padding: "2px 7px"
            }}>
              {cancionesFiltradas.length}
            </span>
          </div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarCanciones ? "▾" : "▸"}</span>
        </div>

        {mostrarCanciones && (
          <div style={{ padding: isMobile ? "8px 10px" : "14px 18px" }}>
            {/* Toggle preview — solo mobile */}
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <button
                  onClick={() => setPreviewHabilitado(v => !v)}
                  style={{
                    padding: "4px 10px", borderRadius: 8,
                    border: `1px solid ${previewHabilitado ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.1)"}`,
                    background: previewHabilitado ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
                    color: previewHabilitado ? "#93c5fd" : "rgba(255,255,255,0.35)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer"
                  }}
                >{previewHabilitado ? "👁 Vista previa ON" : "👁 Vista previa OFF"}</button>
              </div>
            )}

            {/* Búsqueda */}
            <input
              data-tour="lista-canciones"
              placeholder="🔍 Buscar por número, título o letra..."
              value={busqueda}
              onChange={e => handleBusqueda(e.target.value)}
              onFocus={e => {
                if (isMobile) setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
              }}
              style={{
                width: "100%", padding: "11px 13px",
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                background: "#0a1525", color: "white",
                fontSize: 16, outline: "none",
                boxSizing: "border-box", marginBottom: 8
              }}
            />

            {/* Filtros en fila */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <select
                value={filtroTono}
                onChange={e => setFiltroTono(e.target.value)}
                style={{
                  padding: "9px 10px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a1525", color: "white",
                  fontSize: 13, outline: "none"
                }}
              >
                <option value="">Todos los tonos</option>
                {["Do","Dom","Do#","Re","Rem","Re#","Mi","Mim","Fa","Fam","Fa#","Sol","Solm","Sol#","La","Lam","La#","Si","Sim"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
                style={{
                  padding: "9px 10px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a1525", color: "white",
                  fontSize: 13, outline: "none"
                }}
              >
                <option value="">Todas las categorías</option>
                {categoriasDisponibles.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Ordenar */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
              {([
                { v: "numero",   l: "# Nº" },
                { v: "az",       l: "A → Z" },
                { v: "za",       l: "Z → A" },
                { v: "reciente", l: "Reciente" },
                { v: "antigua",  l: "Antigua" },
              ] as const).map(({ v, l }) => (
                <button key={v} onClick={() => cambiarOrden(v)} style={{
                  padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: `1px solid ${ordenar === v ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`,
                  background: ordenar === v ? "rgba(99,102,241,0.15)" : "transparent",
                  color: ordenar === v ? "#a5b4fc" : "rgba(255,255,255,0.35)"
                }}>{l}</button>
              ))}
            </div>

            {/* Lista virtualizada */}
            <div
              id="scroll-canciones"
              ref={scrollCancionesRef}
              onScroll={handleScrollCanciones}
              style={{
                height: isMobile ? "calc(100dvh - 390px)" : "min(560px, calc(100vh - 340px))",
                maxHeight: isMobile ? "calc(100dvh - 390px)" : "min(560px, calc(100vh - 340px))",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              <div style={{ height: cancionesFiltradas.length * ALTURA_ITEM_CANCION, position: "relative" }}>
                <div style={{ transform: `translateY(${inicioVirtualCanciones * ALTURA_ITEM_CANCION}px)` }}>
                  {cancionesVirtuales.map(c => {
                    const activa = c.id === activaId
                    const fragmento = obtenerFragmentoBusqueda(c.texto_busqueda || "", busqueda)
                    return (
                      <div
                        key={c.id}
                        ref={el => { cancionRefs.current[c.id] = el }}
                        style={{
                          height: ALTURA_ITEM_CANCION,
                          overflow: "hidden",
                          boxSizing: "border-box"
                        }}
                      >
                        <div
                          onClick={() => cargarPreview(c)}
                          style={{
                          height: "100%",
                          background: previewCancion?.id === c.id && !activa ? "rgba(59,130,246,0.12)" : activa ? "rgba(22,163,74,0.85)" : colorCategoria(c.categoria).bg,
                          border: `1px solid ${previewCancion?.id === c.id && !activa ? "rgba(59,130,246,0.35)" : activa ? "rgba(34,197,94,0.5)" : colorCategoria(c.categoria).border}`,
                          borderLeft: activa ? "3px solid #22c55e" : previewCancion?.id === c.id ? "3px solid #3b82f6" : `3px solid ${colorCategoria(c.categoria).border}`,
                          borderRadius: 9,
                          display: "flex", alignItems: "center",
                          gap: 8, padding: "0 10px",
                          transition: "background 0.15s",
                          overflow: "hidden",
                          boxSizing: "border-box",
                          cursor: "pointer"
                        }}>
                          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", width: 0 }}>
                            <div style={{
                              fontWeight: 700, fontSize: 13, lineHeight: 1.2,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              color: activa ? "white" : "rgba(255,255,255,0.92)"
                            }}>
                              {busqueda.trim() ? (() => {
                                const titulo = tituloCancionVisible(c)
                                const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                const q = norm(busqueda.trim())
                                const idx = norm(titulo).indexOf(q)
                                if (idx === -1) return titulo
                                return <>
                                  {titulo.slice(0, idx)}
                                  <mark style={{ background: "rgba(251,191,36,0.35)", color: "#fbbf24", borderRadius: 2, padding: "0 1px" }}>
                                    {titulo.slice(idx, idx + q.length)}
                                  </mark>
                                  {titulo.slice(idx + q.length)}
                                </>
                              })() : tituloCancionVisible(c)}
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 1, flexWrap: "nowrap", overflow: "hidden", maxWidth: "100%" }}>
                              {c.categoria && !activa && (() => { const col = colorCategoria(c.categoria); return (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>{c.categoria}</span>
                              )})()}
                              {c.tono && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(167,139,250,0.12)", color: activa ? "white" : "#c4b5fd", border: "1px solid rgba(167,139,250,0.3)" }}>{nombreTono(c.tono)}</span>
                              )}
                              {idsCancionesConAcordes.includes(c?.id) && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(251,191,36,0.1)", color: activa ? "white" : "#fcd34d", border: "1px solid rgba(251,191,36,0.25)" }}>🎸 Acordes</span>
                              )}
                            </div>
                            {fragmento && busqueda && (
                              <div style={{
                                fontSize: 9, opacity: 0.45, marginTop: 1,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                              }}>
                                {fragmento}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                            <button
                              className="ctrl-btn"
                              onClick={e => { e.stopPropagation(); abrirVisor(c) }}
                              style={{
                                padding: "4px 6px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(255,255,255,0.06)", color: "white",
                                fontWeight: 700, fontSize: 12, cursor: "pointer"
                              }}
                            >📱</button>
                            <button
                              className="ctrl-btn"
                              onClick={e => { e.stopPropagation(); proyectar(c.id) }}
                              style={{
                                padding: "5px 9px",
                                borderRadius: 8, border: "none",
                                background: "#2563eb", color: "white",
                                fontWeight: 700, fontSize: 12, cursor: "pointer"
                              }}
                            >▶</button>
                            <button
                              className="ctrl-btn"
                              onClick={e => { e.stopPropagation(); agregarALista(c) }}
                              style={{
                                padding: "5px 9px",
                                borderRadius: 8, border: "none",
                                background: "rgba(255,255,255,0.08)", color: "white",
                                fontWeight: 700, fontSize: 12, cursor: "pointer"
                              }}
                            >+</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            
          </div>
          )}
      </div>
      
      {/* ── Acciones rápidas ──────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        <div
          data-tour="btn-herramientas"
          onClick={() => setMostrarAcciones(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarAcciones ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>🛠️ Herramientas</div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarAcciones ? "▾" : "▸"}</span>
        </div>

        <div style={{
          // ✅ Límite en px para animar el acordeón con max-height (CSS no anima
          // "auto"). Se dejó margen amplio sobre el contenido real para que
          // agregar secciones nuevas (como el banner de urgencia) no lo corte.
          maxHeight: mostrarAcciones ? 2000 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s ease"
        }}>
          <div style={{ padding: isMobile ? "12px 14px" : "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Pantallas rápidas — ▶ proyecta directo, + agrega a lista */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Pantallas rápidas
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { titulo: "⚫ Pantalla negra",   onPlay: proyectarPantallaNegra,  onAdd: agregarNegroALista },
                  { titulo: "⏳ Pantalla espera",  onPlay: proyectarPantallaEspera, onAdd: agregarEsperaALista },
                  { titulo: `✍️ ${mensajeRapido || "Mensaje rápido"}`, onPlay: proyectarMensajeRapido, onAdd: agregarMensajeALista },
                  { titulo: logoEsperaNombre ? `🖼️ ${logoEsperaNombre}` : "🖼️ Logo de espera", onPlay: proyectarPantallaLogo, onAdd: agregarLogoALista, disabled: !logoEsperaUrl },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "9px 12px" }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.titulo}</span>
                    <button className="ctrl-btn" disabled={!socket || item.disabled} onClick={item.onPlay}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>▶</button>
                    <button className="ctrl-btn" disabled={item.disabled} onClick={item.onAdd}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mensaje rápido */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                Texto del mensaje
              </div>
              <input
                value={mensajeRapido}
                onChange={e => setMensajeRapido(e.target.value)}
                placeholder="Ej: Oremos, Bienvenidos..."
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a1525", color: "white",
                  fontSize: 14, outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            {/* 🚨 Banner de urgencia — se superpone sin interrumpir lo que se está proyectando */}
            <div style={{ border: "1px solid rgba(239,68,68,0.35)", borderRadius: 12, padding: 12, background: "rgba(239,68,68,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fca5a5", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                🚨 Banner de urgencia
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
                Se muestra encima de la canción o el mensaje sin taparlos. Para avisos que no pueden esperar (ej. mover un auto).
              </div>
              <input
                value={bannerUrgente}
                onChange={e => setBannerUrgente(e.target.value)}
                placeholder="Ej: Favor mover auto patente AB-1234"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "#0a1525", color: "white",
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                  marginBottom: 8
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ctrl-btn" disabled={!socket || !bannerUrgente.trim()} onClick={mostrarBannerUrgente}
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", background: "#dc2626", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  🚨 Mostrar banner
                </button>
                {bannerUrgenteActivo && (
                  <button className="ctrl-btn" onClick={ocultarBannerUrgente}
                    style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Ocultar
                  </button>
                )}
              </div>
            </div>

            {/* Subir imagen para lista */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Imagen para el culto
              </div>
              {/* ── Panel de imágenes con galería modal ── */}
              <div style={{ position: "relative" }}>
                {/* Toggle local/nube (solo en Electron) */}
                {isElectronCtx && (
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    {(["local","nube"] as const).map(m => (
                      <button key={m} onClick={() => { setModoGuardado(m); localStorage.setItem("selah-img-modo", m) }} style={{
                        flex:1, padding:"5px 8px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer",
                        border:`1px solid ${modoGuardado===m ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
                        background: modoGuardado===m ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                        color: modoGuardado===m ? "#a5b4fc" : "rgba(255,255,255,0.4)"
                      }}>
                        {m === "local" ? "💾 Disco" : "☁️ Nube"}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                  <label style={{
                    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    padding:"10px 14px", borderRadius:10,
                    border:"1px dashed rgba(255,255,255,0.15)",
                    background:"rgba(255,255,255,0.03)",
                    cursor:"pointer", fontSize:13, fontWeight:600
                  }}>
                    🖼️ Subir imagen
                    <input type="file" accept="image/*" style={{ display:"none" }}
                      onChange={async e => {
                        const inputFile = e.target as HTMLInputElement
                        const file = inputFile.files?.[0]
                        if (!file) return
                        const resultado = await subirImagen(file)
                        if (resultado?.url) {
                          agregarItemAListaConFeedback(
                            { tipo:"imagen", url:resultado.url, titulo:resultado.nombre },
                            `✅ Imagen agregada${resultado.local ? " (local)" : " (nube)"}: ${resultado.nombre}`
                          )
                          const imgs = await cargarGaleriaImagenes()
                          setGaleriaImagenes(imgs)
                        }
                        inputFile.value = ""
                      }}
                    />
                  </label>
                  <button onClick={async () => {
                    if (!galeriaAbierta) {
                      setCargandoGaleria(true)
                      const imgs = await cargarGaleriaImagenes()
                      setGaleriaImagenes(imgs); setCargandoGaleria(false)
                    }
                    setGaleriaAbierta(v => !v)
                  }} style={{
                    padding:"10px 14px", borderRadius:10,
                    border:`1px solid ${galeriaAbierta ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)"}`,
                    background: galeriaAbierta ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
                    color:"white", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap"
                  }}>
                    {cargandoGaleria ? "⏳" : "🗂️"} Galería
                  </button>
                </div>

                {/* ✅ Modal flotante de galería — no empuja el contenido */}
                {galeriaAbierta && (
                  <div style={{
                    position:"fixed", inset:0, zIndex:200,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)"
                  }} onClick={() => setGaleriaAbierta(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                      width:"min(92vw, 480px)", maxHeight:"80vh",
                      background:"#111827", borderRadius:16,
                      border:"1px solid rgba(255,255,255,0.1)",
                      display:"flex", flexDirection:"column", overflow:"hidden"
                    }}>
                      {/* Header */}
                      <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontWeight:800, fontSize:15 }}>🗂️ Galería de imágenes</div>
                        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                          <span style={{ fontSize:11, opacity:0.4 }}>☁️ {galeriaImagenes.filter(i=>!i.local).length}/20 · 💾 {galeriaImagenes.filter(i=>i.local).length}</span>
                          <button onClick={() => setGaleriaAbierta(false)} style={{ background:"none", border:"none", color:"white", fontSize:18, cursor:"pointer", opacity:0.5 }}>✕</button>
                        </div>
                      </div>
                      {/* Grid */}
                      <div style={{ overflowY:"auto", flex:1, padding:12 }}>
                        {galeriaImagenes.length === 0 ? (
                          <div style={{ textAlign:"center", padding:32, opacity:0.3, fontSize:13 }}>Sin imágenes guardadas</div>
                        ) : (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                            {galeriaImagenes.map((img, i) => (
                              <div key={i} style={{ position:"relative", aspectRatio:"16/9", borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.08)" }}>
                                <img src={img.url} alt={img.nombre}
                                  onClick={() => { agregarItemAListaConFeedback({ tipo:"imagen", url:img.url, titulo:img.nombre }, `✅ ${img.nombre}`); setGaleriaAbierta(false) }}
                                  style={{ width:"100%", height:"100%", objectFit:"cover", cursor:"pointer" }} />
                                {img.local && <span style={{ position:"absolute", top:3, left:3, fontSize:9, background:"rgba(0,0,0,0.7)", borderRadius:3, padding:"1px 4px" }}>💾</span>}
                                <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"4px 6px", background:"linear-gradient(transparent,rgba(0,0,0,0.7))", fontSize:10, opacity:0.8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{img.nombre}</div>
                                {/* ✅ Botón eliminar */}
                                <button onClick={async e => {
                                  e.stopPropagation()
                                  if (!confirm(`¿Eliminar "${img.nombre}"?`)) return
                                  try {
                                    if (img.local) {
                                      const nombre = img.url.split("/imagenes/").pop()
                                      await fetch("http://localhost:4000/api/imagenes/eliminar", {
                                        method:"DELETE", headers:{"Content-Type":"application/json"},
                                        body: JSON.stringify({ nombre })
                                      })
                                    } else {
                                      const igId = await getIglesiaIdCached()
                                      const path = img.url.split("/imagenes-culto/")[1]?.split("?")[0]
                                      if (path) await supabase.storage.from("imagenes-culto").remove([decodeURIComponent(path)])
                                    }
                                    const actualizadas = await cargarGaleriaImagenes()
                                    setGaleriaImagenes(actualizadas)
                                  } catch(e) { alert("No se pudo eliminar") }
                                }} style={{
                                  position:"absolute", top:3, right:3,
                                  width:20, height:20, borderRadius:4,
                                  background:"rgba(239,68,68,0.85)", border:"none",
                                  color:"white", fontSize:11, cursor:"pointer", lineHeight:"1"
                                }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── MODO LIMPIO + FUENTES ─────────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Apariencia del proyector
              </div>

              {/* Modo limpio toggle */}
              <div
                onClick={() => {
                  const nuevo = !modoLimpio
                  setModoLimpio(nuevo)
                  localStorage.setItem("proyector-modo-limpio", nuevo ? "1" : "0")
                  window.dispatchEvent(new Event("storage"))
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 8,
                  border: `1px solid ${modoLimpio ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: modoLimpio ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)"
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>✨ Modo limpio</div>
                  <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>Solo letra · Sin título, tono, logo ni verso</div>
                </div>
                <div style={{
                  width: 38, height: 22, borderRadius: 999,
                  background: modoLimpio ? "#6366f1" : "rgba(255,255,255,0.12)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0
                }}>
                  <div style={{
                    position: "absolute", top: 3, left: modoLimpio ? 19 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "white",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                  }} />
                </div>
              </div>

              {/* Selector de fuente */}
              <div>
                <div style={{ fontSize: 11, opacity: 0.35, marginBottom: 6 }}>Fuente de letra</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { id: "system",   label: "Sistema",    ejemplo: "Aa" },
                    { id: "arial",    label: "Arial",      ejemplo: "Aa" },
                    { id: "serif",    label: "Georgia",    ejemplo: "Aa" },
                    { id: "cinzel",   label: "Cinzel",     ejemplo: "Aa" },
                    { id: "playfair", label: "Playfair",   ejemplo: "Aa" },
                    { id: "raleway",  label: "Raleway",    ejemplo: "Aa" },
                    { id: "lato",     label: "Lato",       ejemplo: "Aa" },
                    { id: "oswald",   label: "Oswald",     ejemplo: "Aa" },
                    { id: "merriw",   label: "Merriweather", ejemplo: "Aa" },
                    { id: "ptserif",  label: "PT Serif",   ejemplo: "Aa" },
                    { id: "ubuntu",   label: "Ubuntu",     ejemplo: "Aa" },
                    { id: "mono",     label: "Mono",       ejemplo: "Aa" },
                  ].map(f => {
                    const FUENTES_MAP: Record<string,string> = {
                      system:"system-ui,sans-serif", arial:"Arial,sans-serif",
                      serif:"Georgia,serif", cinzel:"'Cinzel',serif",
                      playfair:"'Playfair Display',serif", raleway:"'Raleway',sans-serif",
                      lato:"'Lato',sans-serif", oswald:"'Oswald',sans-serif",
                      merriw:"'Merriweather',serif", ptserif:"'PT Serif',serif",
                      ubuntu:"'Ubuntu',sans-serif", mono:"'Courier New',monospace"
                    }
                    const activa = familiaFuenteCtrl === f.id
                    return (
                      <button key={f.id} onClick={() => {
                        setFamiliaFuenteCtrl(f.id)
                        localStorage.setItem("proyector-font-family", f.id)
                        window.dispatchEvent(new Event("storage"))
                      }} style={{
                        padding: "8px 10px", borderRadius: 9, cursor: "pointer", textAlign: "left",
                        border: `1px solid ${activa ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`,
                        background: activa ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
                        color: "white", display: "flex", alignItems: "center", gap: 8
                      }}>
                        <span style={{ fontSize: 16, fontFamily: FUENTES_MAP[f.id], fontWeight: 700, flexShrink: 0 }}>Aa</span>
                        <span style={{ fontSize: 11, opacity: activa ? 1 : 0.6, fontWeight: activa ? 700 : 400 }}>{f.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Fondo para canciones */}
            <div data-tour="panel-fondo">
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Fondo para canciones
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <select
                  value={fondoCancionModo}
                  onChange={e => setFondoCancionModo(e.target.value as any)}
                  style={{
                    padding: "9px 10px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#0a1525", color: "white", fontSize: 13, outline: "none"
                  }}
                >
                  <option value="preset">Fondo predeterminado</option>
                  <option value="ninguno">Sin fondo</option>
                  <option value="estatico">Imagen estática</option>
                  <option value="movimiento">Imagen con movimiento</option>
                  <option value="video">🎬 Video de fondo</option>
                </select>

                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "9px 12px", borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>
                  {fondoCancionModo === "video" ? "🎬 Subir video" : "🖼️ Subir fondo"}
                  <input type="file" accept={fondoCancionModo === "video" ? "video/*" : "image/*"} style={{ display: "none" }}
                    onChange={async e => {
                      const inputFile = e.target as HTMLInputElement
                      const file = inputFile.files?.[0]
                      if (!file) return
                      if (fondoCancionModo === "video") {
                        // Video: guardar local en Electron o subir a Supabase Storage
                        const isElectron = navigator.userAgent.includes("Electron")
                        if (isElectron) {
                          const fd = new FormData(); fd.append("imagen", file, file.name)
                          const r = await fetch("http://localhost:4000/api/imagenes/guardar", { method:"POST", body:fd })
                          if (r.ok) { const { url } = await r.json(); setFondoCancionUrl(url); setFondoCancionNombre(file.name) }
                        } else {
                          const iglesiaId = await getIglesiaIdCached()
                          const nombre = `${Date.now()}-${file.name}`
                          const ruta = iglesiaId ? `${iglesiaId}/videos/${nombre}` : `videos/${nombre}`
                          await supabase.storage.from("imagenes-culto").upload(ruta, file, { upsert: false })
                          const { data } = supabase.storage.from("imagenes-culto").getPublicUrl(ruta)
                          setFondoCancionUrl(data.publicUrl); setFondoCancionNombre(file.name)
                        }
                      } else {
                        const resultado = await subirImagen(file)
                        if (resultado?.url) {
                          setFondoCancionUrl(resultado.url)
                          setFondoCancionNombre(resultado.nombre || "Fondo")
                          setFondoCancionModo("estatico")
                        }
                      }
                      inputFile.value = ""
                    }}
                  />
                </label>
              </div>

              {/* Presets de fondo */}
              {fondoCancionModo === "preset" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                  {fondosCancionPreset.map(fondo => (
                    <button
                      key={fondo.id}
                      onClick={() => { setFondoCancionPreset(fondo.id); setFondoCancionModo("preset") }}
                      style={{
                        minHeight: 56, borderRadius: 10,
                        border: fondoCancionPreset === fondo.id
                          ? "2px solid rgba(255,255,255,0.85)"
                          : "1px solid rgba(255,255,255,0.12)",
                        background: fondo.fondo, color: "white",
                        cursor: "pointer", fontWeight: 800, fontSize: 11,
                        textShadow: "0 2px 8px rgba(0,0,0,0.75)",
                        boxShadow: fondoCancionPreset === fondo.id ? "0 0 0 2px rgba(37,99,235,0.6)" : "none"
                      }}
                    >{fondo.nombre}</button>
                  ))}
                </div>
              )}

              {/* Ajuste imagen + oscuridad */}
              {fondoCancionModo !== "preset" && (
                <select
                  value={fondoCancionAjuste}
                  onChange={e => setFondoCancionAjuste(e.target.value as "cover" | "contain")}
                  style={{
                    width: "100%", padding: "9px 10px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#0a1525", color: "white", fontSize: 13,
                    outline: "none", marginBottom: 8
                  }}
                >
                  <option value="cover">Cubrir pantalla</option>
                  <option value="contain">Mostrar imagen completa</option>
                </select>
              )}

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
                  Oscuridad del fondo: {fondoCancionOscuridad}%
                </div>
                <input
                  type="range" min="20" max="80"
                  value={fondoCancionOscuridad}
                  onChange={e => setFondoCancionOscuridad(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Preview fondo actual */}
              {fondoCancionModo !== "preset" && fondoCancionUrl && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)"
                }}>
                  <img src={fondoCancionUrl} alt="Fondo"
                    style={{ width: 72, height: 46, objectFit: "cover", borderRadius: 7, background: "#000", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fondoCancionNombre || "Fondo cargado"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>Se aplica a las canciones proyectadas</div>
                  </div>
                  <button className="ctrl-btn"
                    onClick={() => { setFondoCancionUrl(""); setFondoCancionNombre(""); setFondoCancionModo("preset") }}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
            {/* Links abrir proyector / músicos */}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ctrl-btn"
                data-tour="btn-proyectar"
                onClick={() => { window.open(`${window.location.origin}/proyectar`, "_blank", "noopener,noreferrer"); setProyectorConectado(false) }}
                style={{ flex: 1, padding: "10px", borderRadius: 10,
                  border: `1px solid ${proyectorConectado ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  background: proyectorConectado ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                  color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {proyectorConectado ? "🟢 Proyector activo" : "🖥️ Abrir Proyector"}
              </button>
              <button className="ctrl-btn"
                onClick={() => window.open(`${window.location.origin}/musicos`, "_blank", "noopener,noreferrer")}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                🎹 Abrir Músicos
              </button>
            </div>

            {/* Gestión culto */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Lista de culto
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="ctrl-btn"
                  onClick={() => {
                    setNombreModal(nombreCulto || "")
                    setModalGuardar(true)
                  }}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10, border: "none",
                    background: "#2563eb", color: "white", fontWeight: 700,
                    fontSize: 13, cursor: "pointer"
                  }}
                >💾 Guardar lista</button>

                <button
                  className="ctrl-btn"
                  onClick={() => {
                    const hayAlgo = lista.length > 0 || partes.length > 0 || !!nombreCulto
                    if (hayAlgo) {
                      if (!window.confirm("¿Limpiar el control y crear nueva lista?")) return
                    }
                    limpiarCultoActual()
                  }}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.06)", color: "white",
                    fontWeight: 700, fontSize: 13, cursor: "pointer"
                  }}
                >🆕 Nueva lista</button>
              </div>
            </div>

            {/* Logo */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Logo de iglesia
              </div>
              {logoEsperaUrl ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)"
                }}>
                  <img src={logoEsperaUrl} alt="Logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, background: "#000", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {logoEsperaNombre || "Logo cargado"}
                  </div>
                  <button
                    className="ctrl-btn"
                    onClick={async () => {
                      const igId = await getIglesiaIdCached()
                      if (!igId) return
                      await supabase.from("iglesias").update({ logo_url: null, logo_nombre: null }).eq("id", igId)
                      setLogoEsperaUrl("")
                      setLogoEsperaNombre("")
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 8, border: "none",
                      background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                      fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0
                    }}
                  >✕</button>
                </div>
              ) : (
                <label style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: 0.7
                }}>
                  📁 Subir logo de iglesia
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async e => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (!file) return
                      await subirLogoEspera(file)
                      ;(e.target as HTMLInputElement).value = ""
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Palabra / Biblia ──────────────────────────────────────────── */}
      <div data-tour="input-biblia" style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        <div
          onClick={() => setMostrarPalabra(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarPalabra ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>📖 Palabra</div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarPalabra ? "▾" : "▸"}</span>
        </div>

        {mostrarPalabra && (
          <div data-tour="input-biblia" style={{ padding: isMobile ? "12px 14px" : "16px 18px" }}>
            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>
              Ejemplos: Juan 3:16 • Salmos 23 • 1 Corintios 13:4-7
            </div>
            <BibleAutocomplete
              value={inputBiblia}
              onChange={setInputBiblia}
              onSubmit={async () => {
                if (!inputBiblia.trim()) return
                await proyectarBiblia(inputBiblia)
                setInputBiblia("")
              }}
              placeholder="Escribe una cita bíblica..."
              style={{ marginBottom: 10 }}
              inputStyle={{ background: "#0a1525", fontSize: 16 }}
            />
            <datalist id="libros-biblia">
              {sugerenciasBiblia.map(s => <option key={s} value={s} />)}
            </datalist>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                className="ctrl-btn"
                onClick={async () => {
                  if (!inputBiblia.trim()) return
                  await proyectarBiblia(inputBiblia)
                  setInputBiblia("")
                }}
                style={{
                  padding: "11px", borderRadius: 10, border: "none",
                  background: "#2563eb", color: "white", fontWeight: 700,
                  fontSize: 14, cursor: "pointer"
                }}
              >📖 Proyectar</button>
              <button
                className="ctrl-btn"
                onClick={async () => {
                  if (!inputBiblia.trim()) return
                  await agregarBibliaALista(inputBiblia)
                  setInputBiblia("")
                }}
                style={{
                  padding: "11px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.06)", color: "white",
                  fontWeight: 700, fontSize: 14, cursor: "pointer"
                }}
              >+ Lista</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cultos guardados ──────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        <div
          onClick={() => setMostrarCultos(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarCultos ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>
            💾 Cultos guardados
            {cultos.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 600,
                background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
                borderRadius: 6, padding: "2px 7px"
              }}>{cultos.length}</span>
            )}
          </div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarCultos ? "▾" : "▸"}</span>
        </div>

        {mostrarCultos && (
          <div style={{ padding: isMobile ? "10px 14px" : "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {cultos.length === 0 && (
              <div style={{ opacity: 0.45, fontSize: 13, padding: "8px 0" }}>
                No hay cultos guardados aún.
              </div>
            )}
            {cultos.map(c => (
              <div key={c.id} style={{
                background: c.id === listaIdActual ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${c.id === listaIdActual ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 11, padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {c.nombre || "Sin nombre"}
                  </div>
                  {c.fecha && (
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
                      {new Date(c.fecha).toLocaleDateString("es-CL")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    className="ctrl-btn"
                    onClick={() => { setMenuCultoAbierto(null); cargarListaDesdeBD(c.id) }}
                    style={{
                      padding: "7px 10px", borderRadius: 9, border: "none",
                      background: "#2563eb", color: "white", fontWeight: 700,
                      fontSize: 13, cursor: "pointer"
                    }}
                  >📂</button>
                  <button
                    className="ctrl-btn"
                    onClick={() => setMenuCultoAbierto(prev => prev === c.id ? null : c.id)}
                    style={{
                      padding: "7px 10px", borderRadius: 9,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.06)", color: "white",
                      fontWeight: 700, fontSize: 13, cursor: "pointer"
                    }}
                  >⋮</button>
                </div>
                {menuCultoAbierto === c.id && (
                  <div style={{ width: "100%", display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="ctrl-btn" onClick={() => { setMenuCultoAbierto(null); renombrarCulto(c) }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      ✏️ Renombrar
                    </button>
                    <button className="ctrl-btn" onClick={() => { setMenuCultoAbierto(null); duplicarCulto(c) }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      📄 Duplicar
                    </button>
                    <button className="ctrl-btn"
                      onClick={async () => {
                        if (!window.confirm("¿Eliminar este culto completo?")) return
                        setMenuCultoAbierto(null)
                        await supabase.from("items_lista").delete().eq("lista_id", c.id)
                        await supabase.from("listas_culto").delete().eq("id", c.id)
                        cargarCultos()
                      }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      🗑️ Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ══ COLUMNA DERECHA ════════════════════════════════════════════════ */}
    <div style={{
      display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12,
      minWidth: 0, width: "100%"
    }}>

      {/* Tabs mobile: Preview | Lista — solo en desktop */}
      {false && isMobile && (
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 3, gap: 3 }}>
          <button onClick={() => setTabDerechaMobile("preview")} style={{
            flex: 1, padding: "8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
            background: tabDerechaMobile === "preview" ? "rgba(59,130,246,0.25)" : "transparent",
            color: tabDerechaMobile === "preview" ? "#93c5fd" : "rgba(255,255,255,0.5)"
          }}>👁 Vista Previa</button>
          <button onClick={() => setTabDerechaMobile("lista")} style={{
            flex: 1, padding: "8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
            background: tabDerechaMobile === "lista" ? "rgba(255,255,255,0.1)" : "transparent",
            color: tabDerechaMobile === "lista" ? "white" : "rgba(255,255,255,0.5)"
          }}>📋 Lista{lista.length > 0 ? ` (${lista.length})` : ""}</button>
        </div>
      )}

      {/* ── PANEL VISTA PREVIA ─────────────────────────────────────────── */}
      {(!isMobile) && (
        <div style={{
          background: "rgba(17,27,46,0.95)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, overflow: "hidden", minWidth: 0, width: "100%"
        }}>
          {/* Header preview */}
          <div style={{
            padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: previewCancion ? 1 : 0.4 }}>
                {previewCancion ? previewCancion.titulo : "Selecciona una canción"}
              </div>
              {previewCancion?.tono && (
                <div style={{ fontSize: 12, color: "#86efac", marginTop: 2, fontWeight: 600 }}>Tono {previewCancion.tono}</div>
              )}
            </div>
            {previewCancion && (
              <div style={{ display: "flex", gap: 4 }}>
                {/* Botón abrir visor */}
                <button onClick={() => abrirVisor(previewCancion)} style={{
                  padding: "3px 8px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.06)", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer"
                }}>⛶</button>
              </div>
            )}
          </div>

          {/* Navegación partes */}
          {previewPartes.length > 0 && (
            <div style={{
              display: "flex", gap: 4, padding: "8px 12px", overflowX: "auto",
              borderBottom: "1px solid rgba(255,255,255,0.04)"
            }}>
              {previewPartes.map((p, i) => (
                <button key={i} onClick={() => setPreviewIndex(i)} style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  background: previewIndex === i ? "#2563eb" : "rgba(255,255,255,0.07)",
                  color: previewIndex === i ? "white" : "rgba(255,255,255,0.5)"
                }}>{p.tipo || `Parte ${i+1}`}</button>
              ))}
            </div>
          )}

          {/* Contenido preview */}
          <div style={{ padding: "12px 14px", minHeight: isMobile ? 120 : 180, maxHeight: isMobile ? 220 : 320, overflowY: "auto" }}>
            {!previewCancion ? (
              <div style={{ opacity: 0.3, fontSize: 13, textAlign: "center", paddingTop: 32 }}>
                Haz clic en una canción para ver la letra
              </div>
            ) : previewPartes.length === 0 ? (
              <div style={{ opacity: 0.4, fontSize: 12 }}>Cargando...</div>
            ) : (() => {
              const parte = previewPartes[previewIndex]
              if (!parte) return null
              // ✅ Siempre texto limpio — sin acordes, sin toggle
              const textoBase = parte.texto || parte.texto_acordes || ""
              const limpio = textoBase.split("\n")
                .map((l: string) => l.replace(/\[[^\]]+\]/g, "").trim())
                .filter((l: string) => {
                  if (!l) return false
                  const tokens = l.split(/\s+/)
                  return !tokens.every((t: string) =>
                    t.match(/^(Do#?|Reb?|Re#?|Mib?|Mi|Fa#?|Solb?|Sol#?|Lab?|La#?|Sib?|Si|[A-G])(b|#)?(m|maj|min|sus|dim|aug|add)?\d*(\/[A-G])?$/)
                  )
                })
                .join("\n")
              return <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap", margin: 0, fontSize: 14, lineHeight: 1.75, fontWeight: 500 }}>{limpio.trim()}</pre>
            })()}
          </div>

          {/* Acciones rápidas */}
          {previewCancion && (
            <div style={{
              padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.04)",
              display: "flex", gap: 6
            }}>
              <button onClick={() => proyectar(previewCancion.id)} style={{
                flex: 1, padding: "8px", borderRadius: 9, border: "none",
                background: socket ? "#2563eb" : "rgba(255,255,255,0.07)",
                color: "white", fontWeight: 700, fontSize: 13, cursor: socket ? "pointer" : "not-allowed",
                opacity: socket ? 1 : 0.5
              }}>▶ Proyectar</button>
              <button onClick={() => agregarALista(previewCancion)} style={{
                padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer"
              }}>+</button>
            </div>
          )}
        </div>
      )}

      {/* ── LISTA DE CULTO ─────────────────────────────────────────────── */}
      {(!isMobile || tabDerechaMobile === "lista") && (
      <div
        id="scroll-lista"
        style={{
          background: "rgba(17,27,46,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, overflow: "hidden",
          overflowY: "auto",
          minWidth: 0, width: "100%"
        }}
      >
        {/* Header lista */}
        <div style={{
          padding: isMobile ? "12px 14px" : "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
        }}>
          <div data-tour="lista-culto">
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>
              📋 Lista de Culto
            </div>
            {nombreCulto && (
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                {resumirTexto(nombreCulto, 30)}
              </div>
            )}
          </div>
          {lista.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
              borderRadius: 6, padding: "3px 9px"
            }}>{lista.length} items</span>
          )}
        </div>

        {/* Banner culto guardado activo */}
        {listaIdActual && (
          <div style={{
            margin: "10px 12px 0",
            padding: "10px 12px", borderRadius: 10,
            background: "rgba(37,99,235,0.12)",
            border: "1px solid rgba(59,130,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap"
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
              ✏️ Editando culto guardado
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="ctrl-btn" onClick={guardarCulto}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                💾
              </button>
              <button className="ctrl-btn" onClick={guardarCultoComoCopia}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                📄
              </button>
              <button className="ctrl-btn"
                onClick={() => { if (window.confirm("¿Salir del modo edición?")) limpiarCultoActual() }}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Flash → toast fijo arriba */}

        {/* Items de la lista */}
        <div style={{ padding: isMobile ? "10px 12px" : "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.length === 0 && (
            <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>
              Agrega canciones, palabra o imágenes desde la izquierda
            </div>
          )}

          {lista.map((c, i) => {
            const esActivo = i === indiceActivoLista
            const esAgregado = i === indiceItemAgregado
            return (
              <div
                key={i}
                ref={el => { itemListaRefs.current[i] = el }}
                draggable={!isMobile}
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => { if (!isMobile) e.preventDefault() }}
                onDrop={() => { if (!isMobile && dragIndex !== null) moverItemLista(dragIndex, i); setDragIndex(null) }}
                onDragEnd={() => setDragIndex(null)}
                style={{
                  background: esActivo ? "rgba(22,163,74,0.85)" : esAgregado ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${esActivo ? "rgba(34,197,94,0.5)" : esAgregado ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 11, padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  flexWrap: "wrap",
                  opacity: dragIndex === i ? 0.5 : 1,
                  cursor: isMobile ? "default" : dragIndex === i ? "grabbing" : "grab",
                  transition: "background 0.2s, border-color 0.2s"
                }}
              >
                {/* Handle de arrastre — solo escritorio */}
                {!isMobile && (
                  <div title="Arrastra para reordenar" style={{
                    display: "grid", gridTemplateColumns: "repeat(2, 4px)", gridAutoRows: "4px",
                    gap: 3, flexShrink: 0, cursor: dragIndex === i ? "grabbing" : "grab", padding: "4px 2px"
                  }}>
                    {Array.from({ length: 6 }).map((_, dot) => (
                      <span key={dot} style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.35)" }} />
                    ))}
                  </div>
                )}

                {/* Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ opacity: 0.6, fontSize: 12, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ flexShrink: 0 }}>{iconoItemLista(c)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14, lineHeight: 1.25,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {limpiarTituloLista(c?.titulo || "Sin título")}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 1 }}>
                      {subtituloItemLista(c)}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="ctrl-btn" onClick={() => proyectarDesdeLista(i)}
                    style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ▶
                  </button>
                  <button className="ctrl-btn"
                    onClick={() => setMenuItemAbierto(prev => prev === i ? null : i)}
                    style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ⋮
                  </button>
                </div>

                {/* Menú expandido */}
                {menuItemAbierto === i && (
                  <div style={{ width: "100%", display: "flex", gap: 6 }}>
                    <button className="ctrl-btn" onClick={() => subirItemLista(i)} disabled={i === 0}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: i === 0 ? 0.4 : 1 }}>⬆️</button>
                    <button className="ctrl-btn" onClick={() => bajarItemLista(i)} disabled={i === lista.length - 1}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: i === lista.length - 1 ? 0.4 : 1 }}>⬇️</button>
                    <button className="ctrl-btn"
                      onClick={() => { if (window.confirm("¿Eliminar este elemento?")) { eliminarDeLista(i); setMenuItemAbierto(null) } }}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🗑️</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {lista.length > 0 && (
          <div style={{ padding: isMobile ? "10px 12px 14px" : "10px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button className="ctrl-btn" onClick={guardarCulto} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              background: listaIdActual ? "#2563eb" : "rgba(37,99,235,0.85)",
              color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}>
              💾 {listaIdActual ? "Actualizar culto" : "Guardar lista de culto"}
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  </div>
</div></div>
<OnboardingTour id="tour-control" pasos={TOUR_CONTROL} nombrePagina="Control de Culto" />
</>
)
}