"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ConfigurarIglesiaPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [userId, setUserId] = useState("")
  const [nombreIglesia, setNombreIglesia] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [nombreCorto, setNombreCorto] = useState("")

  useEffect(() => {
    const revisarUsuario = async () => {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.replace("/login")
        return
      }

      setUserId(data.user.id)
      setCargando(false)
    }

    revisarUsuario()
  }, [router])

  const crearIglesia = async () => {
    if (!nombreIglesia.trim()) {
      alert("Ingresa el nombre de la iglesia.")
      return
    }

    if (!userId) {
      alert("No se pudo identificar el usuario actual.")
      return
    }

    try {
      setGuardando(true)

      const nombreFinal = nombreIglesia.trim()
      const nombreVisible = nombreCorto.trim() || nombreFinal

      const { data: iglesia, error: errorIglesia } = await supabase
        .from("iglesias")
        .insert({
          nombre: nombreVisible
        })
        .select()
        .single()

      if (errorIglesia || !iglesia) {
        console.error("Error creando iglesia:", errorIglesia)
        alert("No se pudo crear la iglesia.")
        return
      }

      const { error: errorUsuario } = await supabase
        .from("usuarios_iglesia")
        .insert({
          user_id: userId,
          iglesia_id: iglesia.id
        })

      if (errorUsuario) {
        console.error("Error vinculando usuario:", errorUsuario)
        alert("La iglesia se creó, pero no se pudo vincular tu usuario.")
        return
      }

      router.replace("/")
    } catch (error) {
      console.error("Error configurando iglesia:", error)
      alert("Ocurrió un error al configurar la iglesia.")
    } finally {
      setGuardando(false)
    }
  }

  const card = {
    background: "rgba(15, 23, 42, 0.94)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "24px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)"
  }

  const input = {
    width: "100%",
    padding: "14px 15px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#020617",
    color: "white",
    outline: "none",
    fontSize: "15px",
    boxSizing: "border-box" as const
  }

  const label = {
    fontSize: "13px",
    fontWeight: 800,
    opacity: 0.72,
    marginBottom: "7px"
  }

  const botonPrincipal = {
    width: "100%",
    border: "none",
    borderRadius: "16px",
    padding: "15px 18px",
    background: guardando
      ? "rgba(37,99,235,0.45)"
      : "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    fontWeight: 900,
    fontSize: "16px",
    cursor: guardando ? "not-allowed" : "pointer",
    boxShadow: "0 14px 32px rgba(37,99,235,0.25)"
  }

  if (cargando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          fontWeight: 900
        }}
      >
        Preparando configuración...
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.25), transparent 32%), radial-gradient(circle at bottom right, rgba(34,197,94,0.18), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        padding: "22px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "980px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "18px",
          alignItems: "stretch"
        }}
      >
        <div
          style={{
            ...card,
            padding: "26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "24px"
          }}
        >
          <div>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "22px",
                background: "rgba(37,99,235,0.18)",
                border: "1px solid rgba(37,99,235,0.32)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "38px",
                marginBottom: "18px"
              }}
            >
              ⛪
            </div>

            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                opacity: 0.62,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px"
              }}
            >
              Primera configuración
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(32px, 5vw, 54px)",
                lineHeight: 1
              }}
            >
              Configura tu iglesia
            </h1>

            <p
              style={{
                marginTop: "16px",
                opacity: 0.72,
                lineHeight: 1.55,
                fontSize: "15px"
              }}
            >
              Esta información se usará para identificar tu iglesia dentro del
              sistema y preparar las pantallas de Control, Proyector y Músicos.
            </p>
          </div>

          <div
            style={{
              padding: "14px",
              borderRadius: "18px",
              background: "rgba(34,197,94,0.10)",
              border: "1px solid rgba(34,197,94,0.22)",
              color: "#bbf7d0",
              fontSize: "14px",
              lineHeight: 1.45,
              fontWeight: 700
            }}
          >
            Después podrás subir logo, preparar listas de culto y abrir las
            pantallas de proyección desde el panel principal.
          </div>
        </div>

        <div
          style={{
            ...card,
            padding: "26px"
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            <div>
              <div style={label}>Nombre de la iglesia *</div>
              <input
                style={input}
                value={nombreIglesia}
                onChange={(e) => setNombreIglesia(e.target.value)}
                placeholder="Ej: Iglesia Metodista Pentecostal..."
                autoFocus
              />
            </div>

            <div>
              <div style={label}>Ciudad o localidad</div>
              <input
                style={input}
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ej: La Ligua, Renca, Santiago..."
              />
            </div>

            <div>
              <div style={label}>Nombre corto visible</div>
              <input
                style={input}
                value={nombreCorto}
                onChange={(e) => setNombreCorto(e.target.value)}
                placeholder="Ej: IMP La Ligua"
              />
              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.55,
                  marginTop: "7px",
                  lineHeight: 1.35
                }}
              >
                Si lo dejas vacío, se usará el nombre completo de la iglesia.
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginTop: "4px"
              }}
            >
              <div style={{ fontSize: "13px", opacity: 0.65, fontWeight: 800 }}>
                Vista previa
              </div>

              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 950,
                  marginTop: "6px",
                  wordBreak: "break-word"
                }}
              >
                {nombreCorto.trim() || nombreIglesia.trim() || "Nombre de iglesia"}
              </div>

              {ciudad.trim() && (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "13px",
                    opacity: 0.64
                  }}
                >
                  {ciudad.trim()}
                </div>
              )}
            </div>

            <button
              style={botonPrincipal}
              disabled={guardando}
              onClick={crearIglesia}
            >
              {guardando ? "Guardando..." : "Crear iglesia y continuar"}
            </button>

            <button
              type="button"
              onClick={() => router.replace("/")}
              style={{
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.62)",
                cursor: "pointer",
                fontWeight: 700,
                padding: "8px"
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}