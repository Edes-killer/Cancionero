"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function CallbackPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<"procesando" | "error">("procesando")
  const [mensajeError, setMensajeError] = useState("")

  useEffect(() => {
    const completarLogin = async () => {
      try {
        const hash = window.location.hash
        const searchParams = new URLSearchParams(window.location.search)

        // ── Caso 1: implicit flow — token viene en el hash ──────────────────
        if (hash.includes("access_token")) {
          const params = new URLSearchParams(hash.replace("#", ""))
          const access_token = params.get("access_token")
          const refresh_token = params.get("refresh_token")

          if (!access_token || !refresh_token) {
            setMensajeError("El link no contiene los tokens necesarios. Intenta iniciar sesión nuevamente.")
            setEstado("error")
            return
          }

          const { error } = await supabase.auth.setSession({ access_token, refresh_token })

          if (error) {
            console.error("Error setSession:", error)
            setMensajeError("No se pudo iniciar sesión. El link puede haber expirado.")
            setEstado("error")
            return
          }

          router.replace("/")
          return
        }

        // ── Caso 2: PKCE — no soportado, redirigir a login ─────────────────
        const code = searchParams.get("code")
        if (code) {
          // Con flowType: "implicit" en supabase.ts no se usa PKCE
          // Si llega un code, significa que Supabase cambió el flow
          // Redirigir al login para reintentar
          router.replace("/login?error=session")
          return
        }

        // ── Caso 3: error explícito de Supabase en la URL ───────────────────
        const errorDesc = searchParams.get("error_description") || hash
        if (errorDesc) {
          setMensajeError(decodeURIComponent(errorDesc.replace(/\+/g, " ")))
          setEstado("error")
          return
        }

        // ── Caso 4: puede que la sesión ya esté guardada (recarga) ──────────
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          router.replace("/")
          return
        }

        // No hay nada útil en la URL
        setMensajeError("No se encontró información de sesión en este link.")
        setEstado("error")

      } catch (err) {
        console.error("Error inesperado en callback:", err)
        setMensajeError("Ocurrió un error inesperado. Por favor intenta de nuevo.")
        setEstado("error")
      }
    }

    completarLogin()
  }, [router])

  // ── UI procesando ─────────────────────────────────────────────────────────
  if (estado === "procesando") {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <style>{`@keyframes spinCb { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            Iniciando sesión...
          </div>
          <div style={{ opacity: 0.55, fontSize: 14, lineHeight: 1.5 }}>
            Estamos verificando tu acceso, un momento.
          </div>
        </div>
      </div>
    )
  }

  // ── UI error ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
          No se pudo iniciar sesión
        </div>
        <div style={{
          fontSize: 14, opacity: 0.65, lineHeight: 1.6,
          marginBottom: 24, maxWidth: 340
        }}>
          {mensajeError}
        </div>
        <button
          onClick={() => router.replace("/login")}
          style={{
            padding: "12px 24px",
            background: "linear-gradient(135deg, #2563eb, #6366f1)",
            color: "white", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: "pointer"
          }}
        >
          Volver al login
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #060d1a 0%, #0f172a 100%)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: 24,
    boxSizing: "border-box"
  },
  card: {
    background: "rgba(17,27,46,0.96)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: "36px 32px",
    textAlign: "center",
    maxWidth: 420,
    width: "100%",
    boxShadow: "0 24px 60px rgba(0,0,0,0.4)"
  },
  spinner: {
    width: 52, height: 52,
    borderRadius: "50%",
    border: "4px solid rgba(255,255,255,0.1)",
    borderTopColor: "#3b82f6",
    margin: "0 auto 20px",
    animation: "spinCb 0.85s linear infinite"
  }
}
