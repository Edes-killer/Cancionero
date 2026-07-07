// lib/servidor.ts
export const getSocketUrl = (): string => {
  if (typeof window === "undefined") return ""
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL
  const ip = localStorage.getItem("servidor_ip") || window.location.hostname
  return `http://${ip}:4000`
}

export const getApiUrl = (path: string): string => {
  const base = getSocketUrl()
  return `${base}${path.startsWith("/") ? path : "/" + path}`
}

// ✅ Auto-discovery: escanea subredes comunes de la red local buscando el
// servidor de Electron (endpoint /info). Compartido entre configuracion
// (botón manual) y el arranque de la app en el APK (intento automático) —
// antes esta lógica vivía duplicada solo en configuracion/page.tsx.
const SUBREDES_COMUNES = ["192.168.1", "192.168.0", "192.168.100", "192.168.2", "192.168.50", "10.0.0", "10.0.1", "172.16.0"]

export async function buscarServidorEnRed(
  onProgreso?: (mensaje: string) => void
): Promise<string | null> {
  const ips: string[] = []
  SUBREDES_COMUNES.forEach(sub => { for (let i = 1; i <= 254; i++) ips.push(`${sub}.${i}`) })

  const BATCH = 30
  for (let i = 0; i < ips.length; i += BATCH) {
    const lote = ips.slice(i, i + BATCH)
    onProgreso?.(`Buscando servidor... (${Math.min(i + BATCH, ips.length)}/${ips.length})`)
    const resultados = await Promise.allSettled(
      lote.map(ip => fetch(`http://${ip}:4000/info`, { signal: AbortSignal.timeout(400) })
        .then(r => r.json()).then(d => d?.app === "selah-live" ? ip : null))
    )
    for (const r of resultados) {
      if (r.status === "fulfilled" && r.value) return r.value
    }
  }
  return null
}