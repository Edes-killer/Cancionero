export interface ElementoExportable {
  tipo?: string
  titulo?: string
  subtitulo?: string
  referencia?: string
  referencia_biblica?: string
  texto?: string
  paginas?: string[]
  tono?: string
  partes?: { texto?: string; texto_letra?: string; tipo?: string }[]
  modo?: string
  url?: string
  urls?: string[]
}

const limpio = (valor?: string) => (valor || "").trim()

export function nombreArchivoLista(nombre: string): string {
  const seguro = (nombre.trim() || "lista-de-culto")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "lista-de-culto"
  return `${seguro}.txt`
}

export function exportarListaTexto(nombre: string, items: ElementoExportable[]): string {
  const lineas = [limpio(nombre) || "Lista de culto", "=".repeat(42), ""]

  items.forEach((item, i) => {
    const tipo = item.tipo || "elemento"
    if (tipo === "biblia") {
      const referencia = limpio(item.referencia || item.referencia_biblica || item.titulo?.replace(/^📖\s*/, "")) || "Cita bíblica"
      lineas.push(`${i + 1}. 📖 ${referencia}`)
      const texto = limpio(item.texto) || item.paginas?.map(limpio).filter(Boolean).join("\n\n") || ""
      if (texto) lineas.push(texto)
    } else if (tipo === "cancion") {
      lineas.push(`${i + 1}. 🎵 ${limpio(item.titulo) || "Canción"}${item.tono ? ` · Tono: ${item.tono}` : ""}`)
      for (const parte of item.partes || []) {
        const letra = limpio(parte.texto_letra || parte.texto)
        if (letra) lineas.push(`${parte.tipo ? `${parte.tipo}:\n` : ""}${letra}`)
      }
    } else if (tipo === "estado" || tipo === "mensaje") {
      lineas.push(`${i + 1}. ${limpio(item.titulo) || (item.modo === "espera" ? "Pantalla de espera" : "Mensaje")}`)
      if (limpio(item.subtitulo)) lineas.push(limpio(item.subtitulo))
      if (limpio(item.texto)) lineas.push(limpio(item.texto))
    } else if (tipo === "imagen" || tipo === "video" || tipo === "carrusel") {
      lineas.push(`${i + 1}. ${tipo === "carrusel" ? "Carrusel" : tipo === "video" ? "Video" : "Imagen"}${item.titulo ? `: ${limpio(item.titulo)}` : ""}`)
    } else {
      lineas.push(`${i + 1}. ${limpio(item.titulo) || tipo}`)
      if (limpio(item.texto)) lineas.push(limpio(item.texto))
    }
    lineas.push("")
  })

  return lineas.join("\r\n")
}
