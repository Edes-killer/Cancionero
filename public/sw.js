// Service Worker — Selah Live
const CACHE = "selah-v1"
const STATIC = ["/", "/control", "/musicos", "/canciones", "/configuracion"]

// Instalar: cachear rutas principales
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

// Activar: limpiar caches viejos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: Cache First para assets estáticos, Network First para API
self.addEventListener("fetch", e => {
  // ✅ cache.put() solo acepta GET — HEAD/POST/etc rompen el Service Worker
  if (e.request.method !== "GET") return

  const url = new URL(e.request.url)

  // API y socket: siempre red
  if (url.pathname.startsWith("/api/") || url.port === "4000") return

  // Supabase: siempre red
  if (url.hostname.includes("supabase")) return

  // Assets JS/CSS/fuentes: cache first con fallback red
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|webp|svg|ico)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Páginas HTML: network first con fallback cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
      }
      return res
    }).catch(() => caches.match(e.request))
  )
})