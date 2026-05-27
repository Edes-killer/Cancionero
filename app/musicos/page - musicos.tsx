"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"
import { getIglesiaId } from "../../lib/getIglesia"

export default function MusicosPage() {
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [transposicion, setTransposicion] = useState(0)
  const [mostrarAcordes, setMostrarAcordes] = useState(true)
  const [usarAmericano, setUsarAmericano] = useState(false)
  const [cargandoMusicos, setCargandoMusicos] = useState(true)
  const [esMovil, setEsMovil] = useState(false)
  const [panelAbierto, setPanelAbierto] = useState(false)

  const notasLatinas = [
    "Do", "Do#", "Re", "Re#", "Mi", "Fa",
    "Fa#", "Sol", "Sol#", "La", "La#", "Si"
  ]

  // ── Detectar móvil ────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setEsMovil(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io("http://" + window.location.hostname + ":4000")

    s.on("connect", async () => {
      const sala = (await getIglesiaId()) || "global"
      setCargandoMusicos(true)
      s.emit("unirse-sala", { sala, pantalla: "musicos" })
      s.emit("get-estado")
      setTimeout(() => setCargandoMusicos(false), 1200)
    })

    s.on("estado-actual", (estado: any) => {
      setCargandoMusicos(false)
      if (estado?.tipo !== "cancion") return
      const data = estado.data || {}
      setPartes(data.partes || [])
      setIndex(data.index || 0)
      setTitulo(data.titulo || "")
      setTono(data.tono || "")
    })

    s.on("cargar-cancion", (data: any) => {
      setCargandoMusicos(false)
      setPartes(data.partes || [])
      setIndex(0)
      setTitulo(data.titulo || "")
      setTono(data.tono || "")
    })

    s.on("cambiar-parte", (i: number) => setIndex(i))

    return () => { s.disconnect() }
  }, [])

  // ── Transposición ─────────────────────────────────────────────────────────
  const transponerAcorde = (acorde: string, pasos: number) => {
    const acordeLatino = convertirEscala(acorde, false)
    const match = acordeLatino.match(/^(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si)(.*)$/)
    if (!match) return acorde
    const base = match[1]
    const resto = match[2] || ""
    const idx = notasLatinas.indexOf(base)
    if (idx === -1) return acorde
    const nuevo = (idx + pasos + 12) % 12
    const resultado = notasLatinas[nuevo] + resto
    return usarAmericano ? convertirEscala(resultado, true) : resultado
  }

  const convertirEscala = (acorde: string, aAmericano: boolean): string => {
    const mapaLatinoAAmericano: Record<string, string> = {
      Do: "C", "Do#": "C#", Re: "D", "Re#": "D#",
      Mi: "E", Fa: "F", "Fa#": "F#", Sol: "G",
      "Sol#": "G#", La: "A", "La#": "A#", Si: "B"
    }
    const mapaAmericanoALatino: Record<string, string> = {
      C: "Do", "C#": "Do#", D: "Re", "D#": "Re#",
      E: "Mi", F: "Fa", "F#": "Fa#", G: "Sol",
      "G#": "Sol#", A: "La", "A#": "La#", B: "Si"
    }
    const mapa = aAmericano ? mapaLatinoAAmericano : mapaAmericanoALatino
    const match = acorde.match(/^(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|[A-G])(.*)$/)
    if (!match) return acorde
    const base = match[1]
    const resto = match[2] || ""
    return (mapa[base] || base) + resto
  }

  const limpiarTokenAcorde = (token: string) =>
    (token || "").trim().replace(/[.,;:]+$/g, "")

  const esAcorde = (token: string) => {
    const t = limpiarTokenAcorde(token)
    return /^((Do|Re|Mi|Fa|Sol|La|Si)|[A-G])(#|b)?(m|maj|min|sus|dim|aug|add|°|ø)?[0-9]*(maj7|m7|sus2|sus4|add9|dim7|m7b5)?(\/((Do|Re|Mi|Fa|Sol|La|Si)|[A-G])(#|b)?)?$/i.test(t)
  }

  const esAcordeOTextoDeAcordes = (linea: string) => {
    const tokens = (linea || "").replace(/\u00A0/g, " ").trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return false
    return tokens.every(token => esAcorde(limpiarTokenAcorde(token)))
  }

  const transponerLinea = (linea: string, pasos: number) =>
    linea.replace(/\S+/g, token => {
      const limpio = limpiarTokenAcorde(token)
      if (!esAcorde(limpio)) return token
      return token.replace(limpio, transponerAcorde(limpio, pasos))
    })

  // ── Parser de acordes ─────────────────────────────────────────────────────
  const detectarFormato = (texto: string) => {
    const lineas = texto.replace(/\r/g, "").split("\n").map(l => l.trimEnd())
    const resultado: any[] = []

    for (let i = 0; i < lineas.length; i++) {
      const actual = lineas[i] || ""
      const siguiente = lineas[i + 1] || ""
      if (!actual.trim()) continue

      if (actual.includes("[")) {
        const acordes: any[] = []
        const letra = actual.replace(/\[(.*?)\]/g, "")
        const regex = /\[(.*?)\]/g
        let match
        while ((match = regex.exec(actual)) !== null) {
          const antes = actual.slice(0, match.index).replace(/\[(.*?)\]/g, "")
          acordes.push({ acorde: match[1], pos: antes.length })
        }
        resultado.push({ tipo: "corchete", acordes, letra })
        continue
      }

      if (esAcordeOTextoDeAcordes(actual) && siguiente.trim() && !esAcordeOTextoDeAcordes(siguiente)) {
        resultado.push({ tipo: "linea", acordes: actual, letra: siguiente })
        i++
        continue
      }

      resultado.push({ tipo: "solo", letra: actual })
    }

    return resultado
  }

  // ── Parte actual ──────────────────────────────────────────────────────────
  const parteActual = partes[index] || null
  // ✅ FIX: el himnario guarda acordes en texto_acordes (separado de texto)
  // Prioridad: texto_acordes (si tiene acordes) → texto → texto_letra
  const textoActual = (parteActual?.tiene_acordes && parteActual?.texto_acordes)
  ? parteActual.texto_acordes
  : parteActual?.texto || parteActual?.texto_letra || ""
  const tipoActual = parteActual?.tipo || ""
  const bloque = detectarFormato(textoActual)
  const totalLineasParte = bloque.length
  const hayAcordesVisibles = mostrarAcordes && bloque.some(
    l => l.tipo === "corchete" || l.tipo === "linea" ||
      (l.tipo === "solo" && esAcordeOTextoDeAcordes(l.letra))
  )

  // ── Tamaños de fuente adaptativos ─────────────────────────────────────────
  const calcFontSize = () => {
    if (esMovil) {
      if (totalLineasParte <= 2) return hayAcordesVisibles ? "28px" : "34px"
      if (totalLineasParte <= 4) return hayAcordesVisibles ? "22px" : "28px"
      if (totalLineasParte <= 6) return hayAcordesVisibles ? "18px" : "22px"
      return "15px"
    }
    if (totalLineasParte <= 2) return hayAcordesVisibles ? "clamp(28px,3.5vw,52px)" : "clamp(32px,4vw,62px)"
    if (totalLineasParte <= 4) return hayAcordesVisibles ? "clamp(22px,2.8vw,42px)" : "clamp(26px,3.2vw,50px)"
    if (totalLineasParte <= 6) return hayAcordesVisibles ? "clamp(18px,2.2vw,34px)" : "clamp(20px,2.5vw,38px)"
    return "clamp(14px,1.8vw,26px)"
  }

  const calcFontSizeAcordes = () => {
    if (esMovil) {
      return totalLineasParte <= 4 ? "14px" : "12px"
    }
    return totalLineasParte <= 4 ? "clamp(13px,1.1vw,18px)" : "clamp(11px,0.9vw,15px)"
  }

  const fontSizeLetra = calcFontSize()
  const fontSizeAcordes = calcFontSizeAcordes()

  // ── Etiqueta parte ────────────────────────────────────────────────────────
  const etiquetaParte = (() => {
    if (!tipoActual) return `${index + 1} / ${partes.length}`
    const contadores: Record<string, number> = {}
    let etiqueta = ""
    for (let i = 0; i <= index; i++) {
      const tipo = partes[i]?.tipo || ""
      contadores[tipo] = (contadores[tipo] || 0) + 1
      if (i === index) etiqueta = `${tipo} ${contadores[tipo]}`
    }
    return `${etiqueta} · ${index + 1}/${partes.length}`
  })()

  // ── Tono mostrado ─────────────────────────────────────────────────────────
  const tonoMostrado = (() => {
    if (!tono) return ""
    const tonoLatino = convertirEscala(tono, false)
    const tonoTranspuesto = transponerAcorde(tonoLatino, transposicion)
    return usarAmericano ? convertirEscala(tonoTranspuesto, true) : tonoTranspuesto
  })()

  // ── Render acordes ────────────────────────────────────────────────────────
  const renderAcordeChip = (acorde: string, key?: any, compacto = false) => {
    const limpio = limpiarTokenAcorde(acorde)
    const texto = convertirEscala(transponerAcorde(limpio, transposicion), usarAmericano)
    return (
      <span key={key} style={{
        display: "inline-block",
        padding: compacto ? "2px 7px" : "3px 10px",
        borderRadius: "7px",
        background: "rgba(34,197,94,0.18)",
        border: "1px solid rgba(34,197,94,0.38)",
        color: "#86efac",
        fontWeight: 900,
        fontSize: fontSizeAcordes,
        fontFamily: "'Courier New', monospace",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        margin: "1px 2px"
      }}>
        {texto}
      </span>
    )
  }

  const renderLineaAcordesChips = (linea: string) => {
    const tokens = (linea || "").replace(/\u00A0/g, " ").trim().split(/\s+/).filter(Boolean)
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "6px", flexWrap: "wrap", marginBottom: "8px"
      }}>
        {tokens.map((token, i) => renderAcordeChip(token, i, totalLineasParte > 4))}
      </div>
    )
  }

  // ── PANTALLA DE CARGA ─────────────────────────────────────────────────────
  if (cargandoMusicos) {
    return (
      <div style={{
        width: "100vw", height: "100dvh",
        background: "linear-gradient(180deg, #020617 0%, #111827 100%)",
        color: "white", display: "flex", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        padding: "24px", boxSizing: "border-box"
      }}>
        <div>
          <div style={{
            width: 58, height: 58, borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.1)",
            borderTopColor: "#22c55e",
            margin: "0 auto 20px",
            animation: "spinM 0.9s linear infinite"
          }} />
          <style>{`@keyframes spinM { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: "clamp(24px,3vw,42px)", fontWeight: 800, marginBottom: 8 }}>Músicos</div>
          <div style={{ fontSize: "clamp(14px,1.5vw,20px)", opacity: 0.6 }}>Preparando acordes...</div>
        </div>
      </div>
    )
  }

  // ── PANTALLA DE ESPERA ────────────────────────────────────────────────────
  if (!partes.length) {
    return (
      <div style={{
        width: "100vw", height: "100dvh",
        background: "radial-gradient(circle at 50% 30%, rgba(34,197,94,0.18), transparent 40%), linear-gradient(180deg, #020617 0%, #111827 100%)",
        color: "white", display: "flex", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        padding: "24px", boxSizing: "border-box",
        fontFamily: "'Segoe UI', system-ui, sans-serif"
      }}>
        <div>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎸</div>
          <div style={{ fontSize: "clamp(26px,4vw,52px)", fontWeight: 900, marginBottom: 10 }}>
            Pantalla de Músicos
          </div>
          <div style={{ fontSize: "clamp(14px,1.6vw,22px)", opacity: 0.55 }}>
            Esperando canción desde el control...
          </div>
        </div>
      </div>
    )
  }

  // ── PANTALLA PRINCIPAL ────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100vw", height: "100dvh",
      background: "#03080f",
      color: "white",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      boxSizing: "border-box",
      position: "relative"
    }}>
      <style>{`
        .scroll-musicos::-webkit-scrollbar { display: none }
        .ctrl-m { transition: all 0.12s }
        .ctrl-m:active { transform: scale(0.92) }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: esMovil ? "12px 14px 8px" : "14px 24px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", gap: 12
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 900,
            fontSize: esMovil ? "clamp(16px,4vw,22px)" : "clamp(20px,2.5vw,32px)",
            lineHeight: 1.15,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }} title={titulo}>
            {titulo || "Sin título"}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
            {/* Etiqueta parte */}
            <span style={{
              padding: "3px 10px", borderRadius: 999,
              background: "rgba(34,197,94,0.14)",
              border: "1px solid rgba(34,197,94,0.28)",
              color: "#86efac", fontSize: esMovil ? 11 : 13, fontWeight: 800
            }}>
              {etiquetaParte}
            </span>

            {/* Tono */}
            {tonoMostrado && (
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: esMovil ? 11 : 13, fontWeight: 700, opacity: 0.85
              }}>
                🎵 {tonoMostrado}
                {transposicion !== 0 && (
                  <span style={{ color: "#fbbf24", marginLeft: 4 }}>
                    ({transposicion > 0 ? "+" : ""}{transposicion})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Botón abrir panel */}
        <button
          className="ctrl-m"
          onClick={() => setPanelAbierto(v => !v)}
          style={{
            width: esMovil ? 44 : 52, height: esMovil ? 44 : 52,
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
            background: panelAbierto ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
            color: "white", fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}
        >⚙️</button>
      </div>

      {/* ── PANEL DE CONTROLES (overlay) ────────────────────────────────────── */}
      {panelAbierto && (
        <div
          onClick={() => setPanelAbierto(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute",
              top: esMovil ? 0 : 80,
              right: 0,
              width: esMovil ? "100%" : 320,
              height: esMovil ? "auto" : "auto",
              background: "rgba(10,20,40,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: esMovil ? "0 0 20px 20px" : "0 0 0 20px",
              padding: 20,
              display: "flex", flexDirection: "column", gap: 16
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>⚙️ Controles</div>

            {/* Transposición */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Transposición: {transposicion > 0 ? "+" : ""}{transposicion} semitonos
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ctrl-m"
                  onClick={() => setTransposicion(t => t - 1)}
                  style={btnPanelStyle}>
                  ▼ Bajar
                </button>
                <button className="ctrl-m"
                  onClick={() => setTransposicion(0)}
                  style={{ ...btnPanelStyle, background: "rgba(255,255,255,0.06)", flex: "none", padding: "11px 14px" }}>
                  Reset
                </button>
                <button className="ctrl-m"
                  onClick={() => setTransposicion(t => t + 1)}
                  style={btnPanelStyle}>
                  ▲ Subir
                </button>
              </div>
            </div>

            {/* Acordes ON/OFF */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Acordes
              </div>
              <button className="ctrl-m"
                onClick={() => setMostrarAcordes(v => !v)}
                style={{
                  ...btnPanelStyle,
                  width: "100%",
                  background: mostrarAcordes ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${mostrarAcordes ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.1)"}`,
                  color: mostrarAcordes ? "#86efac" : "rgba(255,255,255,0.6)"
                }}>
                {mostrarAcordes ? "🎸 Acordes visibles" : "🎸 Acordes ocultos"}
              </button>
            </div>

            {/* Escala */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Escala de acordes
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ctrl-m"
                  onClick={() => setUsarAmericano(false)}
                  style={{
                    ...btnPanelStyle, flex: 1,
                    background: !usarAmericano ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${!usarAmericano ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.1)"}`,
                    color: !usarAmericano ? "#93c5fd" : "rgba(255,255,255,0.6)"
                  }}>
                  Latina
                </button>
                <button className="ctrl-m"
                  onClick={() => setUsarAmericano(true)}
                  style={{
                    ...btnPanelStyle, flex: 1,
                    background: usarAmericano ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${usarAmericano ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.1)"}`,
                    color: usarAmericano ? "#93c5fd" : "rgba(255,255,255,0.6)"
                  }}>
                  Americana
                </button>
              </div>
            </div>

            <button className="ctrl-m"
              onClick={() => setPanelAbierto(false)}
              style={{ ...btnPanelStyle, background: "rgba(255,255,255,0.05)", marginTop: 4 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ─────────────────────────────────────────────── */}
      <div
        className="scroll-musicos"
        style={{
          flex: 1,
          overflowY: "auto", overflowX: "hidden",
          scrollbarWidth: "none",
          display: "flex",
          justifyContent: "center",
          alignItems: totalLineasParte <= 6 ? "center" : "flex-start",
          padding: esMovil ? "16px 14px 100px" : "24px 40px 110px",
          boxSizing: "border-box"
        }}
      >
        <div style={{
          width: "100%",
          maxWidth: hayAcordesVisibles ? 1200 : 1000,
          display: "flex", flexDirection: "column",
          alignItems: "center", textAlign: "center"
        }}>
          {bloque.map((linea, i) => (
            <div key={i} style={{
              marginBottom: totalLineasParte <= 4 ? 12 : 8,
              width: "100%",
              display: "flex", flexDirection: "column", alignItems: "center"
            }}>

              {/* Formato corchetes: acordes posicionados sobre la letra */}
              {linea.tipo === "corchete" && (
                <>
                  {mostrarAcordes && (
                    <div style={{
                      position: "relative",
                      minHeight: totalLineasParte <= 4 ? 30 : 24,
                      marginBottom: 4,
                      fontSize: fontSizeAcordes,
                      display: "inline-block",
                      minWidth: `${Math.max((linea.letra || "").length, 1)}ch`,
                      maxWidth: "100%",
                      textAlign: "left"
                    }}>
                      {linea.acordes.map((a: any, j: number) => (
                        <span key={j} style={{ position: "absolute", left: `${a.pos}ch`, top: 0, whiteSpace: "nowrap" }}>
                          {renderAcordeChip(a.acorde, j, totalLineasParte > 4)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{
                    fontSize: fontSizeLetra,
                    lineHeight: totalLineasParte <= 4 ? 1.1 : 1.2,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    textAlign: hayAcordesVisibles ? "left" : "center",
                    display: "inline-block", maxWidth: "100%",
                    fontWeight: 500
                  }}>
                    {linea.letra}
                  </div>
                </>
              )}

              {/* Formato línea: acordes en fila arriba */}
              {linea.tipo === "linea" && (
                <>
                  {mostrarAcordes && renderLineaAcordesChips(linea.acordes)}
                  <div style={{
                    fontSize: fontSizeLetra, lineHeight: totalLineasParte <= 4 ? 1.1 : 1.2,
                    whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "center",
                    fontWeight: 500
                  }}>
                    {linea.letra}
                  </div>
                </>
              )}

              {/* Formato solo: solo letra (o línea de acordes sueltos) */}
              {linea.tipo === "solo" && (
                esAcordeOTextoDeAcordes(linea.letra) && mostrarAcordes
                  ? renderLineaAcordesChips(linea.letra)
                  : (
                    <div style={{
                      fontSize: fontSizeLetra, lineHeight: totalLineasParte <= 4 ? 1.1 : 1.2,
                      whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "center",
                      fontWeight: 500
                    }}>
                      {linea.letra}
                    </div>
                  )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── BARRA INFERIOR FIJA ──────────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        padding: esMovil ? "10px 14px 14px" : "12px 24px 16px",
        background: "rgba(3,8,15,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10
      }}>
        {/* Transposición rápida */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ctrl-m"
            onClick={() => setTransposicion(t => t - 1)}
            style={btnBarraStyle(esMovil)}>
            ▼
          </button>

          <div style={{
            minWidth: esMovil ? 40 : 56, textAlign: "center",
            fontSize: esMovil ? 14 : 16, fontWeight: 800,
            color: transposicion !== 0 ? "#fbbf24" : "rgba(255,255,255,0.5)"
          }}>
            {transposicion > 0 ? "+" : ""}{transposicion}
          </div>

          <button className="ctrl-m"
            onClick={() => setTransposicion(t => t + 1)}
            style={btnBarraStyle(esMovil)}>
            ▲
          </button>
        </div>

        {/* Info centro */}
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: esMovil ? 11 : 13, fontWeight: 700, opacity: 0.7 }}>
            {etiquetaParte}
          </div>
          {tonoMostrado && (
            <div style={{ fontSize: esMovil ? 10 : 12, opacity: 0.45, marginTop: 2 }}>
              🎵 {tonoMostrado}
            </div>
          )}
        </div>

        {/* Acordes toggle + escala */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ctrl-m"
            onClick={() => setMostrarAcordes(v => !v)}
            style={{
              ...btnBarraStyle(esMovil),
              background: mostrarAcordes ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${mostrarAcordes ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: mostrarAcordes ? "#86efac" : "rgba(255,255,255,0.5)",
              fontSize: esMovil ? 13 : 14,
              padding: esMovil ? "9px 10px" : "10px 14px"
            }}>
            🎸
          </button>

          {!esMovil && (
            <button className="ctrl-m"
              onClick={() => setUsarAmericano(v => !v)}
              style={{
                ...btnBarraStyle(false),
                background: usarAmericano ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)",
                color: usarAmericano ? "#93c5fd" : "rgba(255,255,255,0.6)"
              }}>
              {usarAmericano ? "A" : "L"}
            </button>
          )}

          {transposicion !== 0 && (
            <button className="ctrl-m"
              onClick={() => setTransposicion(0)}
              style={{
                ...btnBarraStyle(esMovil),
                background: "rgba(251,191,36,0.15)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: "#fbbf24", fontSize: 11
              }}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const btnBarraStyle = (esMovil: boolean): React.CSSProperties => ({
  padding: esMovil ? "9px 12px" : "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.07)",
  color: "white",
  fontWeight: 800,
  fontSize: esMovil ? 15 : 16,
  cursor: "pointer",
  flexShrink: 0
})

const btnPanelStyle: React.CSSProperties = {
  flex: 1,
  padding: "11px 14px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.07)",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer"
}
