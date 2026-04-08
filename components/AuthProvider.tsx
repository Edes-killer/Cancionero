"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session

      const publicRoutes = ["/login", "/auth/callback"]
      const setupRoutes = ["/crear-iglesia"]

      // 🔐 sin sesión
      if (!session) {
        if (!publicRoutes.includes(pathname)) {
          router.replace("/login")
          return
        }

        setLoading(false)
        return
      }

      // 🏛 revisar iglesia
      const iglesiaId = await getIglesiaId()

      // usuario sin iglesia
      if (!iglesiaId) {
        if (!setupRoutes.includes(pathname)) {
          router.replace("/crear-iglesia")
          return
        }
      }

      // usuario con iglesia no debe volver a setup
      if (iglesiaId && pathname === "/crear-iglesia") {
        router.replace("/")
        return
      }

      // usuario logueado en login
      if (pathname === "/login") {
        router.replace("/")
        return
      }

      setLoading(false)
    }

    check()
  }, [pathname, router])

  if (loading) {
    return <div style={{ padding: 20 }}>Cargando...</div>
  }

  return <>{children}</>
}