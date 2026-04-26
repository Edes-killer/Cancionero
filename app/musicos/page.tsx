"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"

export default function MusicosPage() {
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [transposicion, setTransposicion] = useState(0)
  const [mostrarAcordes, setMostrarAcordes] = useState(true)
  const [usarAmericano, setUsarAmericano] = useState(false)

  const notasLatinas = [
  "Do", "Do#", "Re", "Re#", "Mi", "Fa",
  "Fa#", "Sol", "Sol#", "La", "La#", "Si"
]
   
  // 🔌 SOCKET
  useEffect(() => {
    const s = io("http://" + window.location.hostname + ":4000")

    s.on("cargar-cancion", (data: any) => {
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


useEffect(() => {
  const check = async () => {
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
      window.location.href = "/login"
    }
  }

  check()
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

const esAcorde = (token: string) => {
  return /^(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)(#|b)?(m|maj|min|sus|dim|aug)?\d*(\/(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B|C|D|E|F|G|A|B)(#|b)?)?$/i.test(token.trim())
}

const esAcordeOTextoDeAcordes = (linea: string) => {
  const tokens = linea
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return false

  return tokens.every((token) => {
    const limpio = token.replace(/[.,;:]+$/g, "")
    return esAcorde(limpio)
  })
}

const transponerLinea = (linea: string, pasos: number) => {
  return linea.replace(/\S+/g, (token) =>
    esAcorde(token) ? transponerAcorde(token, pasos) : token
  )
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

const largoVisualParte = textoLimpio.length

const fontSizeLetra =
  largoVisualParte < 120
    ? "clamp(42px, 6.2vw, 96px)"
    : largoVisualParte < 220
    ? "clamp(34px, 5vw, 76px)"
    : largoVisualParte < 360
    ? "clamp(26px, 3.8vw, 58px)"
    : "clamp(20px, 2.6vw, 42px)"

const fontSizeAcordes =
  largoVisualParte < 120
    ? "clamp(22px, 2.8vw, 34px)"
    : largoVisualParte < 220
    ? "clamp(18px, 2.2vw, 28px)"
    : "clamp(13px, 1.2vw, 18px)"

const tonoMostrado = () => {
  if (!tono) return ""

  const tonoLatino = convertirEscala(tono, false)
  const tonoTranspuesto = transponerAcorde(tonoLatino, transposicion)

  return usarAmericano
    ? convertirEscala(tonoTranspuesto, true)
    : tonoTranspuesto
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
      padding: "24px 32px",
      boxSizing: "border-box"
    }}
  >
    <div
      style={{
        textAlign: "center",
        marginBottom: "18px",
        flexShrink: 0
      }}
    >
      <h1
        style={{
          fontSize: "clamp(26px, 3vw, 42px)",
          margin: 0,
          fontWeight: 700
        }}
      >
        {titulo || "Sin título"}
      </h1>

      <div
        style={{
          fontSize: "clamp(14px, 1.4vw, 20px)",
          opacity: 0.75,
          marginTop: "8px"
        }}
      >
        {tono && `Tono: ${tonoMostrado()}`}
      </div>
    </div>

    <div
  style={{
    flex: 1,
    width: "100%",
    display: "flex",
    justifyContent: "center",
    overflowY: "auto",
    overflowX: "hidden",
    padding: "10px 0 90px 0"
  }}
>
      <div
        style={{
          width: "100%",
          maxWidth: "1100px"
        }}
      >
        {bloque.map((linea, i) => (
          <div
            key={i}
            style={{
              marginBottom: "22px"
            }}
          >
            {linea.tipo === "corchete" && (
            <>
              {mostrarAcordes && (
                <div
                  style={{
                    position: "relative",
                    minHeight: "24px",
                    marginBottom: "4px",
                    fontSize: fontSizeAcordes,
                    color: "#22c55e",
                    fontWeight: 700,
                    fontFamily: "monospace"
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
                      {convertirEscala(
                        transponerAcorde(a.acorde, transposicion),
                        usarAmericano
                      )}
                    </span>
                  ))}
                </div>
              )}

    <div
      style={{
        fontSize: fontSizeLetra,
        lineHeight: 1.1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere"
      }}
    >
      {linea.letra}
    </div>
  </>
)}

{linea.tipo === "linea" && (
  <>
    {mostrarAcordes && (
      <div
        style={{
          color: "#22c55e",
          fontWeight: 700,
          fontSize: fontSizeAcordes,
          marginBottom: "8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          fontFamily: "monospace",
          lineHeight: 1.25
        }}
      >
        {transponerLinea(linea.acordes, transposicion)}
      </div>
    )}

    <div
      style={{
        fontSize: fontSizeLetra,
        lineHeight: 1.1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere"
      }}
    >
      {linea.letra}
    </div>
  </>
)}

            {linea.tipo === "solo" && (
              <div
                style={{
                  fontSize: fontSizeLetra,
                  lineHeight: 1.1,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere"
                }}
              >
                {linea.letra}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    <div
      style={{
        position: "fixed",
        bottom: 18,
        right: 18,
        display: "flex",
        gap: "8px",
        alignItems: "center",
        background: "rgba(20,20,20,0.9)",
        padding: "10px 12px",
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
        {usarAmericano ? "Escala activa: Americana" : "Escala activa: Latina"}
      </button>
    </div>

    <div
      style={{
        position: "fixed",
        bottom: 18,
        left: 18,
        background: "rgba(20,20,20,0.9)",
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)"
      }}
    >
      <button onClick={() => setMostrarAcordes(a => !a)}>
        {mostrarAcordes ? "Ocultar acordes" : "Mostrar acordes"}
      </button>
    </div>
  </div>
)
}