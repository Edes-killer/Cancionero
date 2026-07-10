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
export function navegarSPA(router: { push: (h: string) => void; replace: (h: string) => void }, href: string, opciones?: { replace?: boolean }) {
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    if (opciones?.replace) window.location.replace(href)
    else window.location.href = href
    return
  }
  if (opciones?.replace) router.replace(href)
  else router.push(href)
}
