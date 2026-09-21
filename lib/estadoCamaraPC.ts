export type EstadoCamaraPC = { recibido: number; video: boolean | null; grabacion: "activa" | "detenida" | "sin-datos" | "error" | "desconocida" }

export function avisoCamaraPC(estado: EstadoCamaraPC | null, ahora: number) {
  if (!estado || ahora - estado.recibido > 8000) return { alerta: true, texto: "Sin confirmación del PC. No podemos asegurar que llegue el video ni que se esté grabando." }
  const video = estado.video === true ? "El PC recibe video." : estado.video === false ? "Video interrumpido: el PC no recibe cuadros nuevos." : "Comprobando recepción de video…"
  const grabacion = { activa: "Grabación del PC recibiendo datos.", detenida: "El PC NO está grabando.", "sin-datos": "Grabación sin datos recientes: revisa el PC.", error: "Error al guardar la grabación en el PC.", desconocida: "Estado de grabación no disponible." }[estado.grabacion]
  return { alerta: estado.video !== true || estado.grabacion !== "activa", texto: `${video} ${grabacion}` }
}
