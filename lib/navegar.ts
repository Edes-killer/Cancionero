// lib/navegar.ts
// Navegación entre pantallas. Se usa router.push/replace (SPA de Next) en TODOS
// los entornos, incluido el APK (Capacitor).
//
// Nota histórica: hubo un período en que la navegación SPA no funcionaba dentro
// del APK. La causa NO era el router sino el plugin CapacitorHttp (que estaba
// enabled): reemplaza el window.fetch global y el router de Next usa fetch para
// traer el RSC de cada página. Con CapacitorHttp deshabilitado (ver
// capacitor.config.ts), router.push/replace funciona normal en el WebView.

export function navegarSPA(
  router: { push: (h: string) => void; replace: (h: string) => void },
  href: string,
  opciones?: { replace?: boolean }
) {
  if (opciones?.replace) router.replace(href)
  else router.push(href)
}

// Normaliza lo que devuelve usePathname() a una ruta "limpia" para comparar
// contra rutas conocidas (rutas públicas, gate de roles, resaltado activo):
// "/login/" -> "/login" ; "/" -> "/". (trailingSlash: true en next.config)
export function normalizarRuta(pathname: string): string {
  let p = pathname.replace(/\/index\.html$/, "")
  if (p.length > 1) p = p.replace(/\/+$/, "")
  return p || "/"
}
