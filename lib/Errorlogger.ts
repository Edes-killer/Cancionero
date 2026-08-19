import { supabase } from "@/lib/supabase"
import { supabaseProbablementeCaido, marcarSupabaseCaido, marcarSupabaseOk } from "@/lib/cache"

export type TipoError = "socket"|"supabase"|"proyeccion"|"biblia"|"imagen"|"ppt"|"audio"|"autenticacion"|"general"

interface OpcionesLog { pagina?: string; tipo?: TipoError; detalle?: Record<string, any> }

const detectarPlataforma = () => {
  if (typeof navigator === "undefined") return "servidor"
  if (navigator.userAgent.includes("Electron")) return "electron"
  if ((window as any).Capacitor) return "apk"
  return "web"
}

let _iglesiaId: string | null = null
let _userId: string | null = null

const getIds = async () => {
  if (_iglesiaId && _userId) return { iglesiaId: _iglesiaId, userId: _userId }
  try {
    const sesion = await supabase.auth.getSession()
    _userId = sesion.data.session?.user?.id || null
    const { getIglesiaId } = await import("@/lib/getIglesia")
    _iglesiaId = await getIglesiaId() || null
  } catch {}
  return { iglesiaId: _iglesiaId, userId: _userId }
}

// ── Registro LOCAL (siempre disponible) ──────────────────────────────────────
// El registro central en Supabase falla justo cuando más se necesita (sin login,
// sin internet, Supabase caído, RLS mal). Por eso guardamos SIEMPRE un búfer local
// en este dispositivo (últimas 200 entradas), que se ve en Configuración → Log.
const LOCAL_KEY = "selah-log-local"
const LOCAL_MAX = 200

export interface EntradaLog { ts: number; tipo: string; pagina: string; mensaje: string; plataforma: string; detalle?: any }

export const getLocalLog = (): EntradaLog[] => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") } catch { return [] }
}
export const clearLocalLog = (): void => { try { localStorage.removeItem(LOCAL_KEY) } catch {} }

const appendLocal = (e: EntradaLog): void => {
  try {
    const arr = getLocalLog()
    arr.unshift(e)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, LOCAL_MAX)))
  } catch {}
}

export const logError = async (mensaje: string, opciones: OpcionesLog = {}): Promise<void> => {
  const entrada: EntradaLog = {
    ts: Date.now(),
    tipo: opciones.tipo || "general",
    pagina: opciones.pagina || (typeof window !== "undefined" ? window.location.pathname : ""),
    mensaje: (mensaje || "").slice(0, 500),
    plataforma: detectarPlataforma(),
    detalle: opciones.detalle,
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
      mensaje: entrada.mensaje, detalle: entrada.detalle || null,
      plataforma: entrada.plataforma,
    })
    if (error) marcarSupabaseCaido(); else marcarSupabaseOk()
  } catch { marcarSupabaseCaido() }
}

export const logCatch = (e: unknown, contexto: string, opciones: OpcionesLog = {}): void => {
  const msg = e instanceof Error ? e.message : String(e)
  logError(`${contexto}: ${msg}`, { ...opciones })
}