"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { navegarSPA } from "@/lib/navegar"
import {
  GestorOBS, leerConfigOBS, guardarConfigOBS, CONFIG_OBS_DEFAULT,
  type ConfigOBS, type EstadoOBS,
} from "@/lib/obs"

const C = {
  fondo: "#060d1a", panel: "#111b2e", panel2: "#0d1626",
  borde: "rgba(255,255,255,0.08)", texto: "#eaf0fb",
  suave: "rgba(234,240,251,0.6)", tenue: "rgba(234,240,251,0.4)",
  azul: "#2563eb", verde: "#16a34a", rojo: "#dc2626", ambar: "#f59e0b",
}

export default function TransmisionPage() {
  const router = useRouter()
  const [cfg, setCfg] = useState<ConfigOBS>(CONFIG_OBS_DEFAULT)
  const [estado, setEstado] = useState<EstadoOBS>({
    conectado: false, transmitiendo: false, grabando: false,
    escenaActual: "", escenas: [], fuentes: [], audios: [], error: null,
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [conectando, setConectando] = useState(false)
  const [mostrarAjustes, setMostrarAjustes] = useState(false)
  const gestorRef = useRef<GestorOBS | null>(null)

  useEffect(() => {
    setCfg(leerConfigOBS())
    gestorRef.current = new GestorOBS(setEstado)
    return () => { gestorRef.current?.desconectar() }
  }, [])

  // Vista previa en vivo: pedirle a OBS una foto de la escena al aire cada ~1.2s.
  useEffect(() => {
    if (!estado.conectado) { setPreview(null); return }
    let vivo = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const img = await gestorRef.current?.capturarEscena(560)
      if (!vivo) return
      if (img) setPreview(img)
      timer = setTimeout(tick, 1200)
    }
    tick()
    return () => { vivo = false; clearTimeout(timer) }
  }, [estado.conectado, estado.escenaActual])

  const conectar = async () => {
    setConectando(true)
    guardarConfigOBS(cfg)
    const ok = await gestorRef.current?.conectar(cfg)
    setConectando(false)
    if (ok) setMostrarAjustes(false)
  }

  const desconectar = () => gestorRef.current?.desconectar()

  const boton = (props: React.CSSProperties): React.CSSProperties => ({
    padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: 14, ...props,
  })

  return (
    <div style={{
      minHeight: "100vh", background: C.fondo, color: C.texto,
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "0 0 60px",
    }}>
      {/* Encabezado */}
      <div style={{
        borderBottom: `1px solid ${C.borde}`, padding: "18px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navegarSPA(router, "/")} style={boton({
            background: "rgba(255,255,255,0.06)", color: C.texto, padding: "8px 12px",
          })}>← Inicio</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}>
              🎥 Transmisión
              <span style={{
                fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                background: "rgba(245,158,11,.14)", color: C.ambar, border: "1px solid rgba(245,158,11,.3)",
              }}>PREMIUM</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.tenue, marginTop: 2 }}>Controla OBS Studio desde Selah Live</div>
          </div>
        </div>

        {/* Estado de conexión */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 99,
          background: estado.conectado ? "rgba(22,163,74,.12)" : "rgba(220,38,38,.1)",
          border: `1px solid ${estado.conectado ? "rgba(22,163,74,.3)" : "rgba(220,38,38,.25)"}`,
        }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: estado.conectado ? "#4ade80" : "#f87171" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: estado.conectado ? "#4ade80" : "#fca5a5" }}>
            {estado.conectado ? "Conectado a OBS" : "Sin conexión"}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px" }}>
        <div style={{
          background: "linear-gradient(135deg,rgba(37,99,235,.16),rgba(14,165,233,.08))",
          border: "1px solid rgba(96,165,250,.32)", borderRadius: 16,
          padding: "16px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ flex: "1 1 380px" }}>
            <div style={{ fontWeight: 850, marginBottom: 5 }}>Integración opcional con OBS</div>
            <div style={{ color: C.suave, fontSize: 13.5, lineHeight: 1.5 }}>
              Selah puede transmitir por sí solo. Usa esta pantalla únicamente si tu iglesia ya trabaja con OBS y quiere controlarlo desde Selah.
            </div>
          </div>
          <button onClick={() => navegarSPA(router, "/en-vivo")} style={boton({
            background: C.azul, color: "white", whiteSpace: "nowrap",
          })}>Ir a Transmisión nativa →</button>
        </div>

        {/* Sin conexión: guía + formulario */}
        {!estado.conectado && (
          <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Conectar con OBS Studio</div>
            <ol style={{ margin: "0 0 20px", paddingLeft: 20, color: C.suave, fontSize: 14, lineHeight: 1.9 }}>
              <li>Abre <strong style={{ color: C.texto }}>OBS Studio</strong> (versión 28 o más nueva).</li>
              <li>Menú <strong style={{ color: C.texto }}>Herramientas → Configuración de obs-websocket</strong>.</li>
              <li>Marca <strong style={{ color: C.texto }}>“Activar servidor WebSocket”</strong> y copia la contraseña.</li>
              <li>Pega la contraseña aquí abajo y conecta.</li>
            </ol>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, color: C.tenue }}>
                Dirección (host)
                <input value={cfg.host} onChange={e => setCfg({ ...cfg, host: e.target.value })}
                  placeholder="localhost"
                  style={inputEstilo} />
              </label>
              <label style={{ fontSize: 12.5, color: C.tenue }}>
                Puerto
                <input value={cfg.puerto} onChange={e => setCfg({ ...cfg, puerto: parseInt(e.target.value) || 4455 })}
                  style={inputEstilo} />
              </label>
            </div>
            <label style={{ fontSize: 12.5, color: C.tenue, display: "block", marginBottom: 18 }}>
              Contraseña de obs-websocket
              <input type="password" value={cfg.password} onChange={e => setCfg({ ...cfg, password: e.target.value })}
                placeholder="(la que copiaste de OBS)"
                onKeyDown={e => { if (e.key === "Enter") conectar() }}
                style={inputEstilo} />
            </label>

            {estado.error && (
              <div style={{
                background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.3)",
                borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16,
              }}>⚠️ {estado.error}</div>
            )}

            <button onClick={conectar} disabled={conectando}
              style={boton({ background: C.azul, color: "#fff", width: "100%", padding: "13px", opacity: conectando ? 0.6 : 1 })}>
              {conectando ? "Conectando..." : "🔌 Conectar con OBS"}
            </button>
          </div>
        )}

        {/* Conectado: control */}
        {estado.conectado && (
          <>
            {/* Vista previa en vivo de la escena al aire */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                position: "relative", borderRadius: 16, overflow: "hidden",
                border: `1px solid ${C.borde}`, background: "#000", aspectRatio: "16 / 9",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {preview ? (
                  <img src={preview} alt="Escena al aire"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                ) : (
                  <div style={{ color: C.tenue, fontSize: 13 }}>Cargando vista previa…</div>
                )}
                {/* Etiqueta AL AIRE / escena actual */}
                <div style={{
                  position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 11px", borderRadius: 99, fontSize: 11.5, fontWeight: 800,
                  background: estado.transmitiendo ? "rgba(220,38,38,.85)" : "rgba(0,0,0,.55)",
                  color: "#fff", backdropFilter: "blur(4px)",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 99,
                    background: estado.transmitiendo ? "#fff" : "#4ade80",
                    boxShadow: estado.transmitiendo ? "0 0 6px #fff" : "none",
                  }} />
                  {estado.transmitiendo ? "AL AIRE" : "VISTA PREVIA"}
                </div>
                {estado.escenaActual && (
                  <div style={{
                    position: "absolute", bottom: 10, left: 10, padding: "4px 10px", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, background: "rgba(0,0,0,.55)", color: "#fff", backdropFilter: "blur(4px)",
                  }}>🎬 {estado.escenaActual}</div>
                )}
              </div>
            </div>

            {/* Transmisión / grabación */}
            <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <Indicador activo={estado.transmitiendo} colorOn="#f87171" label={estado.transmitiendo ? "AL AIRE" : "Fuera del aire"} sub="Transmisión" />
                  <Indicador activo={estado.grabando} colorOn="#fbbf24" label={estado.grabando ? "GRABANDO" : "Sin grabar"} sub="Grabación" />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {!estado.transmitiendo
                    ? <button onClick={() => gestorRef.current?.iniciarTransmision()} style={boton({ background: C.rojo, color: "#fff" })}>● Iniciar transmisión</button>
                    : <button onClick={() => gestorRef.current?.detenerTransmision()} style={boton({ background: "rgba(255,255,255,0.08)", color: C.texto })}>■ Detener transmisión</button>}
                  {!estado.grabando
                    ? <button onClick={() => gestorRef.current?.iniciarGrabacion()} style={boton({ background: "rgba(251,191,36,0.15)", color: "#fbbf24" })}>⏺ Grabar</button>
                    : <button onClick={() => gestorRef.current?.detenerGrabacion()} style={boton({ background: "rgba(255,255,255,0.08)", color: C.texto })}>■ Detener</button>}
                </div>
              </div>
            </div>

            {/* Escenas */}
            <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Escenas</div>
              <div style={{ fontSize: 12.5, color: C.tenue, marginBottom: 16 }}>Toca una para pasarla al aire.</div>
              {estado.escenas.length === 0 ? (
                <div style={{ color: C.tenue, fontSize: 14, padding: "10px 0" }}>No hay escenas en OBS todavía.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                  {estado.escenas.map(nombre => {
                    const activa = nombre === estado.escenaActual
                    return (
                      <button key={nombre} onClick={() => gestorRef.current?.cambiarEscena(nombre)}
                        style={{
                          padding: "16px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                          fontWeight: 700, fontSize: 14,
                          background: activa ? "rgba(37,99,235,0.2)" : C.panel2,
                          border: `1.5px solid ${activa ? C.azul : C.borde}`,
                          color: activa ? "#93c5fd" : C.texto,
                        }}>
                        {activa && <span style={{ fontSize: 11, display: "block", color: "#93c5fd", fontWeight: 800, marginBottom: 4 }}>● AL AIRE</span>}
                        {nombre}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fuentes de la escena al aire */}
            <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, marginTop: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Fuentes de “{estado.escenaActual || "—"}”</div>
              <div style={{ fontSize: 12.5, color: C.tenue, marginBottom: 16 }}>Muestra u oculta la cámara, el logo, un banner…</div>
              {estado.fuentes.length === 0 ? (
                <div style={{ color: C.tenue, fontSize: 14, padding: "6px 0" }}>Esta escena no tiene fuentes.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {estado.fuentes.map(f => (
                    <div key={f.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      padding: "11px 14px", borderRadius: 12, background: C.panel2, border: `1px solid ${C.borde}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 16 }}>{iconoFuente(f.tipo)}</span>
                        <span style={{
                          fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          color: f.visible ? C.texto : C.tenue,
                        }}>{f.nombre}</span>
                      </div>
                      <button onClick={() => gestorRef.current?.alternarFuente(f.id, !f.visible)}
                        aria-label={f.visible ? "Ocultar" : "Mostrar"}
                        style={{
                          position: "relative", width: 46, height: 26, borderRadius: 99, border: "none", cursor: "pointer",
                          background: f.visible ? C.verde : "rgba(255,255,255,0.14)", transition: "background .15s", flexShrink: 0,
                        }}>
                        <span style={{
                          position: "absolute", top: 3, left: f.visible ? 23 : 3, width: 20, height: 20, borderRadius: 99,
                          background: "#fff", transition: "left .15s",
                        }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audio */}
            <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, marginTop: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Audio</div>
              <div style={{ fontSize: 12.5, color: C.tenue, marginBottom: 16 }}>Silencia o activa micrófonos y sonido.</div>
              {estado.audios.length === 0 ? (
                <div style={{ color: C.tenue, fontSize: 14, padding: "6px 0" }}>No se detectaron fuentes de audio.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {estado.audios.map(a => (
                    <button key={a.nombre} onClick={() => gestorRef.current?.alternarSilencio(a.nombre)}
                      style={{
                        display: "flex", alignItems: "center", gap: 11, textAlign: "left",
                        padding: "13px 14px", borderRadius: 12, cursor: "pointer",
                        background: a.silenciado ? "rgba(220,38,38,0.12)" : C.panel2,
                        border: `1.5px solid ${a.silenciado ? "rgba(220,38,38,0.4)" : C.borde}`,
                      }}>
                      <span style={{ fontSize: 18 }}>{a.silenciado ? "🔇" : "🔊"}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5, fontWeight: 700, color: a.silenciado ? "#fca5a5" : C.texto,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{a.nombre}</div>
                        <div style={{ fontSize: 11, color: a.silenciado ? "#fca5a5" : C.tenue, fontWeight: 700 }}>
                          {a.silenciado ? "SILENCIADO" : "Activo"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={desconectar} style={boton({ background: "transparent", color: C.tenue, border: `1px solid ${C.borde}` })}>
                Desconectar de OBS
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Un emoji según el tipo de fuente de OBS, para reconocerla de un vistazo.
function iconoFuente(tipo: string): string {
  const t = (tipo || "").toLowerCase()
  if (t.includes("dshow") || t.includes("v4l2") || t.includes("av_capture") || t.includes("video_capture")) return "📷" // cámara
  if (t.includes("window_capture") || t.includes("monitor_capture") || t.includes("screen") || t.includes("display")) return "🖥️"
  if (t.includes("browser")) return "🌐"
  if (t.includes("image") || t.includes("logo")) return "🖼️"
  if (t.includes("text") || t.includes("freetype") || t.includes("gdiplus")) return "🅰️"
  if (t.includes("ffmpeg") || t.includes("vlc") || t.includes("media")) return "🎞️"
  if (t.includes("color")) return "🎨"
  if (t.includes("group")) return "🗂️"
  if (t.includes("wasapi") || t.includes("coreaudio") || t.includes("pulse") || t.includes("audio")) return "🔊"
  return "▫️"
}

const inputEstilo: React.CSSProperties = {
  width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)", background: "#0a1525",
  color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
}

function Indicador({ activo, colorOn, label, sub }: { activo: boolean; colorOn: string; label: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{
        width: 11, height: 11, borderRadius: 99,
        background: activo ? colorOn : "rgba(255,255,255,0.18)",
        boxShadow: activo ? `0 0 8px ${colorOn}` : "none",
      }} />
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: activo ? colorOn : "rgba(234,240,251,0.5)" }}>{label}</div>
        <div style={{ fontSize: 10.5, color: "rgba(234,240,251,0.35)", textTransform: "uppercase", letterSpacing: ".06em" }}>{sub}</div>
      </div>
    </div>
  )
}
