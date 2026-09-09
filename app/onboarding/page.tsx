"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { navegarSPA } from "@/lib/navegar"
import { supabase } from "@/lib/supabase"
import { setIglesiaActivaId } from "@/lib/getIglesia"
import { conTimeout } from "@/lib/timeout"
import { logCatch } from "@/lib/Errorlogger"

const STEPS = ["bienvenida", "iglesia", "logo", "tour"] as const
type Step = typeof STEPS[number]

const FEATURES = [
  { icon: "📱", titulo: "Control desde el celular", desc: "Maneja la proyección desde tu teléfono por WiFi, sin cables" },
  { icon: "🎥", titulo: "Transmisión en vivo", desc: "Saca el culto al aire a Facebook y YouTube — hasta con la cámara de tu celular" },
  { icon: "🎵", titulo: "Cancionero e himnos", desc: "Himnos, acordes y tonos listos para proyectar desde el primer día" },
  { icon: "🎸", titulo: "Vista músicos", desc: "Acordes en notación latina, transposición y modo improvisación" },
]

const PRIMER_CULTO = [
  { n:"1", titulo:"Abre el proyector", desc:"Conecta el segundo monitor y confirma que la salida aparezca completa." },
  { n:"2", titulo:"Prepara el orden", desc:"Agrega canciones, Biblia, imágenes y pantallas de espera a la lista." },
  { n:"3", titulo:"Revisa antes de comenzar", desc:"Usa “Revisar culto” para comprobar conexión, proyector y contenido." },
]

const NOMBRES_PASOS = ["Bienvenida", "Iglesia", "Identidad", "Primer culto"]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("bienvenida")
  const [nombre, setNombre] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [iglesiaId, setIglesiaId] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [logoError, setLogoError] = useState("")

  const stepIdx = STEPS.indexOf(step)

  const crearIglesia = async () => {
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return }
    setGuardando(true)
    setError("")
    try {
      const resultado = await conTimeout(supabase.auth.getUser(), 5000)
      if (resultado === "timeout") throw new Error("Sin conexión — intenta de nuevo")
      const { data: { user } } = resultado
      if (!user) { navegarSPA(router, "/login", { replace: true }); return }

      const { data: nuevaIglesiaId, error: errIglesia } = await supabase.rpc("crear_iglesia_segura", {
        p_nombre: nombre.trim(), p_localidad: localidad.trim() || null
      })
      if (errIglesia || !nuevaIglesiaId) throw new Error(errIglesia?.message || "No se pudo crear la iglesia")

      setIglesiaActivaId(nuevaIglesiaId)
      setIglesiaId(nuevaIglesiaId)
      setStep("logo")
    } catch (e: any) {
      setError(e.message || "Error al crear la iglesia")
      logCatch(e, "No se pudo completar la creación de la iglesia", { tipo:"autenticacion", pagina:"/onboarding" })
    } finally {
      setGuardando(false)
    }
  }

  const subirLogo = async () => {
    if (!logoFile || !iglesiaId) return
    setSubiendoLogo(true)
    setLogoError("")
    try {
      const ext = logoFile.name.split(".").pop()
      const path = `logos/${iglesiaId}/${Date.now()}.${ext}`
      const { error: errUp } = await supabase.storage.from("imagenes-culto").upload(path, logoFile, { upsert: false })
      if (errUp) throw errUp
      const { data: { publicUrl } } = supabase.storage.from("imagenes-culto").getPublicUrl(path)
      const { error: errGuardar } = await supabase.from("iglesias").update({ logo_url: publicUrl, logo_nombre: logoFile.name }).eq("id", iglesiaId)
      if (errGuardar) throw errGuardar
      setStep("tour")
    } catch (e) {
      setLogoError("No pudimos guardar el logo. Puedes intentarlo otra vez o saltar este paso.")
      logCatch(e, "No se pudo guardar el logo del onboarding", { tipo:"imagen", pagina:"/onboarding", detalle:{ nombre:logoFile.name, tipo:logoFile.type, bytes:logoFile.size } })
    } finally { setSubiendoLogo(false) }
  }

  const s: React.CSSProperties = {
    minHeight: "100vh", background: "linear-gradient(180deg, #060d1a 0%, #0f172a 100%)",
    color: "white", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "24px 16px",
    fontFamily: "'Segoe UI', system-ui, sans-serif"
  }

  return (
    <div style={s}>
      {/* Logo Selah Live */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, position: "relative", flexShrink: 0
        }}>
          <div style={{ width: 8, height: 24, borderRadius: 4, background: "white" }} />
          <div style={{ width: 8, height: 24, borderRadius: 4, background: "white" }} />
          <div style={{ position: "absolute", top: 6, right: 6, width: 12, height: 12, borderRadius: "50%", background: "#22c55e", border: "2px solid white" }} />
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em" }}>
            Selah <span style={{ color: "#3b82f6", fontWeight: 300 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>Proyección para iglesias</div>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div aria-label={`Paso ${stepIdx + 1} de ${STEPS.length}: ${NOMBRES_PASOS[stepIdx]}`} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            width: i === stepIdx ? 24 : 8, height: 8, borderRadius: 4,
            background: i <= stepIdx ? "#3b82f6" : "rgba(255,255,255,0.15)",
            transition: "all 0.3s"
          }} />
        ))}
      </div>
      <div style={{ fontSize:11.5, color:"rgba(255,255,255,.48)", marginBottom:20 }}>Paso {stepIdx + 1} de {STEPS.length} · {NOMBRES_PASOS[stepIdx]}</div>

      {/* Card */}
      <div style={{
        background: "rgba(17,27,46,0.95)", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 32, width: "100%", maxWidth: 520, maxHeight:"calc(100vh - 190px)", overflowY:"auto", boxSizing:"border-box",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)"
      }}>

        {/* PASO 1: BIENVENIDA */}
        {step === "bienvenida" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎶</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>¡Bienvenido a Selah Live!</h1>
            <p style={{ fontSize: 15, opacity: 0.6, lineHeight: 1.6, margin: "0 0 32px" }}>
              Configuremos la identidad de tu iglesia y dejemos preparado el camino para tu primer culto.
            </p>
            <button onClick={() => setStep("iglesia")} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #2563eb, #6366f1)",
              color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer"
            }}>Comenzar →</button>
          </div>
        )}

        {/* PASO 2: CREAR IGLESIA */}
        {step === "iglesia" && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>⛪ Tu iglesia</h2>
            <p style={{ fontSize: 14, opacity: 0.5, margin: "0 0 24px" }}>
              Ingresa el nombre de tu congregación
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                placeholder="Nombre de la iglesia *"
                value={nombre}
                onChange={e => { setNombre(e.target.value); setError("") }}
                autoFocus
                style={{
                  padding: "12px 14px", borderRadius: 10, fontSize: 15,
                  background: "rgba(255,255,255,0.06)", border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: "white", outline: "none"
                }}
              />
              <input
                placeholder="Ciudad / Localidad (opcional)"
                value={localidad}
                onChange={e => setLocalidad(e.target.value)}
                style={{
                  padding: "12px 14px", borderRadius: 10, fontSize: 15,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "white", outline: "none"
                }}
              />
              {error && <div style={{ fontSize: 13, color: "#fca5a5" }}>⚠️ {error}</div>}
              <button onClick={crearIglesia} disabled={guardando || !nombre.trim()} style={{
                padding: "14px", borderRadius: 12, border: "none",
                background: nombre.trim() ? "linear-gradient(135deg, #2563eb, #6366f1)" : "rgba(255,255,255,0.06)",
                color: "white", fontWeight: 800, fontSize: 15,
                cursor: nombre.trim() ? "pointer" : "not-allowed", opacity: guardando ? 0.7 : 1
              }}>
                {guardando ? "Creando..." : "Continuar →"}
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: LOGO */}
        {step === "logo" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>🖼️ Logo de tu iglesia</h2>
            <p style={{ fontSize: 14, opacity: 0.5, margin: "0 0 24px" }}>
              Se mostrará en la proyección y en tus diseños de transmisión. Recomendamos PNG con fondo transparente.
            </p>
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              padding: "32px", border: "2px dashed rgba(255,255,255,0.15)", borderRadius: 14,
              cursor: "pointer", marginBottom: 20,
              background: logoPreview ? "transparent" : "rgba(255,255,255,0.02)"
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="" style={{ maxHeight: 120, maxWidth: "100%", objectFit: "contain", borderRadius: 8 }} />
              ) : (
                <>
                  <div style={{ fontSize: 40 }}>📷</div>
                  <div style={{ fontSize: 14, opacity: 0.6 }}>Toca para seleccionar una imagen</div>
                </>
              )}
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => {
                  const input = e.target
                  const file = input.files?.[0]
                  if (!file) return
                  setLogoError("")
                  const ext = (file.name.split(".").pop() || "").toLowerCase()
                  if (!["png","jpg","jpeg","webp","gif","avif","svg"].includes(ext) || !file.type.startsWith("image/")) {
                    setLogoError("Formato no compatible. Usa PNG, JPG, WEBP, GIF, AVIF o SVG.")
                    input.value = ""
                    return
                  }
                  if (file.size > 10 * 1024 * 1024) {
                    setLogoError("El archivo supera 10 MB. Usa una imagen más liviana.")
                    input.value = ""
                    return
                  }
                  if (logoPreview) URL.revokeObjectURL(logoPreview)
                  setLogoFile(file)
                  setLogoPreview(URL.createObjectURL(file))
                }} />
            </label>
            {logoError && <div role="alert" style={{ margin:"-8px 0 16px", padding:"9px 11px", borderRadius:9, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", color:"#fca5a5", fontSize:12.5, lineHeight:1.4 }}>⚠️ {logoError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {logoFile && (
                <button onClick={subirLogo} disabled={subiendoLogo} style={{
                  padding: "13px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #2563eb, #6366f1)",
                  color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer",
                  opacity: subiendoLogo ? 0.7 : 1
                }}>{subiendoLogo ? "Subiendo..." : "Guardar logo →"}</button>
              )}
              <button onClick={() => setStep("tour")} style={{
                padding: "12px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "rgba(255,255,255,0.5)",
                fontSize: 14, cursor: "pointer"
              }}>Saltar por ahora</button>
            </div>
          </div>
        )}

        {/* PASO 4: TOUR */}
        {step === "tour" && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>✅ ¡Todo listo!</h2>
            <p style={{ fontSize: 14, opacity: 0.55, margin: "0 0 18px", lineHeight:1.5 }}>
              Sigue este flujo el día del culto. Dentro de Control encontrarás una guía paso a paso.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
              {PRIMER_CULTO.map(p => (
                <div key={p.n} style={{
                  display: "flex", gap: 14, alignItems: "flex-start",
                  padding: "12px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)"
                }}>
                  <div style={{ width:27, height:27, borderRadius:99, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(37,99,235,.2)", border:"1px solid rgba(96,165,250,.35)", color:"#bfdbfe", fontSize:12, fontWeight:900 }}>{p.n}</div>
                  <div>
                    <div style={{ fontWeight: 750, fontSize: 13.5, marginBottom: 2 }}>{p.titulo}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.55, lineHeight: 1.4 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
              {FEATURES.map(f => <span key={f.titulo} data-ayuda={f.desc} style={{ padding:"5px 8px", borderRadius:99, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", color:"rgba(255,255,255,.6)", fontSize:10.5 }}>{f.icon} {f.titulo}</span>)}
            </div>
            <button onClick={() => {
              localStorage.setItem("selah-onboarding-ok", "1")
              navegarSPA(router, "/control", { replace: true })
            }} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #2563eb, #6366f1)",
              color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer"
            }}>🎛️ Ir al Control →</button>
          </div>
        )}
      </div>

      {/* Skip completo */}
      {step !== "bienvenida" && step !== "tour" && (
        <button onClick={() => {
          localStorage.setItem("selah-onboarding-ok", "1")
          navegarSPA(router, "/", { replace: true })
        }} style={{
          marginTop: 20, background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer"
        }}>Saltar configuración</button>
      )}
    </div>
  )
}
