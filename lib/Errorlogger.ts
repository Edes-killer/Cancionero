import { supabase } from "@/lib/supabase"

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

export const logError = async (mensaje: string, opciones: OpcionesLog = {}): Promise<void> => {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[ErrorLog] ${opciones.tipo || "general"}: ${mensaje}`)
    return
  }
  try {
    const { iglesiaId, userId } = await getIds()
    if (!userId) return
    await supabase.from("errores_log").insert({
      iglesia_id: iglesiaId, user_id: userId,
      pagina: opciones.pagina || (typeof window !== "undefined" ? window.location.pathname : ""),
      tipo: opciones.tipo || "general",
      mensaje: mensaje.slice(0, 500),
      detalle: opciones.detalle || null,
      plataforma: detectarPlataforma(),
    })
  } catch {}
}

export const logCatch = (e: unknown, contexto: string, opciones: OpcionesLog = {}): void => {
  const msg = e instanceof Error ? e.message : String(e)
  logError(`${contexto}: ${msg}`, { ...opciones })
}