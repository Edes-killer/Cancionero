'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

        const procesarUrl = async (url: string) => {
          if (!url.startsWith('com.tuiglesia.cancionero')) return

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
            window.location.href = e ? '/login?error=session' : '/'
            return
          }
        }

        App.addListener('appUrlOpen', async ({ url }) => {
          await procesarUrl(url)
        })

        const launch = await App.getLaunchUrl().catch(() => null)
        if (launch?.url) await procesarUrl(launch.url)

        App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return
          const { data } = await supabase.auth.getSession()
          if (data.session && window.location.pathname === '/login') {
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
