'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!(window as any).Capacitor) return

    import('@capacitor/app').then(({ App }) => {
      // Escuchar deep links futuros
      App.addListener('appUrlOpen', ({ url }) => {
        if (url.includes('access_token')) {
          sessionStorage.setItem('deepLinkUrl', url)
          router.push('/auth/callback')
        }
      })

      // Verificar si la app fue abierta con un deep link
      App.getLaunchUrl().then((result) => {
        const url = result?.url
        if (url && url.includes('access_token')) {
          sessionStorage.setItem('deepLinkUrl', url)
          router.push('/auth/callback')
        }
      }).catch(() => {})
    })
  }, [router])

  return null
}