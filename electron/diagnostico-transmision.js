// No almacena destinos, claves ni texto crudo de FFmpeg.
class DiagnosticoTransmision {
  constructor(ahora = Date.now()) {
    this.inicio = ahora; this.entrada = null; this.avance = null
    this.bytes = 0; this.cuadros = 0; this.dts = 0; this.error = null; this.resto = ""
  }
  chunk(bytes, ahora = Date.now()) { this.bytes += bytes; this.entrada = ahora }
  stderr(texto, ahora = Date.now()) {
    this.resto += texto
    const lineas = this.resto.split(/[\r\n]/); this.resto = lineas.pop().slice(-4096)
    for (const l of lineas) {
      if (/Non-monotonic DTS|backward in time/.test(l)) this.dts++
      if (/Publish Rejected|Invalid URL/.test(l)) this.error = "Destino rechazado: revisa la URL y clave de esta emisión."
      else if (/Error in the push|I\/O error|Error number -10053|TLS fatal/.test(l) && !this.error) this.error = "Conexión de salida interrumpida; el registro no determina si fue red o plataforma."
      const frame = /frame=\s*(\d+)/.exec(l)
      if (frame && +frame[1] > this.cuadros) { this.cuadros = +frame[1]; this.avance = ahora }
    }
  }
  estado(cola = 0, activo = true, ahora = Date.now()) {
    const entradaMs = this.entrada === null ? null : ahora - this.entrada
    const avanceMs = this.avance === null ? null : ahora - this.avance
    let diagnostico = "Esperando los primeros cuadros de salida."
    if (this.error) diagnostico = this.error
    else if (!activo) diagnostico = "Proceso detenido; no se está enviando desde esta sesión."
    else if (ahora - this.inicio > 12000 && (entradaMs === null || entradaMs > 8000)) diagnostico = "No llegan fragmentos de captura a FFmpeg. Revisar captura y ventana de transmisión."
    else if (cola > 4 * 1024 * 1024) diagnostico = "Datos acumulados hacia FFmpeg. El procesamiento o la salida no los consumen a tiempo."
    else if (ahora - this.inicio > 15000 && (avanceMs === null || avanceMs > 12000)) diagnostico = "FFmpeg no confirma cuadros nuevos de salida. Revisar procesamiento y conexión de salida."
    else if (avanceMs !== null) diagnostico = this.dts ? "Salida con avance, pero hay avisos de tiempos de audio/video." : "FFmpeg informa avance. No confirma publicación en Facebook."
    return { diagnostico, activo, bytesEntrada: this.bytes, entradaMs, avanceMs, colaBytes: cola, cuadros: this.cuadros, avisosTiempo: this.dts }
  }
}
function ocultarDestinos(texto) { return texto.replace(/rtmps?:\/\/[^\s|'"\]]+/gi, "[DESTINO OCULTO]") }
module.exports = { DiagnosticoTransmision, ocultarDestinos }
