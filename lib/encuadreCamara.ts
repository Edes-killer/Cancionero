// Conserva todo el cuadro de origen, sin estirar ni recortar.
export function encuadreContenido(origenW: number, origenH: number, ancho: number, alto: number) {
  if (![origenW, origenH, ancho, alto].every(n => Number.isFinite(n) && n > 0)) return null
  const escala = Math.min(ancho / origenW, alto / origenH)
  const w = origenW * escala, h = origenH * escala
  return { x: (ancho - w) / 2, y: (alto - h) / 2, w, h }
}

export function dibujarCamaraCompleta(ctx: CanvasRenderingContext2D, video: HTMLVideoElement,
  x: number, y: number, ancho: number, alto: number) {
  ctx.save()
  ctx.fillStyle = "#000"
  ctx.fillRect(x, y, ancho, alto)
  const r = encuadreContenido(video.videoWidth, video.videoHeight, ancho, alto)
  if (r) ctx.drawImage(video, x + r.x, y + r.y, r.w, r.h)
  ctx.restore()
}
