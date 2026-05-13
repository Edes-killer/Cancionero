"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaId, setIglesiaActivaId } from "@/lib/getIglesia"

export default function InicioPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [nombreIglesia, setNombreIglesia] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [totalCanciones, setTotalCanciones] = useState(0)
  const [totalConAcordes, setTotalConAcordes] = useState(0)
  const [totalListas, setTotalListas] = useState(0)
  const [totalSinTono, setTotalSinTono] = useState(0)
  const [ultimoCulto, setUltimoCulto] = useState<any>(null)
  const [sinIglesia, setSinIglesia] = useState(false)
  const [topCancionesMes, setTopCancionesMes] = useState<any[]>([])
  const [totalProyeccionesMes, setTotalProyeccionesMes] = useState(0)
  const [iglesiasUsuario, setIglesiasUsuario] = useState<any[]>([])
  const [iglesiaActivaId, setIglesiaActivaIdState] = useState("")
  const [localidadIglesia, setLocalidadIglesia] = useState("")
  const versiculosInicio = [
  {
    texto: "Cantad alegres a Dios, habitantes de toda la tierra.",
    cita: "Salmos 100:1"
  },
  {
    texto: "Todo lo que respira alabe a JAH. Aleluya.",
    cita: "Salmos 150:6"
  },
  {
    texto: "Servid a Jehová con alegría; venid ante su presencia con regocijo.",
    cita: "Salmos 100:2"
  },
  {
    texto: "Grande es Jehová, y digno de suprema alabanza.",
    cita: "Salmos 145:3"
  },
  {
    texto: "Jehová es mi fortaleza y mi cántico, y ha sido mi salvación.",
    cita: "Éxodo 15:2"
  }
]

const versiculoInicio =
  versiculosInicio[new Date().getDate() % versiculosInicio.length]

  useEffect(() => {
    const cargarInicio = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()

        if (!userData.user) {
          router.replace("/login")
          return
        }

        const iglesiaId = await getIglesiaId()

if (!iglesiaId) {
  setSinIglesia(true)
  setCargando(false)
  return
}

  setIglesiaActivaIdState(iglesiaId)

  const { data: relacionesIglesias } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id, iglesias(nombre)")
    .eq("user_id", userData.user.id)

 const iglesiasSinDuplicar = Array.from(
  new Map(
    (relacionesIglesias || [])
      .filter((rel: any) => rel.iglesia_id)
      .map((rel: any) => [rel.iglesia_id, rel])
  ).values()
)

setIglesiasUsuario(iglesiasSinDuplicar)

        const { data: iglesia } = await supabase
          .from("iglesias")
          .select("nombre, logo_url, localidad")
          .eq("id", iglesiaId)
          .single()

        setNombreIglesia(iglesia?.nombre || "Iglesia")
        setLogoUrl(iglesia?.logo_url || "")
        setLocalidadIglesia(iglesia?.localidad || "")

        const { count: cancionesCount } = await supabase
          .from("canciones")
          .select("*", { count: "exact", head: true })

        setTotalCanciones(cancionesCount || 0)

        const { count: sinTonoCount } = await supabase
          .from("canciones")
          .select("*", { count: "exact", head: true })
          .or("tono.is.null,tono.eq.")

        setTotalSinTono(sinTonoCount || 0)

        const { data: partesConAcordes } = await supabase
          .from("partes_cancion")
          .select("cancion_id")
          .eq("tiene_acordes", true)

        const idsUnicos = Array.from(
          new Set((partesConAcordes || []).map((p: any) => p.cancion_id).filter(Boolean))
        )

        setTotalConAcordes(idsUnicos.length)

        const { count: listasCount } = await supabase
          .from("listas_culto")
          .select("*", { count: "exact", head: true })
          .eq("iglesia_id", iglesiaId)

        setTotalListas(listasCount || 0)

        const { data: ultimo } = await supabase
          .from("listas_culto")
          .select("*")
          .eq("iglesia_id", iglesiaId)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle()

          const inicioMes = new Date()
          inicioMes.setDate(1)
          inicioMes.setHours(0, 0, 0, 0)

          const { data: historialMes } = await supabase
            .from("historial_proyecciones")
            .select("cancion_id, titulo, tono, categoria, proyectado_en")
            .eq("iglesia_id", iglesiaId)
            .eq("tipo", "cancion")
            .gte("proyectado_en", inicioMes.toISOString())

          setTotalProyeccionesMes(historialMes?.length || 0)

          const conteo = new Map<string, any>()

          ;(historialMes || []).forEach((item: any) => {
            const key = item.cancion_id || item.titulo

            if (!conteo.has(key)) {
              conteo.set(key, {
                cancion_id: item.cancion_id,
                titulo: item.titulo || "Sin título",
                tono: item.tono || "",
                categoria: item.categoria || "",
                total: 0
              })
            }

            conteo.get(key).total += 1
          })

          const top = Array.from(conteo.values())
            .sort((a, b) => b.total - a.total || a.titulo.localeCompare(b.titulo))
            .slice(0, 5)

          setTopCancionesMes(top)

        setUltimoCulto(ultimo || null)
      } catch (error) {
        console.error("Error cargando inicio:", error)
      } finally {
        setCargando(false)
      }
    }

    cargarInicio()
  }, [router])

  const abrirProyector = () => {
    window.open(`${window.location.origin}/proyectar`, "_blank", "noopener,noreferrer")
  }

  const abrirMusicos = () => {
    window.open(`${window.location.origin}/musicos`, "_blank", "noopener,noreferrer")
  }

  const ir = (ruta: string) => {
    router.push(ruta)
  }

  const totalSinAcordes = Math.max(totalCanciones - totalConAcordes, 0)
  const totalConTono = Math.max(totalCanciones - totalSinTono, 0)

  const porcentajeSinTono =
    totalCanciones > 0
      ? Math.round((totalSinTono / totalCanciones) * 100)
      : 0

  const porcentajeConTono =
    totalCanciones > 0
      ? Math.round((totalConTono / totalCanciones) * 100)
      : 0

const porcentajeConAcordes =
  totalCanciones > 0
    ? Math.round((totalConAcordes / totalCanciones) * 100)
    : 0

const porcentajeSinAcordes =
  totalCanciones > 0
    ? Math.round((totalSinAcordes / totalCanciones) * 100)
    : 0

const barraStat = (label: string, valor: number, porcentaje: number) => (
  <div style={{ marginTop: "14px" }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        fontSize: "13px",
        opacity: 0.82,
        fontWeight: 800
      }}
    >
      <span>{label}</span>
      <span>{valor} · {porcentaje}%</span>
    </div>

    <div
      style={{
        height: "10px",
        background: "rgba(255,255,255,0.08)",
        borderRadius: "999px",
        overflow: "hidden",
        marginTop: "7px"
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, porcentaje))}%`,
          height: "100%",
          background: "linear-gradient(90deg, #22c55e, #38bdf8)",
          borderRadius: "999px"
        }}
      />
    </div>
  </div>
)

  const card = {
    background: "rgba(15, 23, 42, 0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 18px 45px rgba(0,0,0,0.22)"
  }

  const botonPrincipal = {
    border: "none",
    borderRadius: "16px",
    padding: "16px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    fontWeight: 900,
    fontSize: "16px",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(37,99,235,0.25)"
  }

  const botonSecundario = {
    ...botonPrincipal,
    background: "rgba(30, 41, 59, 0.95)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "none"
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
          fontWeight: 800
        }}
      >
        Cargando inicio...
      </div>
    )
  }

  if (sinIglesia) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(37,99,235,0.22), transparent 34%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
          color: "white",
          padding: "28px",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            ...card,
            maxWidth: "620px",
            textAlign: "center"
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "14px" }}>⛪</div>

          <h1 style={{ margin: 0, fontSize: "clamp(28px, 4vw, 44px)" }}>
            Configura tu iglesia
          </h1>

          <p
            style={{
              opacity: 0.72,
              lineHeight: 1.5,
              marginTop: "14px",
              marginBottom: "22px"
            }}
          >
            Para comenzar a usar el cancionero, primero debes crear o vincular una iglesia.
          </p>

          <button
            style={botonPrincipal}
            onClick={() => ir("/crear-iglesia")}
          >
            Comenzar configuración
          </button>

          <div
            style={{
              marginTop: "14px",
              fontSize: "13px",
              opacity: 0.55
            }}
          >
            Completa la configuración inicial para comenzar a usar el sistema.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.20), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        padding: "22px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}
      >
        <div
          style={{
            ...card,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo iglesia"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "999px",
                    transform: "scale(1)",
                    display: "block"
                  }}
                />
              ) : (
                <span style={{ fontSize: "32px" }}>⛪</span>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ opacity: 0.65, fontSize: "14px", fontWeight: 700 }}>
                Bienvenido al Cancionero Cristiano
              </div>

              <h1
                style={{
                  margin: "4px 0 0",
                  fontSize: "clamp(26px, 4vw, 42px)",
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
                title={nombreIglesia}
              >
                {nombreIglesia}
                    {localidadIglesia && (
      <div
        style={{
          marginTop: "6px",
          opacity: 0.62,
          fontSize: "14px",
          fontWeight: 700
        }}
      >
        📍 {localidadIglesia}
      </div>
    )}
              </h1>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap"
            }}
          >
            {iglesiasUsuario.length > 1 && (
              <select
                value={iglesiaActivaId}
                onChange={(e) => {
                  const nuevaId = e.target.value
                  setIglesiaActivaId(nuevaId)
                  window.location.reload()
                }}
                style={{
                  padding: "9px 12px",
                  borderRadius: "999px",
                  background: "rgba(15,23,42,0.95)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontWeight: 800,
                  outline: "none"
                }}
                title="Cambiar iglesia activa"
              >
                {iglesiasUsuario.map((rel: any, i: number) => (
                  <option key={`${rel.iglesia_id}-${i}`} value={rel.iglesia_id}>
                    {rel.iglesias?.nombre || "Iglesia sin nombre"}
                  </option>
                ))}
              </select>
            )}

            <div
              style={{
                padding: "8px 12px",
                borderRadius: "999px",
                background: "rgba(34,197,94,0.14)",
                border: "1px solid rgba(34,197,94,0.28)",
                color: "#bbf7d0",
                fontWeight: 900,
                fontSize: "13px"
              }}
            >
              Sistema listo
            </div>
          </div>
        </div>

            <div
              style={{
                ...card,
                background:
                  "radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 34%), linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "18px",
                alignItems: "center"
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    opacity: 0.65,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "8px"
                  }}
                >
                  Versículo para comenzar
                </div>

                <div
                  style={{
                    fontSize: "clamp(22px, 3vw, 38px)",
                    lineHeight: 1.18,
                    fontWeight: 900,
                    maxWidth: "900px"
                  }}
                >
                  “{versiculoInicio.texto}”
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    color: "#bbf7d0",
                    fontWeight: 900,
                    fontSize: "15px"
                  }}
                >
                  {versiculoInicio.cita}
                </div>
              </div>

              <div
                style={{
                  width: "82px",
                  height: "82px",
                  borderRadius: "24px",
                  background: "rgba(34,197,94,0.14)",
                  border: "1px solid rgba(34,197,94,0.30)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "42px"
                }}
              >
                📖
              </div>
            </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "14px"
          }}
        >
          <button style={botonPrincipal} onClick={() => ir("/control")}>
            🎛️ Ir a Control
          </button>

          <button style={botonSecundario} onClick={abrirProyector}>
            🖥️ Abrir Proyector
          </button>

          <button style={botonSecundario} onClick={abrirMusicos}>
            🎹 Abrir Músicos
          </button>

          <button style={botonSecundario} onClick={() => ir("/canciones")}>
            🎵 Administrar Canciones
          </button>

          <button style={botonSecundario} onClick={() => ir("/configuracion")}>
            ⚙️ Configuración
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px"
          }}
        >
          <div style={card}>
            <div style={{ opacity: 0.62, fontSize: "13px", fontWeight: 700 }}>
              Canciones
            </div>
            <div style={{ fontSize: "34px", fontWeight: 950, marginTop: "6px" }}>
              {totalCanciones}
            </div>
          </div>

          <div style={card}>
            <div style={{ opacity: 0.62, fontSize: "13px", fontWeight: 700 }}>
              Proyecciones este mes
            </div>
            <div style={{ fontSize: "34px", fontWeight: 950, marginTop: "6px" }}>
              {totalProyeccionesMes}
            </div>
          </div>

          <div style={card}>
            <div style={{ opacity: 0.62, fontSize: "13px", fontWeight: 700 }}>
              Con acordes
            </div>
              
            <div style={{ fontSize: "34px", fontWeight: 950, marginTop: "6px" }}>
              {totalConAcordes}
            </div>
          </div>
          <div style={card}>
                <div style={{ opacity: 0.62, fontSize: "13px", fontWeight: 700 }}>
                  Sin tono
                </div>
                <div style={{ fontSize: "34px", fontWeight: 950, marginTop: "6px" }}>
                  {totalSinTono}
                </div>
              </div>

          <div style={card}>
            <div style={{ opacity: 0.62, fontSize: "13px", fontWeight: 700 }}>
              Listas de culto
            </div>
            <div style={{ fontSize: "34px", fontWeight: 950, marginTop: "6px" }}>
              {totalListas}
            </div>
            
          </div>
          
        </div>

        <div
          style={{
            ...card,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "14px",
            alignItems: "center"
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ opacity: 0.62, fontSize: "13px", fontWeight: 700 }}>
              Última lista de culto
            </div>

            <div
              style={{
                fontSize: "20px",
                fontWeight: 900,
                marginTop: "6px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              title={ultimoCulto?.nombre || ""}
            >
              {ultimoCulto?.nombre || "Aún no hay listas guardadas"}
            </div>
          </div>

          <button style={botonSecundario} onClick={() => ir("/control")}>
            Preparar culto
          </button>
        </div>
        <div
              style={{
                ...card,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
                alignItems: "center"
              }}
            >
              <div>
                <div
                  style={{
                    opacity: 0.62,
                    fontSize: "13px",
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase"
                  }}
                >
                  Estado del repertorio
                </div>

                <h2
                  style={{
                    margin: "8px 0 0",
                    fontSize: "clamp(22px, 3vw, 34px)"
                  }}
                >
                  Cobertura de acordes
                </h2>

                <p
                  style={{
                    margin: "8px 0 0",
                    opacity: 0.68,
                    lineHeight: 1.45
                  }}
                >
                  Esto ayuda a saber qué tan preparado está el cancionero para la pantalla de músicos.
                </p>
              </div>

              <div>
                {barraStat("Con acordes", totalConAcordes, porcentajeConAcordes)}
                {barraStat("Sin acordes", totalSinAcordes, porcentajeSinAcordes)}
                {barraStat("Con tono", totalConTono, porcentajeConTono)}
                {barraStat("Sin tono", totalSinTono, porcentajeSinTono)}
              </div>
            </div>

            <div
              style={{
                ...card,
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <div
                    style={{
                      opacity: 0.62,
                      fontSize: "13px",
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase"
                    }}
                  >
                    Estadística de culto
                  </div>

                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "clamp(22px, 3vw, 32px)"
                    }}
                  >
                    Más proyectadas este mes
                  </h2>
                </div>

                <div
                  style={{
                    padding: "7px 12px",
                    borderRadius: "999px",
                    background: "rgba(37,99,235,0.16)",
                    border: "1px solid rgba(37,99,235,0.32)",
                    color: "#bfdbfe",
                    fontWeight: 900,
                    fontSize: "13px"
                  }}
                >
                  {totalProyeccionesMes} usos
                </div>
              </div>

              {topCancionesMes.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    opacity: 0.72
                  }}
                >
                  Aún no hay canciones registradas este mes. Proyecta algunas canciones desde Control para comenzar a ver estadísticas.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "10px"
                  }}
                >
                  {topCancionesMes.map((c, i) => (
                    <div
                      key={`${c.cancion_id || c.titulo}-${i}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "12px",
                          background:
                            i === 0
                              ? "rgba(234,179,8,0.18)"
                              : "rgba(37,99,235,0.16)",
                          border:
                            i === 0
                              ? "1px solid rgba(234,179,8,0.32)"
                              : "1px solid rgba(37,99,235,0.28)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 950
                        }}
                      >
                        {i + 1}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                          title={c.titulo}
                        >
                          {c.titulo}
                        </div>

                        <div
                          style={{
                            marginTop: "3px",
                            fontSize: "12px",
                            opacity: 0.62,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {[c.categoria, c.tono].filter(Boolean).join(" • ") || "Sin detalles"}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "rgba(34,197,94,0.14)",
                          border: "1px solid rgba(34,197,94,0.28)",
                          color: "#bbf7d0",
                          fontWeight: 900,
                          fontSize: "13px",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {c.total} {c.total === 1 ? "vez" : "veces"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px"
              }}
            >
              <div style={card}>
                <div style={{ fontSize: "30px", marginBottom: "10px" }}>🎛️</div>
                <div style={{ fontWeight: 900, fontSize: "18px" }}>Preparar culto</div>
                <div style={{ opacity: 0.65, fontSize: "14px", marginTop: "6px", lineHeight: 1.4 }}>
                  Arma la lista, proyecta canciones, Biblia, imágenes y mensajes.
                </div>
                <button
                  style={{ ...botonPrincipal, marginTop: "14px", width: "100%" }}
                  onClick={() => ir("/control")}
                >
                  Ir al Control
                </button>
              </div>

              <div style={card}>
                <div style={{ fontSize: "30px", marginBottom: "10px" }}>🎹</div>
                <div style={{ fontWeight: 900, fontSize: "18px" }}>Pantalla músicos</div>
                <div style={{ opacity: 0.65, fontSize: "14px", marginTop: "6px", lineHeight: 1.4 }}>
                  Vista limpia con acordes, transposición y escala latina/americana.
                </div>
                <button
                  style={{ ...botonSecundario, marginTop: "14px", width: "100%" }}
                  onClick={abrirMusicos}
                >
                  Abrir Músicos
                </button>
              </div>

              <div style={card}>
                <div style={{ fontSize: "30px", marginBottom: "10px" }}>🖥️</div>
                <div style={{ fontWeight: 900, fontSize: "18px" }}>Proyección</div>
                <div style={{ opacity: 0.65, fontSize: "14px", marginTop: "6px", lineHeight: 1.4 }}>
                  Pantalla pública para congregación, letras, Biblia, imágenes y estados.
                </div>
                <button
                  style={{ ...botonSecundario, marginTop: "14px", width: "100%" }}
                  onClick={abrirProyector}
                >
                  Abrir Proyector
                </button>
              </div>
            </div>
      </div>
    </div>
  )
}