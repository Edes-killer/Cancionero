"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"

export default function MusicosPage() {
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")

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

  // 🎸 PARSER DE ACORDES
  const parseLinea = (texto: string) => {
    const regex = /\[(.*?)\]/g
    const resultado = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(texto)) !== null) {
      const acorde = match[1]
      const index = match.index

      resultado.push({
        texto: texto.slice(lastIndex, index),
        acorde
      })

      lastIndex = regex.lastIndex
    }

    resultado.push({
      texto: texto.slice(lastIndex),
      acorde: null
    })

    return resultado
  }

  const parte = partes[index]

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

      {/* 🎤 LETRA + ACORDES */}
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          textAlign: "center",
          fontSize: "clamp(28px, 4vw, 60px)",
          lineHeight: "1.6"
        }}
      >
        {(parte?.texto || "").split("\n").map((linea: string, idx: number) => (
          <div key={idx} style={{ marginBottom: "20px" }}>
            {parseLinea(linea).map((item, i) => (
              <span
                key={i}
                style={{
                  position: "relative",
                  display: "inline-block",
                  marginRight: "8px"
                }}
              >
                {/* 🎸 ACORDE */}
                {item.acorde && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-25px",
                      left: "0",
                      fontSize: "16px",
                      color: "#22c55e",
                      fontWeight: "bold",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {item.acorde}
                  </div>
                )}

                {/* 🎤 TEXTO */}
                {item.texto}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* 👇 ESPACIO ABAJO */}
      <div />
    </div>
  )
}