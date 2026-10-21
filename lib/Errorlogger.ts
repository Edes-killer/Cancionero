import { supabase } from "@/lib/supabase"
import { Capacitor } from "@capacitor/core"
import { supabaseProbablementeCaido, marcarSupabaseCaido, marcarSupabaseOk } from "@/lib/cache"
import {
  crearOperacion, obtenerSesionSoporte, sanitizarParaLog, sanitizarTexto, versionActual,
  type NivelRegistro,
} from "@/lib/observabilidad"

export type TipoError = "socket"|"supabase"|"proyeccion"|"biblia"|"imagen"|"galeria"|"ppt"|"audio"|"autenticacion"|"general"

export interface OpcionesLog {
  pagina?: string
  tipo?: TipoError
  detalle?: Record<string, unknown>
  nivel?: NivelRegistro
  operacionId?: string
}

const detectarPlataforma = () => {
  if (typeof navigator === "undefined") return "servidor"
  if (navigator.userAgent.includes("Electron")) return "electron"
  if (Capacitor.isNativePlatform()) return "apk"
  return "web"
}

const getIds = async () => {
  try {
    const sesion = await supabase.auth.getSession()
    const userId = sesion.data.session?.user?.id || null
    if (!userId) return { iglesiaId:null, userId:null }
    const { getIglesiaId } = await import("@/lib/getIglesia")
    const iglesiaId = await getIglesiaId() || null
    return { iglesiaId, userId }
  } catch {}
  return { iglesiaId:null, userId:null }
}

// ── Registro LOCAL (siempre disponible) ──────────────────────────────────────
// El registro central en Supabase falla justo cuando más se necesita (sin login,
// sin internet, Supabase caído, RLS mal). Por eso guardamos SIEMPRE un búfer local
// en este dispositivo (últimas 300 entradas), que se ve en Configuración → Log.
const LOCAL_KEY = "selah-log-local"
const LOCAL_MAX = 300

export interface EntradaLog {
  id: string
  ts: number
  tipo: string
  nivel: NivelRegistro
  pagina: string
  mensaje: string
  plataforma: string
  version: string
  sesionId: string
  operacionId?: string
  repeticiones?: number
  detalle?: unknown
}

export const getLocalLog = (): EntradaLog[] => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") } catch { return [] }
}
export const clearLocalLog = (): void => { try { localStorage.removeItem(LOCAL_KEY) } catch {} }

const appendLocal = (e: EntradaLog): void => {
  try {
    const arr = getLocalLog()
    const anterior = arr[0]
    if (anterior && anterior.tipo === e.tipo && anterior.mensaje === e.mensaje && anterior.pagina === e.pagina && e.ts - anterior.ts < 5_000) {
      anterior.ts = e.ts
      anterior.repeticiones = (anterior.repeticiones || 1) + 1
      localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, LOCAL_MAX)))
      return
    }
    arr.unshift(e)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, LOCAL_MAX)))
  } catch {
    // Si el almacenamiento está lleno, conservar al menos las últimas 50.
    try {
      const arr = getLocalLog().slice(0, 49)
      localStorage.setItem(LOCAL_KEY, JSON.stringify([e, ...arr]))
    } catch {}
  }
}

export const logError = async (mensaje: string, opciones: OpcionesLog = {}): Promise<void> => {
  const entrada: EntradaLog = {
    id: crearOperacion("log"),
    ts: Date.now(),
    tipo: opciones.tipo || "general",
    nivel: opciones.nivel || "error",
    pagina: opciones.pagina || (typeof window !== "undefined" ? window.location.pathname : ""),
    mensaje: sanitizarTexto(mensaje || "").slice(0, 500),
    plataforma: detectarPlataforma(),
    version: versionActual(),
    sesionId: obtenerSesionSoporte(),
    operacionId: opciones.operacionId,
    detalle: sanitizarParaLog(opciones.detalle),
  }
  // 1) SIEMPRE al búfer local (aunque sea dev, sin login o sin red).
  appendLocal(entrada)
  if (typeof console !== "undefined") console.warn(`[ErrorLog] ${entrada.tipo}: ${entrada.mensaje}`)

  // 2) Central (Supabase): mejor esfuerzo. En dev no lo intentamos.
  if (process.env.NODE_ENV === "development") return
  if (supabaseProbablementeCaido()) return
  try {
    const { iglesiaId, userId } = await getIds()
    if (!userId) return
    const { error } = await supabase.from("errores_log").insert({
      iglesia_id: iglesiaId, user_id: userId,
      pagina: entrada.pagina, tipo: entrada.tipo,
      mensaje: entrada.mensaje,
      detalle: {
        datos: entrada.detalle || null,
        meta: {
          sesion_id: entrada.sesionId,
          operacion_id: entrada.operacionId || null,
          nivel: entrada.nivel,
        },
      },
      plataforma: entrada.plataforma, version: entrada.version,
    })
    if (error) marcarSupabaseCaido(); else marcarSupabaseOk()
  } catch { marcarSupabaseCaido() }
}

export const logCatch = (e: unknown, contexto: string, opciones: OpcionesLog = {}): void => {
  const msg = e instanceof Error ? e.message : String(e)
  logError(`${contexto}: ${msg}`, { ...opciones })
}

export { crearOperacion, obtenerSesionSoporte }
