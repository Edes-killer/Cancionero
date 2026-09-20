/** Política conservadora: solo limita el envío, nunca reinicia cámara ni conexión. */
export const PERFILES_ENVIO = [
  { nombre: "Máxima", escala: 1, bitrate: 8_000_000 },
  { nombre: "Equilibrada", escala: 1.5, bitrate: 4_000_000 },
  { nombre: "Red reducida", escala: 2, bitrate: 2_000_000 },
] as const

export interface MuestraEnvio {
  id: string; timestamp: number; bytesSent: number; framesEncoded: number
  qualityLimitationReason?: string
}
export function medirEnvio(actual: MuestraEnvio, anterior: MuestraEnvio | null) {
  if (!anterior || actual.id !== anterior.id) return null
  const segundos = (actual.timestamp - anterior.timestamp) / 1000
  const frames = actual.framesEncoded - anterior.framesEncoded
  const bytes = actual.bytesSent - anterior.bytesSent
  if (![segundos, frames, bytes].every(Number.isFinite) || segundos <= 0 || segundos > 10 || frames < 0 || bytes < 0) return null
  return { fps: frames / segundos, mbps: bytes * 8 / segundos / 1e6 }
}

export interface MuestraRecepcion {
  id: string; timestamp: number; bytesReceived: number; framesDecoded: number
  jitterBufferDelay?: number; jitterBufferEmittedCount?: number
}
export function medirRecepcion(actual: MuestraRecepcion, anterior: MuestraRecepcion | null) {
  const convertir = (s: MuestraRecepcion): MuestraEnvio => ({ id: s.id, timestamp: s.timestamp, bytesSent: s.bytesReceived, framesEncoded: s.framesDecoded })
  const flujo = medirEnvio(convertir(actual), anterior ? convertir(anterior) : null)
  if (!flujo || !anterior) return null
  const emitidos = (actual.jitterBufferEmittedCount ?? NaN) - (anterior.jitterBufferEmittedCount ?? NaN)
  const delay = (actual.jitterBufferDelay ?? NaN) - (anterior.jitterBufferDelay ?? NaN)
  const bufferMs = Number.isFinite(emitidos) && Number.isFinite(delay) && emitidos > 0 && delay >= 0 ? delay * 1000 / emitidos : null
  const aviso = flujo.fps === 0 ? "No llegan cuadros nuevos. Revisa la cámara del celular."
    : bufferMs !== null && bufferMs > 250 ? "Búfer elevado. Acerca el celular al punto de acceso y revisa la carga de la red local."
    : flujo.fps < 24 ? "Poca fluidez recibida. Revisa el FPS enviado en el celular; esta medición sola no identifica la causa."
    : ""
  return { ...flujo, bufferMs, aviso }
}

export class CalidadAdaptativa {
  nivel = 0
  private malos = 0
  private buenos = 0
  private ultimoCambio = -Infinity
  private ultimaMuestra = -Infinity

  observar(ahora: number, fps: number, motivo: string | undefined): number | null {
    // No interpretar una suspensión de la app ni estadísticas ausentes como estabilidad.
    if (!Number.isFinite(ahora) || ahora <= this.ultimaMuestra) return null
    if (ahora - this.ultimaMuestra > 10_000) this.malos = this.buenos = 0
    this.ultimaMuestra = ahora
    if (!Number.isFinite(fps) || fps <= 0) { this.malos = this.buenos = 0; return null }
    const limitado = motivo === "cpu" || motivo === "bandwidth"
    this.malos = limitado ? this.malos + 1 : 0
    // Un FPS bajo sin causa conocida no autoriza atribuir el problema a la red.
    this.buenos = motivo === "none" && fps >= 27 ? this.buenos + 1 : 0
    if (ahora - this.ultimoCambio < 15_000) return null
    if (this.malos >= 3 && this.nivel < PERFILES_ENVIO.length - 1) return this.nivel + 1
    if (this.buenos >= 10 && this.nivel > 0) return this.nivel - 1
    return null
  }

  confirmar(nivel: number, ahora: number) {
    if (!Number.isInteger(nivel) || nivel < 0 || nivel >= PERFILES_ENVIO.length) return
    this.nivel = nivel
    this.ultimoCambio = ahora
    this.malos = this.buenos = 0
  }
  fallar(ahora: number) {
    this.ultimoCambio = ahora
    this.malos = this.buenos = 0
  }
}
