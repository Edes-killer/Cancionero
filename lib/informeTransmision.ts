export interface DatosInformeTransmision {
  inicio: number
  fin: number
  calidad: string
  bitrateKbps: number
  destinos: string[]
  reconexiones: number
  cuadrosCaidos: number | null
  grabacionActivada: boolean
  grabacionMB: number
  carpetaGrabacion?: string
  diagnostico?: unknown
  resultado?: string
}

function duracionLegible(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":")
}

function ocultarDestinos(texto: string): string {
  return texto.replace(/rtmps?:\/\/[^\s"']+/gi, "[destino oculto]")
}

export function crearInformeTransmision(datos: DatosInformeTransmision): string {
  const inicio = Number.isFinite(datos.inicio) ? datos.inicio : datos.fin
  const fin = Number.isFinite(datos.fin) ? datos.fin : Date.now()
  const diagnosticoCrudo = datos.diagnostico == null
    ? "No disponible"
    : JSON.stringify(datos.diagnostico, null, 2)
  const diagnostico = ocultarDestinos(diagnosticoCrudo)

  return [
    "Selah Live · Informe de transmisión",
    `Inicio: ${new Date(inicio).toLocaleString("es-CL")}`,
    `Término: ${new Date(fin).toLocaleString("es-CL")}`,
    `Duración: ${duracionLegible(fin - inicio)}`,
    `Resultado: ${datos.resultado || "Finalizada por el operador"}`,
    `Calidad: ${datos.calidad} · ${Math.max(0, Math.round(datos.bitrateKbps))} kbps`,
    `Destinos: ${datos.destinos.length ? datos.destinos.join(", ") : "Ninguno"}`,
    `Reconexiones: ${Math.max(0, Math.round(datos.reconexiones))}`,
    `Cuadros caídos informados: ${datos.cuadrosCaidos == null ? "Sin datos" : Math.max(0, Math.round(datos.cuadrosCaidos))}`,
    `Grabación local: ${datos.grabacionActivada ? `Sí · ${Math.max(0, Math.round(datos.grabacionMB))} MB` : "No"}`,
    `Carpeta de grabación: ${datos.carpetaGrabacion || "No disponible"}`,
    "",
    "Diagnóstico final del motor:",
    diagnostico,
    "",
    "Este informe no confirma que la plataforma haya publicado el video y no contiene claves de transmisión.",
  ].join("\n")
}
