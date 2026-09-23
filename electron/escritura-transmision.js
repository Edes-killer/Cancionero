// La confirmación significa escritura al pipe, NO recepción por Facebook.
function escribirFragmento(stream, datos, timeoutMs = 30000, progreso = () => 0) {
  if (!stream?.writable || stream.destroyed) return Promise.reject(Error('El motor ya no acepta video.'))
  if (datos.length + stream.writableLength > 8 * 1024 * 1024) return Promise.reject(Error('Cola del motor saturada.'))
  return new Promise((resolve, reject) => {
    let finalizado = false
    const fin = error => {
      if (finalizado) return
      finalizado = true; clearInterval(timer)
      stream.off('error', fallo); stream.off('close', cerrado)
      if (error) reject(error); else resolve()
    }
    const fallo = error => fin(error)
    const cerrado = () => fin(Error('El motor cerró la entrada de video.'))
    let ultimoProgreso = progreso(), ultimosBytes = stream.bytesWritten || 0, ultimaActividad = Date.now()
    const timer = setInterval(() => {
      const actual = progreso(), bytes = stream.bytesWritten || 0
      // Una escritura grande puede seguir pendiente aunque el encoder avance.
      if (actual > ultimoProgreso || bytes > ultimosBytes) ultimaActividad = Date.now()
      ultimoProgreso = actual; ultimosBytes = bytes
      if (Date.now() - ultimaActividad >= timeoutMs) fin(Error('El motor no confirma progreso durante el plazo de vigilancia.'))
    }, Math.min(1000, timeoutMs))
    stream.once('error', fallo); stream.once('close', cerrado)
    try { stream.write(datos, fin) } catch (e) { fin(e) }
  })
}
module.exports = { escribirFragmento }
