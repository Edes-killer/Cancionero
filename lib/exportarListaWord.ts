import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"
import type { ElementoExportable } from "./exportarListaTexto"

const limpio = (valor?: string) => (valor || "").trim()

export async function exportarListaWord(nombre: string, items: ElementoExportable[]): Promise<Blob> {
  const parrafos: Paragraph[] = [
    new Paragraph({ text: limpio(nombre) || "Lista de culto", heading: HeadingLevel.TITLE, spacing: { after: 320 } }),
  ]

  items.forEach((item, i) => {
    const tipo = item.tipo || "elemento"
    let titulo = limpio(item.titulo) || tipo
    if (tipo === "biblia") titulo = limpio(item.referencia || item.referencia_biblica || titulo.replace(/^📖\s*/, "")) || "Cita bíblica"
    if (tipo === "cancion" && item.tono) titulo += ` · Tono: ${item.tono}`
    if (tipo === "carrusel" && !item.titulo) titulo = "Carrusel"
    parrafos.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}. ${titulo}`, bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
    }))

    const contenido = tipo === "biblia"
      ? limpio(item.texto) || item.paginas?.map(limpio).filter(Boolean).join("\n\n") || ""
      : tipo === "cancion"
        ? (item.partes || []).map(parte => {
            const letra = limpio(parte.texto_letra || parte.texto)
            return letra ? `${parte.tipo ? `${parte.tipo}:\n` : ""}${letra}` : ""
          }).filter(Boolean).join("\n\n")
        : tipo === "estado" || tipo === "mensaje"
          ? [item.subtitulo, item.texto].map(limpio).filter(Boolean).join("\n\n")
          : limpio(item.texto)

    for (const bloque of contenido.split(/\n\s*\n/).map(limpio).filter(Boolean)) {
      parrafos.push(new Paragraph({ text: bloque, spacing: { after: 140 } }))
    }
  })

  return Packer.toBlob(new Document({ sections: [{ children: parrafos }] }))
}
