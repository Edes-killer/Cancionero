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
    escenaActual: "", escenas: [], error: null,
  })
  const [conectando, setConectando] = useState(false)
  const [mostrarAjustes, setMostrarAjustes] = useState(false)
  const gestorRef = useRef<GestorOBS | null>(null)

  useEffect(() => {
    setCfg(leerConfigOBS())
    gestorRef.current = new GestorOBS(setEstado)
    return () => { gestorRef.current?.desconectar() }
  }, [])

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
