"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  const publicRoutes = ["/login", "/register", "/proyectar", "/musicos"]
  const isPublicRoute =
    publicRoutes.includes(pathname) || pathname.startsWith("/auth/callback")

  useEffect(() => {
    let activo = true

    const checkSession = async () => {
      // Las rutas públicas jamás deben quedar bloqueadas por "Cargando..."
      if (isPublicRoute) {
        return
      }

      try {
        setChecking(true)

        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Error obteniendo sesión:", error)
        }

        if (!activo) return

        if (!data.session) {
          router.replace("/login")
          return
        }
      } catch (error) {
        console.error("Error en AuthProvider:", error)

        if (pathname !== "/login") {
          router.replace("/login")
        }
      } finally {
        if (activo) {
          setChecking(false)
        }
      }
    }

    checkSession()

    return () => {
      activo = false
    }
  }, [pathname, router, isPublicRoute])

  if (checking && !isPublicRoute) {
    return <div style={{ padding: 20 }}>Cargando...</div>
  }

  return <>{children}</>
}