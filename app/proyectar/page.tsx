"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"

export default function ProyectarPage() {
  const [socket, setSocket] = useState<any>(null)
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const [titulo, setTitulo] = useState("")
const [tono, setTono] = useState("")
  console.log("RENDER PROYECTOR")

useEffect(() => {
  setFade(false)

  const t = setTimeout(() => {
    setFade(true)
  }, 50)

  return () => clearTimeout(t)
}, [index])



useEffect(() => {
  const entrarFullscreen = () => {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
    }
  }

  document.addEventListener("click", entrarFullscreen)

  return () => {
    document.removeEventListener("click", entrarFullscreen)
  }
}, [])

useEffect(() => {
  const s = io("http://" + window.location.hostname + ":4000")

  s.on("cargar-cancion", (data) => {
  setPartes(data.partes || [])
  setIndex(data.index || 0)
  setTitulo(data.titulo || "")
  setTono(data.tono || "")
})

  s.on("cambiar-parte", (i) => {
    setIndex(i)
  })
  setSocket(s)
  return () => {
    s.disconnect()   // ✅ IMPORTANTE
  }

  
}, [])
const parteActual = partes[index]
  return (

    

   <div
  style={{
    width: "100vw",
    height: "100vh",
    background: "radial-gradient(circle, #111 0%, #000 100%)",
    color: "white",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "40px 20px",
    textAlign: "center"
  }}
>
  {/* 🔝 TÍTULO */}
  <div style={{ fontSize: "clamp(20px, 2vw, 30px)", opacity: 0.8 }}>
    {titulo}
  </div>

  {/* 🎵 LETRA */}
  <div
    style={{
      fontSize: partes[index]?.texto?.length > 300
        ? "clamp(20px, 3vw, 50px)"
        : partes[index]?.texto?.length > 150
        ? "clamp(30px, 4vw, 70px)"
        : "clamp(40px, 6vw, 100px)",
      lineHeight: "1.3",
      whiteSpace: "pre-line",
      wordBreak: "break-word",
      maxWidth: "90%"
    }}
  >
    {partes[index]?.texto}
  </div>

  {/* 🔻 TONO */}
  <div style={{ fontSize: "clamp(18px, 2vw, 25px)", opacity: 0.7 }}>
    {tono && `Tono: ${tono}`}
  </div>
</div>
  
    
  )

}




const container = {
  background: "black",
  color: "white",
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center" as const,
  padding: "40px 20px",
  overflow: "hidden"   // 🔥 IMPORTANTE
}



const tipo = {
  fontSize: "20px",
  opacity: 0.6,
  marginBottom: 20
}

const fade = {
  animation: "fade 0.4s ease-in-out",
  transition: "all 0.3s"
}