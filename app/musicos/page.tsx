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

  const notasLatinas = [
  "Do", "Do#", "Re", "Re#", "Mi", "Fa",
  "Fa#", "Sol", "Sol#", "La", "La#", "Si"
]
   
  // 🔌 SOCKET
useEffect(() => {
  const s = io("http://" + window.location.hostname + ":4000")

  s.on("connect", async () => {
    const sala = (await getIglesiaId()) || "global"

    console.log("🎹 MÚSICOS conectado a sala:", sala)

    setCargandoMusicos(true)

    s.emit("unirse-sala", { sala, pantalla: "musicos" })
    s.emit("get-estado")

    setTimeout(() => {
      setCargandoMusicos(false)
    }, 1200)
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
    setIndex(data.index || 0)
    setTitulo(data.titulo || "")
    setTono(data.tono || "")
  })

  s.on("cambiar-parte", (i: number) => {
    setIndex(i)
  })

  return () => {
    s.disconnect()
  }
}, [])

  // 🎹 TRANSPOSICIÓN
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

const limpiarTokenAcorde = (token: string) => {
  return (token || "")
    .trim()
    .replace(/[.,;:]+$/g, "")
}

const esAcorde = (token: string) => {
  const t = limpiarTokenAcorde(token)

  return /^((Do|Re|Mi|Fa|Sol|La|Si)|[A-G])(#|b)?(m|maj|min|sus|dim|aug|add|°|ø)?[0-9]*(maj7|m7|sus2|sus4|add9|dim7|m7b5)?(\/((Do|Re|Mi|Fa|Sol|La|Si)|[A-G])(#|b)?)?$/i.test(t)
}

const esAcordeOTextoDeAcordes = (linea: string) => {
  const tokens = (linea || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return false

  return tokens.every((token) => esAcorde(limpiarTokenAcorde(token)))
}

const transponerLinea = (linea: string, pasos: number) => {
  return linea.replace(/\S+/g, (token) => {
    const limpio = limpiarTokenAcorde(token)

    if (!esAcorde(limpio)) return token

    const transpuesto = transponerAcorde(limpio, pasos)

    return token.replace(limpio, transpuesto)
  })
}
  // 🎸 PARSER INTELIGENTE (corchetes + formato iglesia)
const detectarFormato = (texto: string) => {
  const lineas = texto
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())

  const resultado: any[] = []

  for (let i = 0; i < lineas.length; i++) {
    const actual = lineas[i] || ""
    const siguiente = lineas[i + 1] || ""

    if (!actual.trim()) continue

    // 🟢 FORMATO CORCHETES
    if (actual.includes("[")) {
      const acordes: any[] = []
      const letra = actual.replace(/\[(.*?)\]/g, "")

      const regex = /\[(.*?)\]/g
      let match

      while ((match = regex.exec(actual)) !== null) {
        acordes.push({
          acorde: match[1],
          pos: match.index
        })
      }

      resultado.push({
        tipo: "corchete",
        letra,
        acordes
      })
      continue
    }

    // 🔵 FORMATO IGLESIA: línea de acordes arriba + línea de letra abajo
    if (esAcordeOTextoDeAcordes(actual) && siguiente.trim()) {
      resultado.push({
        tipo: "linea",
        acordes: actual,
        letra: siguiente
      })
      i++
      continue
    }

    // ⚪ SOLO TEXTO
    resultado.push({
      tipo: "solo",
      letra: actual
    })
  }

  return resultado
}

const normalizarTextoBase = (texto: string) => {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[0-9]+\.\s*/gm, "")
    .replace(/[¡!¿?.,;:"“”‘’()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

const primeraLineaUtil = (texto: string) => {
  return (texto || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0] || ""
}

const extraerBloqueDesdeTextoCompleto = (textoAcordes: string, textoParte: string) => {
  const lineas = (textoAcordes || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())

  const lineasParte = (textoParte || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  const primeraLineaParte = lineasParte[0] || ""
  const clave = normalizarTextoBase(primeraLineaParte)

  if (!clave) return textoAcordes

  let inicio = -1

  for (let i = 0; i < lineas.length; i++) {
    const actual = normalizarTextoBase(lineas[i])
    if (actual.includes(clave) || clave.includes(actual)) {
      inicio = i
      break
    }
  }

  if (inicio === -1) return textoParte

  // incluir línea anterior si era línea de acordes
  if (inicio > 0 && esAcordeOTextoDeAcordes(lineas[inicio - 1])) {
    inicio = inicio - 1
  }

  const totalLineasLetra = lineasParte.length

  let fin = lineas.length
  let lineasLetraEncontradas = 0

  for (let i = inicio; i < lineas.length; i++) {
    const actual = lineas[i].trim()

    if (!actual) continue

    if (!esAcordeOTextoDeAcordes(actual)) {
      lineasLetraEncontradas++
    }

    if (lineasLetraEncontradas >= totalLineasLetra) {
      fin = i + 1
      break
    }
  }

  // limpieza final: si al final quedó una línea de puros acordes, quitarla
  while (fin > inicio && esAcordeOTextoDeAcordes(lineas[fin - 1] || "")) {
    fin--
  }

  return lineas.slice(inicio, fin).join("\n").trim()
}
 

const convertirEscala = (acorde: string, aAmericano: boolean) => {
  const mapaLatinoAme: Record<string, string> = {
    Do: "C",
    "Do#": "C#",
    Re: "D",
    "Re#": "D#",
    Mi: "E",
    Fa: "F",
    "Fa#": "F#",
    Sol: "G",
    "Sol#": "G#",
    La: "A",
    "La#": "A#",
    Si: "B"
  }

  const mapaAmeLatino: Record<string, string> = {
    C: "Do",
    "C#": "Do#",
    D: "Re",
    "D#": "Re#",
    E: "Mi",
    F: "Fa",
    "F#": "Fa#",
    G: "Sol",
    "G#": "Sol#",
    A: "La",
    "A#": "La#",
    B: "Si"
  }

  const match = acorde.match(/^(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(.*)$/)
  if (!match) return acorde

  const base = match[1]
  const resto = match[2] || ""

  return (aAmericano
    ? (mapaLatinoAme[base] || base)
    : (mapaAmeLatino[base] || base)
  ) + resto
}

const parte = partes[index]

const etiquetaParteMusicos = (() => {
  if (!partes.length) return "Esperando canción"

  const parteActual = partes[index]
  const tipo = parteActual?.tipo || "Parte"

  let nombreParte = tipo

  if (tipo === "Verso") {
    let numeroVerso = 0

    for (let i = 0; i <= index; i++) {
      if (partes[i]?.tipo === "Verso") {
        numeroVerso++
      }
    }

    nombreParte = `Verso ${numeroVerso}`
  }

  return `${nombreParte} • Parte ${index + 1} de ${partes.length}`
})()

const textoLimpio =
  parte?.texto_letra || parte?.texto || ""

const textoAcordesOriginal = parte?.texto_acordes || ""

const textoAcordesLineas = textoAcordesOriginal
  .split(/\r?\n/)
  .map((l: string) => l.trim())
  .filter(Boolean)

const hayLineasDeAcordes = textoAcordesLineas.some((l: string) =>
  esAcordeOTextoDeAcordes(l)
)

const largoTextoLimpio = textoLimpio.trim().length
const largoTextoAcordes = textoAcordesOriginal.trim().length

const acordesParecenCancionCompleta =
  !!textoAcordesOriginal &&
  largoTextoLimpio > 0 &&
  largoTextoAcordes > largoTextoLimpio * 4

const textoFuente =
  parte?.tiene_acordes &&
  !!parte?.texto_acordes &&
  hayLineasDeAcordes
    ? acordesParecenCancionCompleta
      ? extraerBloqueDesdeTextoCompleto(textoAcordesOriginal, textoLimpio)
      : textoAcordesOriginal
    : textoLimpio

const bloque = detectarFormato(textoFuente)
const hayAcordesVisibles =
  mostrarAcordes &&
  bloque.some((linea: any) => linea.tipo === "corchete" || linea.tipo === "linea")
const largoVisualParte = textoLimpio.length
const totalLineasParte = textoLimpio
  .split(/\r?\n/)
  .map((l: string) => l.trim())
  .filter(Boolean).length
const fontSizeLetra =
  largoVisualParte < 90 && totalLineasParte <= 3
    ? "clamp(42px, 5.4vw, 82px)"
    : largoVisualParte < 160 && totalLineasParte <= 4
    ? "clamp(34px, 4.5vw, 64px)"
    : largoVisualParte < 260 && totalLineasParte <= 5
    ? "clamp(26px, 3.3vw, 48px)"
    : largoVisualParte < 420
    ? "clamp(20px, 2.5vw, 36px)"
    : "clamp(16px, 1.8vw, 28px)"

const fontSizeAcordes =
  largoVisualParte < 90 && totalLineasParte <= 3
    ? "clamp(18px, 2.1vw, 28px)"
    : largoVisualParte < 160 && totalLineasParte <= 4
    ? "clamp(16px, 1.8vw, 24px)"
    : largoVisualParte < 260 && totalLineasParte <= 5
    ? "clamp(14px, 1.5vw, 20px)"
    : "clamp(11px, 1vw, 16px)"

const acordeChipStyle = (compacto = false): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: compacto ? "3px 8px" : "4px 10px",
  borderRadius: "999px",
  background: "rgba(34,197,94,0.16)",
  border: "1px solid rgba(34,197,94,0.36)",
  color: "#bbf7d0",
  fontWeight: 900,
  fontSize: fontSizeAcordes,
  fontFamily: "Arial, sans-serif",
  lineHeight: 1,
  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
  whiteSpace: "nowrap"
})

const renderAcordeChip = (acorde: string, key?: any, compacto = false) => {
  const limpio = limpiarTokenAcorde(acorde)

  return (
    <span key={key} style={acordeChipStyle(compacto)}>
      {convertirEscala(
        transponerAcorde(limpio, transposicion),
        usarAmericano
      )}
    </span>
  )
}

const renderLineaAcordesChips = (linea: string) => {
  const tokens = (linea || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: totalLineasParte <= 4 ? "12px" : "8px",
        flexWrap: "wrap",
        marginBottom: "10px",
        maxWidth: "100%"
      }}
    >
      {tokens.map((token, i) =>
        renderAcordeChip(token, i, totalLineasParte > 4)
      )}
    </div>
  )
}

const tonoMostrado = () => {
  if (!tono) return ""

  const tonoLatino = convertirEscala(tono, false)
  const tonoTranspuesto = transponerAcorde(tonoLatino, transposicion)

  return usarAmericano
    ? convertirEscala(tonoTranspuesto, true)
    : tonoTranspuesto
}

if (cargandoMusicos) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(180deg, #020617 0%, #111827 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        boxSizing: "border-box"
      }}
    >
      <div>
        <div
          style={{
            width: "58px",
            height: "58px",
            borderRadius: "999px",
            border: "4px solid rgba(255,255,255,0.14)",
            borderTopColor: "#22c55e",
            margin: "0 auto 18px auto",
            animation: "spinMusicos 0.9s linear infinite"
          }}
        />

        <style>{`
          @keyframes spinMusicos {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div
          style={{
            fontSize: "clamp(26px, 3vw, 46px)",
            fontWeight: 800,
            marginBottom: "8px"
          }}
        >
          Músicos
        </div>

        <div
          style={{
            fontSize: "clamp(15px, 1.5vw, 22px)",
            opacity: 0.7
          }}
        >
          Preparando acordes...
        </div>
      </div>
    </div>
  )
}

if (!partes.length) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background:
          "radial-gradient(circle at 50% 25%, rgba(34,197,94,0.20), transparent 36%), linear-gradient(180deg, #020617 0%, #111827 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        boxSizing: "border-box"
      }}
    >
      <div>
        <div
          style={{
            fontSize: "clamp(30px, 4vw, 64px)",
            fontWeight: 900,
            marginBottom: "10px"
          }}
        >
          Pantalla de Músicos
        </div>

        <div
          style={{
            fontSize: "clamp(16px, 1.6vw, 24px)",
            opacity: 0.72
          }}
        >
          Esperando canción...
        </div>
      </div>
    </div>
  )
}

  return (
  <div
  style={{
    width: "100vw",
    height: "100vh",
    background: "#000",
    color: "white",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "16px 14px",
    boxSizing: "border-box"
  }}
>
<style>{`
  .scroll-musicos::-webkit-scrollbar {
    display: none;
  }
`}</style>
    <div
      style={{
        textAlign: "center",
        marginBottom: "14px",
        flexShrink: 0
      }}
    >
      <h1
        style={{
          fontSize: "clamp(20px, 2.2vw, 32px)",
          margin: 0,
          fontWeight: 800,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
        title={titulo || "Sin título"}
      >
        {titulo || "Sin título"}
      </h1>

      <div
        style={{
          marginTop: "8px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap"
        }}
      >
        <div
          style={{
            padding: "5px 12px",
            borderRadius: "999px",
            background: "rgba(34,197,94,0.14)",
            border: "1px solid rgba(34,197,94,0.28)",
            color: "#bbf7d0",
            fontSize: "clamp(12px, 1vw, 16px)",
            fontWeight: 800
          }}
        >
          {etiquetaParteMusicos}
        </div>

        {tono && (
          <div
            style={{
              padding: "5px 12px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
              fontSize: "clamp(12px, 1vw, 16px)",
              opacity: 0.86,
              fontWeight: 700
            }}
          >
            Tono: {tonoMostrado()}
          </div>
        )}
      </div>
    </div>

    <div
    className="scroll-musicos"
      style={{
        flex: 1,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "8px 0 96px 0",
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}
    >
  <div
  style={{
    width: hayAcordesVisibles ? "92vw" : "88vw",
    maxWidth: hayAcordesVisibles ? "1400px" : "1300px",
    minHeight: "calc(100vh - 190px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    margin: "0 auto"
  }}
>
        {bloque.map((linea, i) => (
          <div
            key={i}
            style={{
              marginBottom: totalLineasParte <= 4 ? "8px" : "12px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            {linea.tipo === "corchete" && (
            <>
              {mostrarAcordes && (
                <div
                  style={{
                   position: "relative",
                    minHeight: totalLineasParte <= 4 ? "30px" : "24px",
                    marginBottom: "4px",
                    fontSize: fontSizeAcordes,
                    color: "#22c55e",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    display: "inline-block",
                    minWidth: `${Math.max((linea.letra || "").length, 1)}ch`,
                    maxWidth: "100%",
                    textAlign: "left"
                  }}
                >
                  {linea.acordes.map((a: any, j: number) => (
                    <span
                      key={j}
                      style={{
                        position: "absolute",
                        left: `${a.pos}ch`,
                        top: 0,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {renderAcordeChip(a.acorde, j, totalLineasParte > 4)}
                    </span>
                  ))}
                </div>
              )}

    <div
      style={{
        fontSize: fontSizeLetra,
        lineHeight: totalLineasParte <= 4 ? 0.96 : 1.02,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        textAlign: hayAcordesVisibles ? "left" : "center",
        display: "inline-block",
        maxWidth: "100%"
      }}
    >
      {linea.letra}
    </div>
  </>
)}

{linea.tipo === "linea" && (
  <>
    {mostrarAcordes && renderLineaAcordesChips(linea.acordes)}

    <div
      style={{
        fontSize: fontSizeLetra,
        lineHeight: totalLineasParte <= 4 ? 0.96 : 1.02,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        textAlign: "center"
      }}
    >
      {linea.letra}
    </div>
  </>
)}

            {linea.tipo === "solo" && (
              esAcordeOTextoDeAcordes(linea.letra) && mostrarAcordes ? (
                renderLineaAcordesChips(linea.letra)
              ) : (
                <div
                  style={{
                    fontSize: fontSizeLetra,
                    lineHeight: totalLineasParte <= 4 ? 0.96 : 1.02,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    textAlign: "center"
                  }}
                >
                  {linea.letra}
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>

    <div
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        display: "flex",
        gap: "8px",
        alignItems: "center",
        background: "rgba(20,20,20,0.9)",
        padding: "8px 10px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)"
      }}
    >
      <button onClick={() => setTransposicion(t => t - 1)}>⬇️</button>
      <button onClick={() => setTransposicion(0)}>Reset</button>
      <button onClick={() => setTransposicion(t => t + 1)}>⬆️</button>
      <button
        onClick={() => setUsarAmericano(v => !v)}
        style={{
          padding: "8px 12px",
          background: "#444",
          color: "white",
          border: "none",
          borderRadius: "6px"
        }}
      >
        {usarAmericano ? "Americana" : "Latina"}
      </button>
    </div>

    <div
      style={{
        position: "fixed",
        bottom: 14,
        left: 14,
        background: "rgba(20,20,20,0.9)",
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)"
      }}
    >
      <button onClick={() => setMostrarAcordes(a => !a)}>
        {mostrarAcordes ? "Acordes: ON" : "Acordes: OFF"}
      </button>
    </div>
  </div>
)
}