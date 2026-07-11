"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { navegarSPA } from "@/lib/navegar"
import { conTimeout } from "@/lib/timeout"

export default function CallbackPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<"procesando" | "error">("procesando")
  const [mensajeError, setMensajeError] = useState("")

  
useEffect(() => {
  let activo = true

  const completarLogin = async (hash: string) => {
    try {
      if (!hash.includes('access_token')) return
      const params = new URLSearchParams(hash.replace('#', ''))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) { setEstado('error'); setMensajeError('Link inválido.'); return }
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) { setEstado('error'); setMensajeError('No se pudo iniciar sesión.'); return }
      navegarSPA(router, '/', { replace: true })
    } catch { setEstado('error'); setMensajeError('Error inesperado.') }
  }

  const revisar = async () => {
    // Web normal
    if (window.location.hash.includes('access_token')) {
      await completarLogin(window.location.hash)
      return
    }

    // APK — leer URL guardada por DeepLinkHandler
    const deepLinkUrl = sessionStorage.getItem('deepLinkUrl')
    if (deepLinkUrl) {
      sessionStorage.removeItem('deepLinkUrl')
      const hash = deepLinkUrl.includes('#') ? '#' + deepLinkUrl.split('#')[1] : ''
      await completarLogin(hash)
      return
    }

    // ✅ Con detectSessionInUrl:true (lib/supabase.ts), el propio cliente de
    // Supabase puede procesar el #access_token y limpiar el hash de la URL
    // ANTES de que este efecto llegue a revisarlo — si eso ya pasó, la
    // sesión ya existe aunque no haya token en la URL. Sin este chequeo la
    // pantalla se queda en "Iniciando sesión..." para siempre.
    const resultado = await conTimeout(supabase.auth.getSession(), 5000)
    if (!activo) return
    if (resultado !== "timeout" && resultado.data.session) {
      navegarSPA(router, '/', { replace: true })
    } else {
      setEstado('error')
      setMensajeError(resultado === "timeout" ? 'Sin conexión — intenta de nuevo.' : 'No se pudo iniciar sesión.')
    }
  }

  revisar()
  return () => { activo = false }
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
          onClick={() => navegarSPA(router, "/login", { replace: true })}
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
