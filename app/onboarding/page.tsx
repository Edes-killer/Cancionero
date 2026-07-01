"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { setIglesiaActivaId } from "@/lib/getIglesia"

const STEPS = ["bienvenida", "iglesia", "logo", "tour"] as const
type Step = typeof STEPS[number]

const FEATURES = [
  { icon: "📱", titulo: "Control desde el celular", desc: "Maneja la proyección desde tu teléfono vía WiFi sin cables" },
  { icon: "🎵", titulo: "1000 himnos incluidos", desc: "Cancionero completo listo para usar desde el primer día" },
  { icon: "🎸", titulo: "Vista músicos", desc: "Acordes en notación latina y transposición en tiempo real" },
]

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

  const stepIdx = STEPS.indexOf(step)

  const crearIglesia = async () => {
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return }
    setGuardando(true)
    setError("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }

      // Crear iglesia
      const { data: iglesia, error: errIglesia } = await supabase
        .from("iglesias")
        .insert({ nombre: nombre.trim(), localidad: localidad.trim() })
        .select().single()
      if (errIglesia || !iglesia) throw new Error("No se pudo crear la iglesia")

      // Vincular usuario
      await supabase.from("usuarios_iglesia").insert({
        user_id: user.id, iglesia_id: iglesia.id
      })

      await setIglesiaActivaId(iglesia.id)
      setIglesiaId(iglesia.id)
      setStep("logo")
    } catch (e: any) {
      setError(e.message || "Error al crear la iglesia")
    } finally {
      setGuardando(false)
    }
  }

  const subirLogo = async () => {
    if (!logoFile || !iglesiaId) return
    setSubiendoLogo(true)
    try {
      const ext = logoFile.name.split(".").pop()
      const path = `logos/${iglesiaId}.${ext}`
      const { error: errUp } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true })
      if (errUp) throw errUp
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path)
      await supabase.from("iglesias").update({ logo_url: publicUrl, logo_nombre: logoFile.name }).eq("id", iglesiaId)
    } catch (e) { console.error("Error subiendo logo:", e) }
    finally { setSubiendoLogo(false) }
    setStep("tour")
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
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            width: i === stepIdx ? 24 : 8, height: 8, borderRadius: 4,
            background: i <= stepIdx ? "#3b82f6" : "rgba(255,255,255,0.15)",
            transition: "all 0.3s"
          }} />
        ))}
      </div>

      {/* Card */}
      <div style={{
        background: "rgba(17,27,46,0.95)", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 32, width: "100%", maxWidth: 460,
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)"
      }}>

        {/* PASO 1: BIENVENIDA */}
        {step === "bienvenida" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎶</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>¡Bienvenido a Selah Live!</h1>
            <p style={{ fontSize: 15, opacity: 0.6, lineHeight: 1.6, margin: "0 0 32px" }}>
              Tu sistema de proyección para cultos. En 3 pasos rápidos configuramos todo para que empieces a usar la app hoy.
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
              Se mostrará en la pantalla de espera del proyector
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
                  const file = e.target.files?.[0]
                  if (!file) return
                  setLogoFile(file)
                  setLogoPreview(URL.createObjectURL(file))
                }} />
            </label>
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
            <p style={{ fontSize: 14, opacity: 0.5, margin: "0 0 20px" }}>
              Antes de empezar, conoce las 3 funciones principales
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {FEATURES.map(f => (
                <div key={f.titulo} style={{
                  display: "flex", gap: 14, alignItems: "flex-start",
                  padding: "14px 16px", borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)"
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{f.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.titulo}</div>
                    <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => {
              localStorage.setItem("selah-onboarding-ok", "1")
              router.replace("/control")
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
          router.replace("/")
        }} style={{
          marginTop: 20, background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer"
        }}>Saltar configuración</button>
      )}
    </div>
  )
}
