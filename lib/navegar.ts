// lib/navegar.ts
// ✅ Dentro del APK (Capacitor) la app corre desde archivos empaquetados,
// sin un servidor HTTP real detrás. La navegación del lado del cliente de
// Next (router.push/router.replace) se queda sin hacer nada ahí -- la URL
// ni siquiera cambia (confirmado con logs reales de un dispositivo). Fuera
// de Capacitor (Electron, navegador web) sí hay un servidor real sirviendo
// la app y router.push/replace funcionan normal.
//
// Esta función decide sola: usa navegación dura (window.location) en
// Capacitor, y la navegación normal de Next en cualquier otro caso.
import { debugLog } from "@/lib/debugTrail"

// ✅ El sitio se exporta estático con trailingSlash: true, así que cada ruta
// vive en "/ruta/index.html" (con barra final). En el WebView de Capacitor
// no hay servidor que redirija "/ruta" -> "/ruta/": pedir "/login" (sin barra)
// NO encuentra "/login/index.html" y el WebView sirve el "/index.html" raíz
// (la pantalla de Inicio) como fallback. Resultado: Inicio corría en la ruta
// /login, veía que no había sesión, redirigía a /login otra vez, y así en un
// loop infinito de recargas. Agregar la barra final hace que window.location
// apunte al archivo correcto.
export function conBarraFinal(href: string): string {
  if (!href.startsWith("/")) return href // urls absolutas (ej. OAuth externo): no tocar
  const m = href.match(/^([^?#]*)([?#].*)?$/)
  if (!m) return href
  let ruta = m[1]
  const resto = m[2] || ""
  if (ruta && !ruta.endsWith("/")) ruta += "/"
  return ruta + resto
}

export function navegarSPA(router: { push: (h: string) => void; replace: (h: string) => void }, href: string, opciones?: { replace?: boolean }) {
  const esCap = typeof window !== "undefined" && !!(window as any).Capacitor
  // 🔍 DIAGNÓSTICO TEMPORAL
  debugLog(`navegarSPA -> ${href}${opciones?.replace ? " (replace)" : ""} cap=${esCap} desde=${typeof window !== "undefined" ? window.location.pathname : "?"}`)
  if (esCap) {
    const destino = conBarraFinal(href)
    if (opciones?.replace) window.location.replace(destino)
    else window.location.href = destino
    return
  }
  if (opciones?.replace) router.replace(href)
  else router.push(href)
}
