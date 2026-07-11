'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { conTimeout } from '@/lib/timeout'

export function DeepLinkHandler() {
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

          if (error) { window.location.href = '/login?error=oauth'; return }

          if (access_token && refresh_token) {
            const { error: e } = await supabase.auth.setSession({ access_token, refresh_token })
            if (e) { window.location.href = '/login?error=session'; return }
            // ✅ Si veníamos de aceptar una invitación, volver ahí para
            // terminarla -- antes esto siempre mandaba al home y el código
            // pendiente en localStorage quedaba sin usarse.
            const codigoPendiente = localStorage.getItem('selah_inv_codigo')
            window.location.href = codigoPendiente ? `/unirse?codigo=${codigoPendiente}` : '/'
            return
          }

          // ✅ App Link normal (sin tokens de OAuth) -- ej. el usuario toca
          // el link de invitación y la app ya está instalada: llevar la
          // WebView interna a la misma ruta que traía el link público.
          if (esAppLink) {
            try {
              const u = new URL(url)
              window.location.href = u.pathname + u.search
            } catch { /* ignorar URL malformada */ }
          }
        }

        App.addListener('appUrlOpen', async ({ url }) => {
          await procesarUrl(url)
        })

        const launch = await App.getLaunchUrl().catch(() => null)
        if (launch?.url) await procesarUrl(launch.url)

        App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return
          const resultado = await conTimeout(supabase.auth.getSession(), 5000)
          if (resultado !== "timeout" && resultado.data.session && window.location.pathname === '/login') {
            window.location.href = '/'
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
