"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Suspense } from "react"

function LoginContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [isApk, setIsApk] = useState(false)

  useEffect(() => {
    setIsApk(!!(window as any).Capacitor)
    const err = searchParams.get("error")
    if (err === "no_token")   setError("El link de acceso no es válido.")
    if (err === "no_session") setError("No se pudo leer la sesión del link.")
    if (err === "session")    setError("El link expiró o ya fue usado. Solicita uno nuevo.")
  }, [searchParams])

  // ── Diagnóstico + manejo de callback en Capacitor ─────────────────────────
  useEffect(() => {
    if (!(window as any).Capacitor) return
    console.log('[Login] ✅ Capacitor detectado')
    import('@capacitor/app').then(({ App }) => {

      // ✅ appUrlOpen llega con el token completo → procesarlo aquí directamente
      App.addListener('appUrlOpen', async ({ url }) => {
        console.log('[Login] 🔗 appUrlOpen recibido')
        if (!url.includes('access_token')) return

        const hash   = url.includes('#') ? url.split('#')[1] : ''
        const query  = url.includes('?') ? url.split('?')[1]?.split('#')[0] : ''
        const hP     = new URLSearchParams(hash)
        const qP     = new URLSearchParams(query)
        const access_token  = hP.get('access_token')  || qP.get('access_token')
        const refresh_token = hP.get('refresh_token') || qP.get('refresh_token')

        if (!access_token || !refresh_token) {
          console.log('[Login] Sin tokens en URL')
          return
        }

        console.log('[Login] Llamando setSession...')
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) {
          console.error('[Login] Error setSession:', error.message)
          setCargando(false)
        } else {
          console.log('[Login] ✅ Sesión OK → navegando a /')
          window.location.href = '/'
        }
      })

      App.addListener('appStateChange', async ({ isActive }) => {
        console.log('[Login] 📱 appStateChange:', isActive)
        if (!isActive) return
        await new Promise(r => setTimeout(r, 1500))
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[Login] sesión después de volver:', !!session)
        if (session) window.location.href = '/'
        else setCargando(false)
      })

      App.getLaunchUrl().then(r => {
        console.log('[Login] 🚀 launchUrl:', r?.url || 'null')
      }).catch(() => {})
    }).catch(e => console.error('[Login] error importando App:', e))
  }, [])

  const getRedirectUrl = () => {
    if (typeof window === "undefined") return "/auth/callback"
    if (!!(window as any).Capacitor) return "com.tuiglesia.cancionero://auth/callback"
    return `${window.location.origin}/auth/callback`
  }

  const loginGoogle = async () => {
    setError(""); setCargando(true)
    const isCapacitor = !!(window as any).Capacitor
    const isElectron  = navigator.userAgent.includes("Electron")
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getRedirectUrl(),
          // ✅ skipBrowserRedirect solo en APK — en Electron y web manejamos la redirección nosotros
          skipBrowserRedirect: isCapacitor
        }
      })
      if (error) throw error
      if (!data?.url) throw new Error("Sin URL de OAuth")

      if (isCapacitor) {
        // APK: abrir browser del sistema → DeepLinkHandler captura el callback
        console.log('[Login] APK → _system')
        window.open(data.url, '_system')
      } else if (isElectron) {
        // Electron: navegar la misma ventana → Supabase redirige a localhost:3000/auth/callback
        console.log('[Login] Electron → window.location.href')
        window.location.href = data.url
      } else {
        // Web: ídem
        window.location.href = data.url
      }
    } catch (e: any) {
      setError(e?.message || "Error al iniciar sesión")
      setCargando(false)
    }
  }

  const loginEmail = async () => {
    if (!email.trim()) { setError("Ingresa tu correo electrónico"); return }
    if (!email.includes("@")) { setError("El correo no parece válido"); return }
    setError(""); setCargando(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getRedirectUrl() }
    })
    setCargando(false)
    if (error) { setError(error.message); return }
    setEnviado(true)
  }

  if (enviado) return (
    <div style={s.root}>
      <Glow />
      <div style={{ ...s.card, maxWidth: 400, textAlign: "center", padding: "40px 28px" }}>
        <div style={s.logoIcon}><div style={s.logoBarra}/><div style={s.logoBarra}/><div style={s.logoPoint}/></div>
        <div style={{ fontSize: 40, margin: "24px 0 12px" }}>📬</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>Revisa tu correo</h2>
        <p style={{ opacity: 0.6, lineHeight: 1.65, fontSize: 14, margin: "0 0 10px" }}>
          Enviamos un link mágico a <strong style={{ color: "#93c5fd" }}>{email}</strong>.
        </p>
        {isApk && <p style={{ opacity: 0.4, fontSize: 12, margin: "0 0 24px", lineHeight: 1.5, padding: "10px 14px", background: "rgba(59,130,246,0.08)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.15)" }}>
          💡 Al hacer clic en el link del correo, la app se abrirá automáticamente
        </p>}
        <p style={{ opacity: 0.4, fontSize: 12, margin: "0 0 20px" }}>¿No llegó? Revisa spam.</p>
        <button onClick={() => { setEnviado(false); setEmail(""); setError("") }} style={s.btnSecondary}>← Volver</button>
      </div>
    </div>
  )

  return (
    <div style={s.root}>
      <Glow />
      <div style={s.wrapper}>
        <div style={{ textAlign: "center" }}>
          <div style={s.logoWrap}>
            <div style={s.logoIcon}><div style={s.logoBarra}/><div style={s.logoBarra}/><div style={s.logoPoint}/></div>
          </div>
          <h1 style={{ margin: "16px 0 4px", fontSize: "clamp(26px,5vw,34px)", fontWeight: 900, letterSpacing: "-0.03em" }}>
            Selah <span style={{ fontWeight: 300, color: "#3b82f6", letterSpacing: "0.05em", fontSize: "0.75em" }}>LIVE</span>
          </h1>
          <p style={{ opacity: 0.4, fontSize: 13, margin: 0 }}>Proyección para iglesias</p>
        </div>
        <div style={{ ...s.card, width: "100%" }}>
          <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 800 }}>Iniciar sesión</h2>
          <p style={{ margin: "0 0 22px", opacity: 0.45, fontSize: 13 }}>Bienvenido de vuelta</p>
          <button onClick={loginGoogle} disabled={cargando} style={{ ...s.btnGoogle, opacity: cargando ? 0.6 : 1, cursor: cargando ? "not-allowed" : "pointer" }}>
            <GoogleIcon />
            {cargando ? "Abriendo..." : "Continuar con Google"}
          </button>
          <div style={s.divider}><div style={s.dividerLine}/><span style={s.dividerText}>o</span><div style={s.dividerLine}/></div>
          <div style={{ marginBottom: 12 }}>
            <label style={s.label}>Correo electrónico</label>
            <input type="email" placeholder="tu@correo.com" value={email}
              onChange={e => { setEmail(e.target.value); setError("") }}
              onKeyDown={e => e.key === "Enter" && loginEmail()}
              disabled={cargando} style={s.input} autoComplete="email" inputMode="email" />
          </div>
          {error && <div style={s.errorBox}>⚠️ {error}</div>}
          <button onClick={loginEmail} disabled={cargando || !email.trim()}
            style={{ ...s.btnPrimary, opacity: cargando || !email.trim() ? 0.55 : 1, cursor: cargando || !email.trim() ? "not-allowed" : "pointer" }}>
            {cargando ? "Enviando..." : "Enviar link de acceso"}
          </button>
          <p style={{ margin: "14px 0 0", fontSize: 12, opacity: 0.38, textAlign: "center", lineHeight: 1.5 }}>
            {isApk ? "Recibirás un link en tu correo. Al hacer clic, la app se abrirá automáticamente."
                   : "Te enviaremos un link sin contraseña. Solo haz clic para entrar."}
          </p>
        </div>
        <p style={{ fontSize: 11, opacity: 0.2, textAlign: "center", margin: 0 }}>Selah Live · Proyección para iglesias</p>
      </div>
    </div>
  )
}

const Glow = () => (<>
  <div style={{ position:"absolute",top:-150,left:-150,width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.13) 0%,transparent 70%)",pointerEvents:"none"}}/>
  <div style={{ position:"absolute",bottom:-100,right:-100,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.10) 0%,transparent 70%)",pointerEvents:"none"}}/>
</>)

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

const s: Record<string, React.CSSProperties> = {
  root:{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"#060d1a",color:"white",fontFamily:"'Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden",padding:"20px 16px",boxSizing:"border-box"},
  wrapper:{display:"flex",flexDirection:"column",alignItems:"center",gap:24,width:"100%",maxWidth:400,position:"relative",zIndex:1},
  logoWrap:{display:"flex",justifyContent:"center"},
  logoIcon:{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#3b82f6,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",gap:10,position:"relative"},
  logoBarra:{width:12,height:36,borderRadius:6,background:"white"},
  logoPoint:{position:"absolute",top:10,right:10,width:14,height:14,borderRadius:"50%",background:"#22c55e",border:"3px solid white"},
  card:{background:"rgba(17,27,46,0.96)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"26px 24px 22px",backdropFilter:"blur(12px)",boxShadow:"0 24px 60px rgba(0,0,0,0.4)"},
  label:{display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,color:"rgba(240,244,255,0.45)",marginBottom:7},
  input:{width:"100%",padding:"13px 14px",background:"#0a1525",color:"white",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,fontSize:16,outline:"none",boxSizing:"border-box" as const},
  errorBox:{background:"rgba(239,68,68,0.10)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fca5a5",marginBottom:12,lineHeight:1.5},
  btnGoogle:{width:"100%",padding:"13px 16px",background:"white",color:"#1a1a2e",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10},
  btnPrimary:{width:"100%",padding:"13px 16px",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:700,boxShadow:"0 8px 24px rgba(59,130,246,0.22)"},
  btnSecondary:{padding:"11px 22px",background:"rgba(255,255,255,0.07)",color:"white",border:"1px solid rgba(255,255,255,0.10)",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"},
  divider:{display:"flex",alignItems:"center",gap:12,margin:"18px 0"},
  dividerLine:{flex:1,height:1,background:"rgba(255,255,255,0.07)"},
  dividerText:{fontSize:12,color:"rgba(255,255,255,0.28)",fontWeight:600}
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100dvh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:48,height:48,borderRadius:"50%",border:"4px solid rgba(255,255,255,0.1)",borderTopColor:"#3b82f6",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <LoginContent/>
    </Suspense>
  )
}
