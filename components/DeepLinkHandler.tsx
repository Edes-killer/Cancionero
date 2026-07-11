'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { conTimeout } from '@/lib/timeout'
import { debugLog } from '@/lib/debugTrail'
import { navegarSPA } from '@/lib/navegar'
import { establecerSesionUnaVez } from '@/lib/authCallback'

export function DeepLinkHandler() {
  const router = useRouter()
  useEffect(() => {
    // ❌ Service Worker DESACTIVADO: su estrategia cache-first servía JS/CSS
    // viejo indefinidamente tras un cierre/apertura normal del navegador,
    // dejando a los usuarios atrapados en versiones con bugs ya corregidos
    // sin ninguna forma de saberlo. Para una herramienta en vivo de iglesias,
    // que los fixes lleguen siempre es más importante que el caché offline.
    //
    // ✅ Auto-limpieza: si un usuario ya tiene el SW viejo instalado desde
    // antes, esto lo desregistra y borra su caché sin que tenga que hacer
    // nada — se resuelve solo la próxima vez que abra la app.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister())
      }).catch(() => {})
      if ("caches" in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
      }
    }

    if (!(window as any).Capacitor) return

    const run = async () => {
      try {
        const { App } = await import('@capacitor/app')

        // ✅ Dominio público (Vercel) registrado como App Link -- ver
        // android/app/src/main/AndroidManifest.xml + public/.well-known/assetlinks.json.
        // Antes procesarUrl solo reaccionaba al esquema propio
        // "com.tuiglesia.cancionero://"; un link normal compartido por
        // WhatsApp (https://selah-live.vercel.app/...) abría la app pero
        // esta lo ignoraba por completo.
        const DOMINIO_APP_LINK = 'https://selah-live.vercel.app'

        const procesarUrl = async (url: string) => {
          const esEsquemaPropio = url.startsWith('com.tuiglesia.cancionero')
          const esAppLink = url.startsWith(DOMINIO_APP_LINK)
          if (!esEsquemaPropio && !esAppLink) return

          try { const { Browser } = await import('@capacitor/browser'); await Browser.close() } catch {}

          const frag = url.includes('#') ? url.split('#')[1] : ''
          const qstr = url.includes('?') ? url.split('?')[1]?.split('#')[0] : ''
          const hp   = new URLSearchParams(frag)
          const qp   = new URLSearchParams(qstr)

          const access_token  = hp.get('access_token')  || qp.get('access_token')
          const refresh_token = hp.get('refresh_token') || qp.get('refresh_token')
          const error         = hp.get('error')         || qp.get('error')

          if (error) { navegarSPA(router, '/login?error=oauth', { replace: true }); return }

          if (access_token && refresh_token) {
            debugLog(`DeepLink procesarUrl: tiene tokens, procesando (single-flight)`)
            const r = await establecerSesionUnaVez(access_token, refresh_token)
            if (r !== "ok") { debugLog(`DeepLink: sesion fallo (${r}) -> /login`); navegarSPA(router, '/login?error=session', { replace: true }); return }
            // ✅ Si veníamos de aceptar una invitación, volver ahí para
            // terminarla -- antes esto siempre mandaba al home y el código
            // pendiente en localStorage quedaba sin usarse.
            const codigoPendiente = localStorage.getItem('selah_inv_codigo')
            debugLog(`DeepLink: sesion OK -> ${codigoPendiente ? '/unirse' : '/'}`)
            navegarSPA(router, codigoPendiente ? `/unirse?codigo=${codigoPendiente}` : '/', { replace: true })
            return
          }

          // ✅ App Link normal (sin tokens de OAuth) -- ej. el usuario toca
          // el link de invitación y la app ya está instalada: llevar la
          // WebView interna a la misma ruta que traía el link público.
          if (esAppLink) {
            try {
              const u = new URL(url)
              navegarSPA(router, u.pathname + u.search, { replace: true })
            } catch { /* ignorar URL malformada */ }
          }
        }

        App.addListener('appUrlOpen', async ({ url }) => {
          await procesarUrl(url)
        })

        // ✅ getLaunchUrl() puede seguir devolviendo la MISMA url en cada
        // recarga interna del WebView (ej. tras un window.location.href),
        // no solo en el arranque real de la app -- si esa url traía un
        // token de sesión, se reprocesaba una y otra vez, cada vez
        // navegando de nuevo → recarga → se vuelve a leer la misma
        // getLaunchUrl() → loop infinito. sessionStorage sobrevive a estas
        // recargas (a diferencia de un cierre real de la app), así que sirve
        // para marcar "esta url ya se procesó en esta sesión".
        const launch = await App.getLaunchUrl().catch(() => null)
        debugLog(`DeepLink getLaunchUrl = ${launch?.url ? launch.url.slice(0, 60) : "null"}`)
        if (launch?.url) {
          const YA_PROCESADA_KEY = 'selah_launch_url_procesada'
          if (sessionStorage.getItem(YA_PROCESADA_KEY) !== launch.url) {
            debugLog(`DeepLink -> procesando launchUrl (primera vez esta sesion)`)
            sessionStorage.setItem(YA_PROCESADA_KEY, launch.url)
            await procesarUrl(launch.url)
          } else {
            debugLog(`DeepLink -> launchUrl ya procesada, se ignora`)
          }
        }

        App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return
          const resultado = await conTimeout(supabase.auth.getSession(), 5000)
          const haySesion = resultado !== "timeout" && !!resultado.data.session
          // ✅ normalizar barra final (trailingSlash) -- pathname es "/login/"
          const enLogin = window.location.pathname.replace(/\/$/, "") === '/login'
          debugLog(`DeepLink appStateChange activo: sesion=${haySesion} path=${window.location.pathname}`)
          if (haySesion && enLogin) {
            debugLog(`DeepLink appStateChange -> navega a /`)
            navegarSPA(router, '/', { replace: true })
          }
        })

      } catch (e) {
        console.error('DeepLinkHandler error:', e)
      }
    }

    run()
  }, [])

  return null
}
