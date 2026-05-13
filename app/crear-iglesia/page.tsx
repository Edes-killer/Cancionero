"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { setIglesiaActivaId } from "@/lib/getIglesia"

export default function CrearIglesiaPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [userId, setUserId] = useState("")
  const [nombreIglesia, setNombreIglesia] = useState("")
  const [nombreCorto, setNombreCorto] = useState("")
  const [localidad, setLocalidad] = useState("")

  useEffect(() => {
    const revisarUsuario = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
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

      const nombreFinal = nombreCorto.trim() || nombreIglesia.trim()

      const { data: iglesia, error: errorIglesia } = await supabase
        .from("iglesias")
        .insert({
          nombre: nombreFinal,
          localidad: localidad.trim() || null
        })
        .select()
        .single()

      if (errorIglesia || !iglesia) {
        console.error("Error creando iglesia:", errorIglesia)
        alert("No se pudo crear la iglesia.")
        return
      }

      const { error: errorRelacion } = await supabase
        .from("usuarios_iglesia")
        .insert({
          user_id: userId,
          iglesia_id: iglesia.id
        })

      if (errorRelacion) {
        console.error("Error vinculando usuario a iglesia:", errorRelacion)
        alert("La iglesia se creó, pero no se pudo vincular al usuario.")
        return
      }

      setIglesiaActivaId(iglesia.id)

      router.replace("/")
      router.refresh()
    } catch (error) {
      console.error("Error creando iglesia:", error)
      alert("Ocurrió un error al crear la iglesia.")
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

  const botonSecundario = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "16px",
    padding: "14px 18px",
    background: "rgba(30,41,59,0.88)",
    color: "white",
    fontWeight: 800,
    fontSize: "15px",
    cursor: "pointer"
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

  const nombrePreview =
    nombreCorto.trim() || nombreIglesia.trim() || "Nombre de la iglesia"

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.25), transparent 32%), radial-gradient(circle at bottom right, rgba(34,197,94,0.16), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
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
          maxWidth: "1080px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "18px",
          alignItems: "stretch"
        }}
      >
        <div
          style={{
            ...card,
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "24px"
          }}
        >
          <div>
            <div
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "24px",
                background: "rgba(37,99,235,0.18)",
                border: "1px solid rgba(37,99,235,0.32)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                marginBottom: "20px"
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
              Configuración inicial
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(34px, 5vw, 56px)",
                lineHeight: 1
              }}
            >
              Crea tu iglesia
            </h1>

            <p
              style={{
                marginTop: "16px",
                opacity: 0.72,
                lineHeight: 1.55,
                fontSize: "15px",
                maxWidth: "520px"
              }}
            >
              Esta iglesia será usada para tus listas de culto, logo,
              estadísticas, canciones propias y configuración de proyección.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px"
            }}
          >
            {[
              "Control para operar el culto",
              "Proyector para la congregación",
              "Pantalla de músicos con acordes",
              "Listas y estadísticas por iglesia"
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "14px",
                  fontWeight: 700,
                  opacity: 0.9
                }}
              >
                <span
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "999px",
                    background: "rgba(34,197,94,0.16)",
                    color: "#bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 950,
                    flexShrink: 0
                  }}
                >
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            ...card,
            padding: "28px"
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
                placeholder="Ej: Iglesia Evangelica Pentecostal de..."
                autoFocus
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
                Este nombre se verá en el dashboard y puede usarse en pantallas.
              </div>
            </div>

            <div>
              <div style={label}>Localidad o ciudad</div>
              <input
                style={input}
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="Ej: La Ligua, Renca, Santiago..."
              />
              <div
                style={{
                  fontSize: "12px",
                  opacity: 0.55,
                  marginTop: "7px",
                  lineHeight: 1.35
                }}
              >
                Por ahora se usa solo como referencia visual. Después podemos
                guardarla como columna si lo necesitas.
              </div>
            </div>

            <div
              style={{
                marginTop: "4px",
                padding: "16px",
                borderRadius: "18px",
                background:
                  "radial-gradient(circle at top left, rgba(34,197,94,0.14), transparent 36%), rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)"
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  opacity: 0.65,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase"
                }}
              >
                Vista previa
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "12px"
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "18px",
                    background: "rgba(37,99,235,0.18)",
                    border: "1px solid rgba(37,99,235,0.30)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    flexShrink: 0
                  }}
                >
                  ⛪
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 950,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                    title={nombrePreview}
                  >
                    {nombrePreview}
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "13px",
                      opacity: 0.65,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {localidad.trim() || "Localidad no indicada"}
                  </div>
                </div>
              </div>
            </div>

            <button
              style={botonPrincipal}
              disabled={guardando}
              onClick={crearIglesia}
            >
              {guardando ? "Creando iglesia..." : "Crear iglesia y continuar"}
            </button>

            <button
              type="button"
              style={botonSecundario}
              onClick={() => router.replace("/")}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}