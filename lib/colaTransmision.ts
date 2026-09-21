// Ordena los fragmentos y limita los bytes retenidos mientras esperamos al PC.
export class ColaTransmision {
  private cola = Promise.resolve()
  private bytes = 0
  private cerrada = false
  private fallo: (mensaje: string) => void
  private limite: number
  constructor(fallo: (mensaje: string) => void, limite = 8 * 1024 * 1024) { this.fallo = fallo; this.limite = limite }
  agregar(bytes: number, tarea: () => Promise<void>) {
    if (this.cerrada) return
    if (bytes > this.limite - this.bytes) { this.fallar("Se acumuló demasiado video pendiente de envío."); return }
    this.bytes += bytes
    this.cola = this.cola.then(async () => { if (!this.cerrada) await tarea() })
      .catch(e => this.fallar(e?.message || "No se pudo entregar video al motor."))
      .finally(() => { this.bytes -= bytes })
  }
  private fallar(mensaje: string) { if (this.cerrada) return; this.cerrada = true; this.fallo(mensaje) }
  cerrar() { this.cerrada = true }
  terminar() { return this.cola }
}
