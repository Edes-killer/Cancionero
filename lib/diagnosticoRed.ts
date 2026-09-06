export interface ResultadoCanalRed {
  ok: boolean
  ms: number | null
  error?: string
}

export interface DiagnosticoRed {
  fecha: string
  objetivo: string
  plataforma: "electron" | "apk" | "web"
  online: boolean
  http: ResultadoCanalRed & { status?: number; app?: string; version?: string; qaProtocol?: number }
  socket: ResultadoCanalRed & { transporte?: string }
  info?: { ip?: string; ips?: string[]; puerto?: number }
}

export function interpretarDiagnosticoRed(d: DiagnosticoRed): string {
  if (!d.online) return "El dispositivo aparece sin conexión de red. Revisa el Wi‑Fi antes de continuar."
  if (!d.http.ok) return "El servidor no es alcanzable. Confirma que Selah esté abierto en el PC, que ambos equipos usen la misma red y que el repetidor no tenga aislamiento de clientes."
  if (d.http.app !== "selah-live") return "La dirección respondió, pero no corresponde a un servidor Selah Live. Revisa la IP ingresada."
  if (!d.socket.ok) return "El servidor HTTP responde, pero el canal de sincronización está bloqueado. Revisa el firewall de Windows o el aislamiento del repetidor/router."
  return "La comunicación completa con Selah Live funciona correctamente."
}

export function formatearDiagnosticoRed(d: DiagnosticoRed): string {
  const estado = (ok: boolean) => ok ? "OK" : "FALLÓ"
  return [
    "Diagnóstico de red · Selah Live",
    `Fecha: ${d.fecha}`,
    `Plataforma: ${d.plataforma}`,
    `Servidor: ${d.objetivo}`,
    `Red del dispositivo: ${d.online ? "conectada" : "sin conexión"}`,
    `HTTP /ping: ${estado(d.http.ok)}${d.http.ms !== null ? ` · ${d.http.ms} ms` : ""}${d.http.status ? ` · HTTP ${d.http.status}` : ""}`,
    `Servidor detectado: ${d.http.app || "no disponible"}`,
    `Versión: ${d.http.version || "no disponible"} · protocolo QA: ${d.http.qaProtocol ?? "no disponible"}`,
    `Socket.IO: ${estado(d.socket.ok)}${d.socket.ms !== null ? ` · ${d.socket.ms} ms` : ""}${d.socket.transporte ? ` · ${d.socket.transporte}` : ""}`,
    `IP informada por el PC: ${d.info?.ip || "no disponible"}`,
    d.info?.ips?.length ? `IPs disponibles en el PC: ${d.info.ips.join(", ")}` : "",
    d.http.error ? `Error HTTP: ${d.http.error}` : "",
    d.socket.error ? `Error Socket.IO: ${d.socket.error}` : "",
    `Conclusión: ${interpretarDiagnosticoRed(d)}`,
  ].filter(Boolean).join("\n")
}
