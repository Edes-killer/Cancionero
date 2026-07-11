// 🔍 DIAGNÓSTICO TEMPORAL -- diario de eventos que sobrevive a las recargas.
// Escribe en localStorage un buffer circular de los últimos N eventos, con
// marca de tiempo. Sirve para ver qué está pasando cuando la app se recarga
// en loop y no se puede usar la consola de Chrome ni el botón de eruda.
// BORRAR (este archivo, DebugOverlay y sus usos) antes de una versión real.

const KEY = "selah_debug_trail"
const MAX = 40

export function debugLog(msg: string) {
  if (typeof window === "undefined") return
  try {
    const t = new Date()
    const hora = `${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}.${String(t.getMilliseconds()).padStart(3, "0")}`
    const previo = localStorage.getItem(KEY) || ""
    const lineas = previo ? previo.split("\n") : []
    lineas.push(`${hora} ${msg}`)
    while (lineas.length > MAX) lineas.shift()
    localStorage.setItem(KEY, lineas.join("\n"))
  } catch { /* ignorar */ }
}

export function debugLeer(): string {
  if (typeof window === "undefined") return ""
  try { return localStorage.getItem(KEY) || "" } catch { return "" }
}

export function debugLimpiar() {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(KEY) } catch { /* ignorar */ }
}
