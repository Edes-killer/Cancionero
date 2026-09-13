const path = require("path")

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
    return "http://localhost:3000/login/?error=oauth"
  } catch { return null }
}

module.exports = { rutaDentroDe, nombreArchivoSeguro, esOrigenInterno, esEnlaceWeb, esAutorizacionSupabase, destinoCallbackOAuth }
