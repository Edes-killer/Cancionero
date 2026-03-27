"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"

export default function ProyectarPage() {
  const [socket, setSocket] = useState<any>(null)
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)
  console.log("RENDER PROYECTOR")

  useEffect(() => {
  setFade(false)

  setTimeout(() => {
    setFade(true)
  }, 100)
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

    

    <div key={index}
  style={{
    width: "100vw",
    height: "100vh",
    background: "radial-gradient(circle, #111 0%, #000 100%)",
    color: "white",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: 40,
    transform: fade ? "translateY(0px)" : "translateY(20px)",
    opacity: fade ? 1 : 0,
    transition: "all 0.5s ease"
    
  }}
>
  {parteActual ? (
    <div style={{ maxWidth: "1000px" }}>
      
      <h2
        style={{
          fontSize:
    partes[index]?.texto?.length > 150
      ? "clamp(25px, 4vw, 60px)"
      : "clamp(40px, 6vw, 100px)",
  textAlign: "center",
  padding: "20px",
  wordBreak: "break-word",
  lineHeight: "1.2",
  maxWidth: "90%",
  margin: "auto"
        }}
      >
        {parteActual.tipo}
      </h2>
        <p >
          {partes[index]?.texto}
        </p>
    </div>
  ) : (
    <h1 style={{ color: "#555" }}>Esperando canción...</h1>
  )}
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