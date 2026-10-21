const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")

const MAX_BYTES = 1_500_000
const MAX_LINEAS_LECTURA = 250
let carpeta = path.join(os.tmpdir(), "selah-live")

const CLAVE_SENSIBLE = /(^|_)(authorization|password|passwd|contrasena|contraseña|secret|token|access_token|refresh_token|api_key|apikey|service_role|rtmp_url|stream_key|clave_transmision|gh_token)($|_)/i

function sanitizarTexto(valor) {
  return String(valor ?? "")
    .replace(/rtmps?:\/\/[^\s"'<>]+/gi, "[DESTINO_RTMP_OCULTO]")
    .replace(/\bgh[opusr]_[A-Za-z0-9_]{20,}\b/g, "[TOKEN_GITHUB_OCULTO]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[JWT_OCULTO]")
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[TOKEN_OCULTO]")
    .replace(/\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi, (_todo, local, dominio) => `${local[0]}***${local.length > 1 ? local.at(-1) : ""}@${dominio}`)
    .slice(0, 4000)
}

function sanitizar(valor, profundidad = 0, vistos = new WeakSet()) {
  if (valor == null || typeof valor === "boolean" || typeof valor === "number") return valor
  if (typeof valor === "string") return sanitizarTexto(valor)
  if (typeof valor !== "object") return sanitizarTexto(valor)
  if (profundidad >= 5) return "[LIMITE_PROFUNDIDAD]"
  if (vistos.has(valor)) return "[REFERENCIA_CIRCULAR]"
  vistos.add(valor)
  if (valor instanceof Error) return { nombre: valor.name, mensaje: sanitizarTexto(valor.message), stack: sanitizarTexto(valor.stack || "") }
  if (Array.isArray(valor)) return valor.slice(0, 40).map(v => sanitizar(v, profundidad + 1, vistos))
  const salida = {}
  for (const [clave, contenido] of Object.entries(valor).slice(0, 40)) {
    salida[clave] = CLAVE_SENSIBLE.test(clave) ? "[DATO_SENSIBLE_OCULTO]" : sanitizar(contenido, profundidad + 1, vistos)
  }
  return salida
}

function configurarCarpeta(base) {
  carpeta = path.join(base || os.tmpdir(), "diagnostico")
  try { fs.mkdirSync(carpeta, { recursive: true }) } catch {}
  return carpeta
}

function rutaActual() { return path.join(carpeta, "selah-operativo.log") }

function rotarSiCorresponde() {
  const actual = rutaActual()
  try {
    if (!fs.existsSync(actual) || fs.statSync(actual).size < MAX_BYTES) return
    const anterior = path.join(carpeta, "selah-operativo-anterior.log")
    try { fs.rmSync(anterior, { force: true }) } catch {}
    fs.renameSync(actual, anterior)
  } catch {}
}

function registrar(evento, detalle = {}, nivel = "info") {
  try {
    fs.mkdirSync(carpeta, { recursive: true })
    rotarSiCorresponde()
    const entrada = {
      ts: new Date().toISOString(),
      nivel: ["info", "advertencia", "error", "critico"].includes(nivel) ? nivel : "info",
      evento: sanitizarTexto(evento).slice(0, 100),
      detalle: sanitizar(detalle),
    }
    fs.appendFileSync(rutaActual(), `${JSON.stringify(entrada)}\n`, "utf8")
    return entrada
  } catch { return null }
}

function leerRecientes(limite = 100) {
  try {
    const lineas = fs.readFileSync(rutaActual(), "utf8").trim().split(/\r?\n/).filter(Boolean)
    return lineas.slice(-Math.min(MAX_LINEAS_LECTURA, Math.max(1, limite))).reverse().map(linea => {
      try { return JSON.parse(linea) } catch { return { ts:null, nivel:"error", evento:"linea_invalida", detalle:{} } }
    })
  } catch { return [] }
}

module.exports = { configurarCarpeta, registrar, leerRecientes, rutaActual, sanitizar, sanitizarTexto, MAX_BYTES }
