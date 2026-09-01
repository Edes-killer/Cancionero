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

module.exports = { rutaDentroDe, nombreArchivoSeguro, esOrigenInterno, esEnlaceWeb }
