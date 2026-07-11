// lib/navegar.ts
// ✅ SIEMPRE navegación SPA del lado del cliente (router.push/replace), en
// TODOS los entornos incluido el APK (Capacitor).
//
// Historia: en algún momento se creyó que router.push no funcionaba dentro
// de Capacitor y se cambió a navegación dura (window.location). Eso resultó
// ser un diagnóstico equivocado -- lo que realmente estaba roto entonces era
// la hidratación de React (que dejaba todo el árbol sin manejadores). Peor
// aún, la navegación dura destapó un bug fatal: la app se exporta estática
// (output: export), así que el WebView de Capacitor sirve el "/index.html"
// raíz para CUALQUIER subruta pedida por window.location (con o sin barra
// final). Es decir, window.location.replace("/login") cargaba en realidad la
// pantalla de Inicio, que al no ver sesión redirigía a /login de nuevo... un
// loop infinito de recargas (confirmado con un diario en pantalla en el
// dispositivo: path=/login/ pero corriendo el código de Inicio).
//
// La navegación SPA no hace recarga de documento, así que nunca toca ese
// fallback de archivos -- es la única forma correcta de navegar acá. Es lo
// que hacía la versión que funcionaba (APK del 3 de julio).
import { debugLog } from "@/lib/debugTrail"

export function navegarSPA(router: { push: (h: string) => void; replace: (h: string) => void }, href: string, opciones?: { replace?: boolean }) {
  // 🔍 DIAGNÓSTICO TEMPORAL
  debugLog(`navegarSPA(SPA) -> ${href}${opciones?.replace ? " (replace)" : ""} desde=${typeof window !== "undefined" ? window.location.pathname : "?"}`)
  if (opciones?.replace) router.replace(href)
  else router.push(href)
}
