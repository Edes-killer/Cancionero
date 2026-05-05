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
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(30, 41, 59, 0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "22px",
          padding: "28px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "58px",
            height: "58px",
            borderRadius: "999px",
            border: "4px solid rgba(255,255,255,0.16)",
            borderTopColor: "#38bdf8",
            margin: "0 auto 18px auto",
            animation: "spinAuthProvider 0.9s linear infinite"
          }}
        />

        <style>{`
          @keyframes spinAuthProvider {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes barraAuthProvider {
            0% { transform: translateX(-110%); }
            50% { transform: translateX(30%); }
            100% { transform: translateX(160%); }
          }
        `}</style>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            marginBottom: "8px"
          }}
        >
          Cancionero Cristiano
        </div>

        <div
          style={{
            fontSize: "14px",
            opacity: 0.78,
            lineHeight: 1.5
          }}
        >
          Verificando sesión...
        </div>

        <div
          style={{
            marginTop: "18px",
            height: "8px",
            borderRadius: "999px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)"
          }}
        >
          <div
            style={{
              height: "100%",
              width: "68%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
              animation: "barraAuthProvider 1.2s ease-in-out infinite"
            }}
          />
        </div>
      </div>
    </div>
  )
}

  return <>{children}</>
}