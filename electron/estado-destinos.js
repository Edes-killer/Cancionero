// Traduce mensajes internos de FFmpeg/FIFO a estados seguros para la interfaz.
// Nunca devuelve URL, host ni clave de transmisión.
class SeguimientoDestinos {
  constructor(salidas, onCambio) {
    this.salidas = Array.isArray(salidas) ? salidas : []
    this.onCambio = typeof onCambio === 'function' ? onCambio : () => {}
    this.estados = new Map()
    this.fifoSalidas = new Map()
  }

  emitir(indice, estado, detalle) {
    const salida = this.salidas[indice]
    if (!salida || this.estados.get(salida.id) === estado) return false
    this.estados.set(salida.id, estado)
    this.onCambio({ id:salida.id, nombre:salida.nombre, estado, detalle })
    return true
  }

  iniciar() {
    this.salidas.forEach((_salida, indice) => this.emitir(
      indice,
      'enviando',
      'FFmpeg está entregando paquetes; confirma la vista previa en la plataforma.',
    ))
  }

  linea(linea) {
    const contextoFifo = /\[fifo @ ([^\]]+)\]/i.exec(linea)?.[1]
    let indice = this.salidas.findIndex(salida => typeof salida.url === 'string' && linea.includes(salida.url))
    if (contextoFifo && indice >= 0) this.fifoSalidas.set(contextoFifo, indice)
    if (indice < 0 && contextoFifo && this.fifoSalidas.has(contextoFifo)) indice = this.fifoSalidas.get(contextoFifo)
    if (indice < 0) return { reconocido:false, recuperado:false }

    if (/Recovery successful/i.test(linea)) {
      this.emitir(indice, 'enviando', 'Salida recuperada; confirma la vista previa en la plataforma.')
      return { reconocido:true, recuperado:true, indice }
    }
    if (/Recovery attempt|Recovery failed|Error opening|FIFO queue full/i.test(linea)) {
      this.emitir(indice, 'reconectando', 'La salida se interrumpió y Selah está reintentando automáticamente.')
      return { reconocido:true, recuperado:false, indice }
    }
    return { reconocido:true, recuperado:false, indice }
  }
}

module.exports = { SeguimientoDestinos }
