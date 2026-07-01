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