"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"

export default function MusicosPage() {
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [transposicion, setTransposicion] = useState(0)
  const [mostrarAcordes, setMostrarAcordes] = useState(true)
  const [usarAmericano, setUsarAmericano] = useState(false)

  const notas = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

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

  // 🎹 TRANSPOSICIÓN
  const transponerAcorde = (acorde: string, pasos: number) => {
    const match = acorde.match(/^([A-G]#?)(m?)/)
    if (!match) return acorde

    const base = match[1]
    const tipo = match[2] || ""

    const index = notas.indexOf(base)
    if (index === -1) return acorde

    const nuevo = (index + pasos + 12) % 12

    return notas[nuevo] + tipo
  }

 const transponerLinea = (linea: string, pasos: number) => {
  return linea
    .split(" ")
    .map(acorde => {
      const transpuesto = transponerAcorde(acorde, pasos)
      return convertirEscala(transpuesto, usarAmericano)
    })
    .join(" ")
}
  // 🎸 PARSER INTELIGENTE (corchetes + formato iglesia)
  const detectarFormato = (texto: string) => {
    const lineas = texto.split("\n")
    const resultado: any[] = []

    for (let i = 0; i < lineas.length; i++) {
      const actual = lineas[i]
      const siguiente = lineas[i + 1]

      // 🟢 FORMATO CORCHETES
      if (actual.includes("[")) {
        const acordes: any[] = []
        let letra = actual.replace(/\[(.*?)\]/g, "")

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

      // 🔵 FORMATO IGLESIA (línea arriba)
      if (
        actual.match(/(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)/) &&
        siguiente &&
        !siguiente.match(/(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)/)
      ) {
        resultado.push({
          tipo: "linea",
          acordes: actual,
          letra: siguiente
        })
        i++
      } else {
        resultado.push({
          tipo: "solo",
          letra: actual
        })
      }
    }

    return resultado
  }

  const convertirEscala = (acorde: string, aAmericano: boolean) => {
  const mapaLatinoAme: any = {
    Do: "C", Re: "D", Mi: "E", Fa: "F",
    Sol: "G", La: "A", Si: "B"
  }

  const mapaAmeLatino: any = {
    C: "Do", D: "Re", E: "Mi", F: "Fa",
    G: "Sol", A: "La", B: "Si"
  }

  const match = acorde.match(/^(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)(.*)$/)

  if (!match) return acorde

  let base = match[1]
  const resto = match[2]

  if (aAmericano) {
    base = mapaLatinoAme[base] || base
  } else {
    base = mapaAmeLatino[base] || base
  }

  return base + resto
}

  const parte = partes[index]
  const bloque = detectarFormato(parte?.texto || "")

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "40px"
      }}
    >
      {/* 🎵 HEADER */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "40px", marginBottom: "10px" }}>
          {titulo || "Sin título"}
        </h1>

        <div style={{ fontSize: "20px", opacity: 0.7 }}>
          {tono && `Tono: ${tono}`}
        </div>
      </div>

      {/* 🎤 CONTENIDO */}
      <div  style={{width: "100%",maxWidth: "1000px",padding: "0 10px"}}>
        {bloque.map((linea, i) => (
          <div key={i} style={{ marginBottom: 30 }}>

            {/* 🟢 FORMATO CORCHETES */}
            {linea.tipo === "corchete" && (
              <>
                {/* ACORDES */}
                {mostrarAcordes && (
                  <div style={{ position: "relative", height: 30 }}>
                    {linea.acordes.map((a: any, j: number) => (
                      <span
                        key={j}
                        style={{
                          position: "absolute",
                          left: `${a.pos * 0.8}ch`,
                          color: "#22c55e",
                          fontWeight: "bold"
                        }}
                      >
                        {convertirEscala(transponerAcorde(a.acorde, transposicion),  usarAmericano)}
                      </span>
                    ))}
                  </div>
                )}

                {/* LETRA */}
                <div style={{ fontSize: "clamp(28px, 6vw, 70px)" }}>
                  {linea.letra}
                </div>
              </>
            )}

            {/* 🔵 FORMATO IGLESIA */}
            {linea.tipo === "linea" && (
              <>
                {mostrarAcordes && (
                  <div
                    style={{
                      color: "#22c55e",
                      fontWeight: "bold",
                      fontSize: "clamp(20px, 4vw, 28px)" // acordes
                    }}
                  >
                    {transponerLinea(linea.acordes, transposicion)
                      .split(" ")
                      .map((a, i) => (
                        <span key={i} style={{ marginRight: "12px" }}>
                          {a}
                        </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: "clamp(35px, 5vw, 70px)" }}>
                  {linea.letra}
                </div>
              </>
            )}

            {/* ⚪ SOLO TEXTO */}
            {linea.tipo === "solo" && (
              <div style={{ fontSize: "clamp(35px, 5vw, 70px)" }}>
                {linea.letra}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 🎛️ CONTROLES */}
      <div style={{ position: "fixed", bottom: 20, right: 20 }}>
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
            borderRadius: "6px",
            marginLeft: "10px"
          }}
        >
          {usarAmericano ? "Escala: Americana (C D E)" : "Escala: Latina (Do Re Mi)"}
</button>
      </div>

      {/* TOGGLE */}
      <div style={{ position: "fixed", bottom: 20, left: 20 }}>
        <button onClick={() => setMostrarAcordes(a => !a)}>
          {mostrarAcordes ? "Ocultar acordes" : "Mostrar acordes"}
        </button>
      </div>
    </div>
  )
}