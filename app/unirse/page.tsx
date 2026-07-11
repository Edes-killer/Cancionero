"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { navegarSPA } from "@/lib/navegar"
import { supabase } from "@/lib/supabase"
import { setIglesiaActivaId } from "@/lib/getIglesia"
import { conTimeout } from "@/lib/timeout"

const ROLES: Record<string, { label: string; icon: string; desc: string }> = {
  admin:  { label: "Administrador",     icon: "👑", desc: "Acceso completo a la aplicación" },
  lider:  { label: "Líder de alabanza", icon: "🎛️", desc: "Control del culto y canciones" },
  musico: { label: "Músico",            icon: "🎸", desc: "Vista de acordes en tiempo real" },
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

export default function UnirsePage() {
  const router = useRouter()

  const [codigoInput, setCodigoInput] = useState("")
  const [codigo, setCodigo]           = useState("")
  const [invitacion, setInvitacion]   = useState<any>(null)
  const [iglesia, setIglesia]         = useState<any>(null)
  const [error, setError]             = useState("")
  const [cargando, setCargando]       = useState(false)
  const [buscando, setBuscando]       = useState(false)

  const [email, setEmail]     = useState("")
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // ── Al montar: leer código de URL o localStorage ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cod = params.get("codigo") || localStorage.getItem("selah_inv_codigo") || ""
    if (cod) { setCodigo(cod); cargarInvitacion(cod) }
  }, [])

  const getRedirectUrl = (cod: string) => {
    if (typeof window === "undefined") return "/unirse"
    if ((window as any).Capacitor) return `com.tuiglesia.cancionero://unirse?codigo=${cod}`
    return `${window.location.origin}/unirse?codigo=${cod}`
  }

  const buscarCodigo = async () => {
    const cod = codigoInput.trim().toUpperCase()
    if (!cod) return
    setBuscando(true); setError("")
    setCodigo(cod)
    await cargarInvitacion(cod)
    setBuscando(false)
  }

  const cargarInvitacion = async (cod: string) => {
    setCargando(true); setError("")
    const { data: inv } = await supabase
      .from("invitaciones").select("*")
      .eq("codigo", cod).eq("activa", true).maybeSingle()

    if (!inv) { setError("Código no encontrado o inválido."); setCargando(false); return }
    if (inv.expira_at && new Date(inv.expira_at) < new Date()) {
      setError("Este código ha expirado."); setCargando(false); return
    }
    if (inv.usos_actuales >= inv.usos_max) {
      setError("Este código ya alcanzó el límite de usos."); setCargando(false); return
    }

    const { data: ig } = await supabase.from("iglesias")
      .select("nombre, logo_url").eq("id", inv.iglesia_id).limit(1)
    setInvitacion(inv)
    setIglesia((ig as any[])?.[0] || null)
    localStorage.setItem("selah_inv_codigo", cod)

    // Si ya hay sesión activa → unirse directamente
    const resultado = await conTimeout(supabase.auth.getSession(), 5000)
    if (resultado !== "timeout" && resultado.data.session?.user) {
      await unirseAIglesia(resultado.data.session.user.id, inv); return
    }
    setCargando(false)
  }

  const unirseAIglesia = async (userId: string, inv: any) => {
    const { data: ya } = await supabase.from("usuarios_iglesia")
      .select("id").eq("user_id", userId).eq("iglesia_id", inv.iglesia_id).limit(1)
    if (!ya?.length) {
      await supabase.from("usuarios_iglesia").insert({
        user_id: userId, iglesia_id: inv.iglesia_id, rol: inv.rol
      })
      await supabase.from("invitaciones")
        .update({ usos_actuales: (inv.usos_actuales || 0) + 1 }).eq("id", inv.id)
    }
    // ✅ Si la cuenta ya estaba vinculada a OTRA iglesia (cacheada en este
    // dispositivo), sin esto seguía viendo los datos de la iglesia vieja
    // después de aceptar una invitación nueva — nada actualizaba cuál es
    // la "iglesia activa".
    setIglesiaActivaId(inv.iglesia_id)
    localStorage.removeItem("selah_inv_codigo")
    navegarSPA(router, inv.rol === "musico" ? "/musicos" : inv.rol === "lider" ? "/control" : "/", { replace: true })
  }

  // ── Google OAuth — redirige de vuelta al /unirse?codigo=X ─────────────────
  const loginGoogle = async () => {
    setError(""); setEnviando(true)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectUrl(codigo),
        // ✅ Fuerza el selector de cuentas de Google -- ver login/page.tsx
        queryParams: { prompt: "select_account" }
      }
    })
    setEnviando(false)
  }

  // ── Magic link — mismo patrón que el login ────────────────────────────────
  const loginEmail = async () => {
    if (!email.trim() || !email.includes("@")) { setError("Ingresa un correo válido."); return }
    setError(""); setEnviando(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getRedirectUrl(codigo) }
    })
    setEnviando(false)
    if (err) { setError(err.message); return }
    setEnviado(true)
  }

  // ── Estilos (mismo tono que el login) ─────────────────────────────────────
  const f: React.CSSProperties   = { fontFamily: "'Segoe UI', system-ui, sans-serif" }
  const inp: React.CSSProperties = { width: "100%", padding: "13px 14px", background: "#0a1525", color: "white", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 16, outline: "none", boxSizing: "border-box" }
  const root: React.CSSProperties = { ...f, minHeight: "100dvh", background: "#060d1a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }

  // ── 1. Spinner ────────────────────────────────────────────────────────────
  if (cargando) return (
    <div style={root}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.08)", borderTopColor: "#3b82f6", margin: "0 auto 14px", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ opacity: 0.4 }}>Verificando código...</div>
      </div>
    </div>
  )

  // ── 2. Sin código: input manual ───────────────────────────────────────────
  if (!invitacion) return (
    <div style={root}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🔑</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Únete a una iglesia</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
            Ingresa el código que te compartió el administrador
          </div>
        </div>
        <input
          value={codigoInput}
          onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setError("") }}
          onKeyDown={e => e.key === "Enter" && buscarCodigo()}
          placeholder="Ej: ABC123"
          maxLength={8}
          style={{ ...inp, fontSize: 24, fontWeight: 800, letterSpacing: 8, textAlign: "center", fontFamily: "monospace", marginBottom: 12 }}
        />
        {error && <div style={{ fontSize: 13, color: "#fca5a5", padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
        <button onClick={buscarCodigo} disabled={buscando || !codigoInput.trim()}
          style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: (buscando || !codigoInput.trim()) ? 0.5 : 1 }}>
          {buscando ? "Buscando..." : "Continuar →"}
        </button>
        <button onClick={() => navegarSPA(router, "/login")}
          style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer" }}>
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )

  // ── 3. Magic link enviado ─────────────────────────────────────────────────
  if (enviado) return (
    <div style={root}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Revisa tu correo</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24 }}>
          Enviamos un link a <strong style={{ color: "#93c5fd" }}>{email}</strong>.<br/>
          Haz clic en él para unirte a <strong>{iglesia?.nombre}</strong>.
        </div>
        <button onClick={() => setEnviado(false)}
          style={{ padding: "11px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          ← Volver
        </button>
      </div>
    </div>
  )

  // ── 4. Con código válido: elegir método de ingreso ────────────────────────
  const rol = ROLES[invitacion.rol] || ROLES.musico
  return (
    <div style={root}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Iglesia + rol */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {iglesia?.logo_url ? (
            <img src={iglesia.logo_url} alt="" style={{ width: 68, height: 68, borderRadius: 18, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", margin: "0 auto 14px", display: "block" }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 14 }}>⛪</div>
          )}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Has sido invitado a</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{iglesia?.nombre || "Una iglesia"}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 16px", borderRadius: 20, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
            <span style={{ fontSize: 18 }}>{rol.icon}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#93c5fd" }}>{rol.label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{rol.desc}</div>
            </div>
          </div>
        </div>

        {/* Card auth */}
        <div style={{ background: "rgba(17,27,46,0.96)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "24px", backdropFilter: "blur(12px)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: "rgba(255,255,255,0.7)" }}>
            Ingresa para unirte
          </div>

          {/* Google */}
          <button onClick={loginGoogle} disabled={enviando}
            style={{ width: "100%", padding: "13px 16px", background: "white", color: "#1a1a2e", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: enviando ? 0.6 : 1 }}>
            <GoogleIcon />
            Continuar con Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>o</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Magic link */}
          <input
            type="email" placeholder="tu@correo.com"
            value={email} onChange={e => { setEmail(e.target.value); setError("") }}
            onKeyDown={e => e.key === "Enter" && loginEmail()}
            style={{ ...inp, marginBottom: 10 }}
            inputMode="email" autoComplete="email"
          />
          {error && <div style={{ fontSize: 13, color: "#fca5a5", padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8, marginBottom: 10 }}>{error}</div>}
          <button onClick={loginEmail} disabled={enviando || !email.trim()}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: (enviando || !email.trim()) ? 0.55 : 1 }}>
            {enviando ? "Enviando..." : "Enviar link de acceso"}
          </button>
          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.35, textAlign: "center", lineHeight: 1.5 }}>
            Te enviaremos un link sin contraseña. Solo haz clic para entrar.
          </p>
        </div>

        <button onClick={() => { setInvitacion(null); setIglesia(null); setCodigo(""); setCodigoInput("") }}
          style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer" }}>
          Usar otro código
        </button>
      </div>
    </div>
  )
}
