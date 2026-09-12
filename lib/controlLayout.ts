/** Límites del divisor, expresados sobre el espacio real entre los paneles. */
export function limitarAnchoBiblioteca(porcentaje: number, anchoGrid: number): number {
  if (!Number.isFinite(porcentaje)) porcentaje = 56.5
  const disponible = Math.max(0, anchoGrid - 40 - 12 - 8)
  if (disponible < 560) return 50
  const minimo = Math.max(30, (280 / disponible) * 100)
  return Math.min(100 - minimo, Math.max(minimo, porcentaje))
}

/** Mantiene el monitor flotante dentro de la ventana, incluso al cambiar su altura. */
export function limitarPosMonitor(
  pos: { x: number; y: number },
  ventana: { ancho: number; alto: number },
  panel: { ancho: number; alto: number },
  tope = 56,
): { x: number; y: number } {
  const x = Number.isFinite(pos.x) ? pos.x : 4
  const y = Number.isFinite(pos.y) ? pos.y : tope
  return {
    x: Math.min(Math.max(4, x), Math.max(4, ventana.ancho - panel.ancho - 4)),
    y: Math.min(Math.max(tope, y), Math.max(tope, ventana.alto - panel.alto - 4)),
  }
}
