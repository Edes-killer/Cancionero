const path = require("path")
const crypto = require("crypto")

const PANTALLAS_SELAH = new Set(["inicio", "control", "canciones", "proyectar", "musicos", "en-vivo"])

function rutaDentroDe(raiz, candidata) {
  const base = path.resolve(raiz)
  const final = path.resolve(base, candidata)
  return final === base || final.startsWith(base + path.sep) ? final : null
}

function nombreArchivoSeguro(valor, extensiones) {
  if (typeof valor !== "string" || !valor || valor !== path.basename(valor)) return null
  if (extensiones && !extensiones.test(valor)) return null
  return valor
}

function esOrigenInterno(valor) {
  try {
    const u = new URL(valor)
    return u.protocol === "file:" ||
      (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))
  } catch { return false }
}

function esOrigenServidorSelah(valor) {
  try {
    const u = new URL(valor)
    return u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      u.port === "3000"
  } catch { return false }
}

function esEnlaceWeb(valor) {
  try {
    const p = new URL(valor).protocol
    return p === "https:" || p === "http:"
  } catch { return false }
}

function esAutorizacionSupabase(valor) {
  try {
    const u = new URL(valor)
    return u.protocol === "https:" && u.hostname.endsWith(".supabase.co") &&
      u.pathname === "/auth/v1/authorize" && u.searchParams.get("provider") === "google"
  } catch { return false }
}

function destinoCallbackOAuth(valor) {
  try {
    const u = new URL(valor)
    if (u.protocol !== "selahlive:" || u.hostname !== "auth" || u.pathname !== "/callback") return null
    const parametros = new URLSearchParams(u.hash.slice(1))
    if (parametros.get("access_token") && parametros.get("refresh_token")) {
      return `http://localhost:3000/auth/callback/${u.hash}`
    }
    const code = u.searchParams.get("code")
    if (code) return `http://localhost:3000/auth/callback/?code=${encodeURIComponent(code)}`
    const error = u.searchParams.get("error") || parametros.get("error")
    if (error) return `http://localhost:3000/login/?error=oauth&detalle=${encodeURIComponent(error)}`
    return "http://localhost:3000/login/?error=oauth"
  } catch { return null }
}

// OAuth de escritorio usa el navegador del sistema, pero vuelve por el
// servidor loopback de Selah. Solo aceptamos el callback exacto en localhost;
// nunca una URL remota ni otra ruta del servidor interno.
function destinoCallbackOAuthLocal(valor) {
  try {
    const u = new URL(valor)
    const loopback = u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      u.port === "3000"
    if (!loopback || u.pathname.replace(/\/$/, "") !== "/auth/callback") return null

    const parametros = new URLSearchParams(u.hash.slice(1))
    const tieneTokens = parametros.get("access_token") && parametros.get("refresh_token")
    const tieneCodigo = Boolean(u.searchParams.get("code"))
    const tieneError = Boolean(u.searchParams.get("error") || parametros.get("error"))
    if (!tieneTokens && !tieneCodigo && !tieneError) return null

    return {
      nonce: u.searchParams.get("selah_nonce") || "",
      destino: `http://localhost:3000/auth/callback/${u.search}${u.hash}`,
    }
  } catch { return null }
}

function normalizarDireccionRed(valor) {
  const direccion = String(valor || "").trim().toLowerCase()
  if (direccion.startsWith("::ffff:")) return direccion.slice(7)
  if (direccion === "::1") return "127.0.0.1"
  return direccion
}

function esDireccionLoopback(valor) {
  const direccion = normalizarDireccionRed(valor)
  return direccion === "127.0.0.1" || direccion.startsWith("127.")
}

function pantallaSelahValida(valor) {
  return typeof valor === "string" && PANTALLAS_SELAH.has(valor)
}

function salaSelahValida(valor) {
  if (valor === "global") return true
  return typeof valor === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
}

function pinSalaValido(valor) {
  return typeof valor === "string" && /^\d{4,6}$/.test(valor)
}

function pinSalaCoincide(recibido, guardado) {
  if (!pinSalaValido(String(recibido || "")) || !pinSalaValido(String(guardado || ""))) return false
  const a = Buffer.from(String(recibido))
  const b = Buffer.from(String(guardado))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function puedeSenalizarEmision(origen, destino) {
  if (!origen || !destino || !origen.codigo || origen.codigo !== destino.codigo) return false
  return (origen.rol === "emisor" && destino.rol === "espectador") ||
    (origen.rol === "espectador" && destino.rol === "emisor")
}

module.exports = {
  rutaDentroDe,
  nombreArchivoSeguro,
  esOrigenInterno,
  esOrigenServidorSelah,
  esEnlaceWeb,
  esAutorizacionSupabase,
  destinoCallbackOAuth,
  destinoCallbackOAuthLocal,
  normalizarDireccionRed,
  esDireccionLoopback,
  pantallaSelahValida,
  salaSelahValida,
  pinSalaValido,
  pinSalaCoincide,
  puedeSenalizarEmision,
}
