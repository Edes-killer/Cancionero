const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function claveCamara(socketId: string, dispositivo?: unknown): string {
  return typeof dispositivo === "string" && UUID.test(dispositivo) ? `movil-${dispositivo.toLowerCase()}` : socketId
}
export function identidadCamara(almacen: Pick<Storage, "getItem" | "setItem">, generar: () => string): string {
  try {
    const previa = almacen.getItem("selah-camara-identidad")
    if (previa && UUID.test(previa)) return previa.toLowerCase()
  } catch { /* Sin almacenamiento, identidad de esta instancia. */ }
  const nueva = generar()
  try { almacen.setItem("selah-camara-identidad", nueva) } catch { /* No impedir captura. */ }
  return nueva
}

/** Ignora cierres/candidatos tardíos del enlace reemplazado. */
export class EnlacesCamara {
  private enlaces = new Map<string, string>()
  registrar(clave: string, socket: string) { this.enlaces.set(clave, socket) }
  vigente(clave: string, socket: string) { return this.enlaces.get(clave) === socket }
  retirar(clave: string, socket: string) {
    if (!this.vigente(clave, socket)) return false
    this.enlaces.delete(clave); return true
  }
  limpiar() { this.enlaces.clear() }
}

export function accionFinCamara(aviso: { de?: string; rol?: string; intencional?: boolean }, hostId: string): "ignorar" | "reintentar" | "cerrar" {
  if (aviso.rol === "host" && aviso.de === hostId) return aviso.intencional === false ? "reintentar" : "cerrar"
  // Versiones antiguas enviaban el rol como identificador solo ante caída inesperada.
  if (!aviso.rol && aviso.de === "host") return "reintentar"
  return "ignorar"
}
