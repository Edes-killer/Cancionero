// La confirmación significa escritura al pipe, NO recepción por Facebook.
function escribirFragmento(stream, datos, timeoutMs = 5000) {
  if (!stream?.writable || stream.destroyed) return Promise.reject(Error('El motor ya no acepta video.'))
  if (datos.length + stream.writableLength > 8 * 1024 * 1024) return Promise.reject(Error('Cola del motor saturada.'))
  return new Promise((resolve, reject) => {
    let finalizado = false
    const fin = error => {
      if (finalizado) return
      finalizado = true; clearTimeout(timer)
      stream.off('error', fallo); stream.off('close', cerrado)
      if (error) reject(error); else resolve()
    }
    const fallo = error => fin(error)
    const cerrado = () => fin(Error('El motor cerró la entrada de video.'))
    const timer = setTimeout(() => fin(Error('El motor no consume video durante 5 segundos.')), timeoutMs)
    stream.once('error', fallo); stream.once('close', cerrado)
    try { stream.write(datos, fin) } catch (e) { fin(e) }
  })
}
module.exports = { escribirFragmento }
