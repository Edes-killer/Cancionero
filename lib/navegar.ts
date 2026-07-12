// lib/navegar.ts
import { debugLog } from "@/lib/debugTrail"

// ──────────────────────────────────────────────────────────────────────────
//  NAVEGACIÓN EN CAPACITOR (APK) — resumen de lo aprendido a la mala:
//
//  La app se exporta estática (output: export, trailingSlash: true), así que
//  cada ruta vive en "/ruta/index.html". El WebView de Capacitor:
//   • NO hace índice de directorio: pedir "/control" o "/control/" por
//     window.location NO encuentra "/control/index.html" y sirve el
//     "/index.html" raíz (pantalla de Inicio) como fallback SPA. Eso causaba
//     un loop infinito de recargas (confirmado en el dispositivo).
//   • La navegación SPA de Next (router.push/replace) NO cambia de página una
//     vez que la app ya cargó -- se llama, no tira error, pero no navega
//     (confirmado: tras "navegarSPA -> /control" no montaba /control ni corría
//     su AuthProvider). El fetch del RSC no resuelve en este WebView.
//   • SÍ sirve archivos que existen EXACTAMENTE. "/control/index.html" está en
//     los assets, así que navegar a esa ruta exacta carga la página correcta.
//
//  Por eso, en Capacitor navegamos por window.location al archivo index.html
//  EXACTO de la subpágina. Fuera de Capacitor (Electron, web) hay un servidor
//  real y la navegación SPA de Next funciona normal.
// ──────────────────────────────────────────────────────────────────────────

const esCapacitor = () => typeof window !== "undefined" && !!(window as any).Capacitor

// "/control" -> "/control/index.html" ; "/canciones?x=1" -> "/canciones/index.html?x=1"
// "/" -> "/" ; conserva query y hash.
export function aArchivoIndex(href: string): string {
  if (!href.startsWith("/")) return href // urls absolutas (OAuth externo): no tocar
  const m = href.match(/^([^?#]*)([?#].*)?$/)
  if (!m) return href
  const resto = m[2] || ""
  let ruta = m[1].replace(/\/+$/, "") // sacar barras finales
  if (ruta === "") return "/" + resto // raíz
  return `${ruta}/index.html${resto}`
}

// Normaliza lo que devuelve usePathname() a una ruta "limpia" para comparar
// contra rutas conocidas (rutas públicas, gate de roles, resaltado activo):
// "/control/index.html" -> "/control" ; "/login/" -> "/login" ; "/" -> "/".
export function normalizarRuta(pathname: string): string {
  let p = pathname.replace(/\/index\.html$/, "")
  if (p.length > 1) p = p.replace(/\/+$/, "")
  return p || "/"
}

export function navegarSPA(
  router: { push: (h: string) => void; replace: (h: string) => void },
  href: string,
  opciones?: { replace?: boolean }
) {
  if (esCapacitor()) {
    const destino = aArchivoIndex(href)
    debugLog(`navegarSPA(APK) -> ${destino} desde=${window.location.pathname}`)
    if (opciones?.replace) window.location.replace(destino)
    else window.location.href = destino
    return
  }
  debugLog(`navegarSPA(SPA) -> ${href}${opciones?.replace ? " (replace)" : ""}`)
  if (opciones?.replace) router.replace(href)
  else router.push(href)
}
