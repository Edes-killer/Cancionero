export type NivelRegistro = "info" | "advertencia" | "error" | "critico"

export interface InfoBuild {
  version: string
  commit: string
  dirtyTracked: boolean
}

const SESION_KEY = "selah-sesion-soporte"
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "desconocida"
let infoBuildCache: InfoBuild | null = null

const idAleatorio = (): string => {
  try { return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase() } catch {}
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase()
}

export const obtenerSesionSoporte = (): string => {
  if (typeof window === "undefined") return "SERVIDOR"
  try {
    const existente = sessionStorage.getItem(SESION_KEY)
    if (existente) return existente
    const creada = `SL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${idAleatorio()}`
    sessionStorage.setItem(SESION_KEY, creada)
    return creada
  } catch {
    return `SL-${idAleatorio()}`
  }
}

export const crearOperacion = (nombre = "operacion"): string => {
  const limpio = nombre.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 24) || "operacion"
  return `${limpio}-${idAleatorio().slice(0, 8)}`
}

const CLAVES_SENSIBLES = /(^|_)(authorization|password|passwords|passwd|contrasena|contraseña|secret|secreto|token|access_token|refresh_token|api_key|apikey|service_role|rtmp_url|stream_key|clave_transmision|gh_token)($|_)/i
const MAX_PROFUNDIDAD = 5
const MAX_ELEMENTOS = 40
const MAX_TEXTO = 2_000

const ocultarCorreo = (texto: string): string => texto.replace(
  /\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
  (_todo, local, dominio) => `${local[0]}***${local.length > 1 ? local.at(-1) : ""}@${dominio}`,
)

export const sanitizarTexto = (valor: unknown): string => {
  let texto = String(valor ?? "")
  texto = texto.replace(/rtmps?:\/\/[^\s"'<>]+/gi, "[DESTINO_RTMP_OCULTO]")
  texto = texto.replace(/\bgh[opusr]_[A-Za-z0-9_]{20,}\b/g, "[TOKEN_GITHUB_OCULTO]")
  texto = texto.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[JWT_OCULTO]")
  texto = texto.replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[TOKEN_OCULTO]")
  texto = ocultarCorreo(texto)
  return texto.slice(0, MAX_TEXTO)
}

export const sanitizarParaLog = (valor: unknown, profundidad = 0, vistos = new WeakSet<object>()): unknown => {
  if (valor == null || typeof valor === "boolean" || typeof valor === "number") return valor
  if (typeof valor === "string") return sanitizarTexto(valor)
  if (typeof valor === "bigint") return valor.toString()
  if (typeof valor === "function" || typeof valor === "symbol") return `[${typeof valor}]`
  if (profundidad >= MAX_PROFUNDIDAD) return "[LIMITE_PROFUNDIDAD]"
  if (typeof valor !== "object") return sanitizarTexto(valor)
  if (vistos.has(valor)) return "[REFERENCIA_CIRCULAR]"
  vistos.add(valor)
  if (valor instanceof Error) {
    return {
      nombre: sanitizarTexto(valor.name),
      mensaje: sanitizarTexto(valor.message),
      stack: sanitizarTexto(valor.stack || ""),
    }
  }
  if (Array.isArray(valor)) {
    return valor.slice(0, MAX_ELEMENTOS).map(item => sanitizarParaLog(item, profundidad + 1, vistos))
  }
  const salida: Record<string, unknown> = {}
  for (const [clave, contenido] of Object.entries(valor).slice(0, MAX_ELEMENTOS)) {
    salida[clave] = CLAVES_SENSIBLES.test(clave)
      ? "[DATO_SENSIBLE_OCULTO]"
      : sanitizarParaLog(contenido, profundidad + 1, vistos)
  }
  return salida
}

export const obtenerInfoBuild = async (): Promise<InfoBuild> => {
  if (infoBuildCache) return infoBuildCache
  const base: InfoBuild = { version: VERSION, commit: "desconocido", dirtyTracked: false }
  if (typeof window === "undefined") return base
  try {
    const respuesta = await fetch("/build-info.json", { cache: "no-store" })
    if (!respuesta.ok) return base
    const datos = await respuesta.json() as Partial<InfoBuild>
    infoBuildCache = {
      version: sanitizarTexto(datos.version || VERSION).slice(0, 30),
      commit: sanitizarTexto(datos.commit || "desconocido").slice(0, 40),
      dirtyTracked: datos.dirtyTracked === true,
    }
    return infoBuildCache
  } catch {
    return base
  }
}

export const versionActual = (): string => VERSION
