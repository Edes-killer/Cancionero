const net = require("node:net")
const tls = require("node:tls")

function prepararDestino(valor) {
  let url
  try { url = new URL(String(valor || "").trim()) } catch { return { ok:false, error:"url_invalida" } }
  if (!['rtmp:', 'rtmps:'].includes(url.protocol)) return { ok:false, error:"protocolo_no_admitido" }
  if (!url.hostname || url.username || url.password) return { ok:false, error:"destino_invalido" }
  const puerto = Number(url.port) || (url.protocol === 'rtmps:' ? 443 : 1935)
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) return { ok:false, error:"puerto_invalido" }
  return { ok:true, host:url.hostname, puerto, seguro:url.protocol === 'rtmps:' }
}

function probarDestino(valor, timeoutMs = 5_000) {
  const destino = prepararDestino(valor)
  if (!destino.ok) return Promise.resolve(destino)
  const inicio = Date.now()
  return new Promise(resolve => {
    let terminado = false
    let socket = null
    let limite = null
    const finalizar = resultado => {
      if (terminado) return
      terminado = true
      if (limite) clearTimeout(limite)
      try { socket?.destroy() } catch {}
      resolve({ host:destino.host, puerto:destino.puerto, seguro:destino.seguro, ms:Date.now() - inicio, ...resultado })
    }
    const opciones = { host:destino.host, port:destino.puerto }
    try {
      socket = destino.seguro
        ? tls.connect({ ...opciones, servername:net.isIP(destino.host) ? undefined : destino.host, rejectUnauthorized:true })
        : net.connect(opciones)
      limite = setTimeout(() => finalizar({ ok:false, error:"timeout" }), Math.max(500, Math.min(15_000, timeoutMs)))
      socket.once(destino.seguro ? "secureConnect" : "connect", () => finalizar({ ok:true }))
      socket.once("error", error => finalizar({ ok:false, error:String(error?.code || error?.message || "conexion_fallida").slice(0, 80) }))
    } catch (error) {
      finalizar({ ok:false, error:String(error?.code || error?.message || "conexion_fallida").slice(0, 80) })
    }
  })
}

async function probarDestinos(valores, timeoutMs = 5_000) {
  const lista = Array.isArray(valores) ? valores.slice(0, 4) : []
  return Promise.all(lista.map(valor => probarDestino(valor, timeoutMs)))
}

module.exports = { prepararDestino, probarDestino, probarDestinos }
