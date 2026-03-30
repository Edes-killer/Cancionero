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

  s.on("cargar-cancion", (data: { partes: any[]; index: number }) => {
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

    

   <div
  key={index}
  style={{
    width: "100vw",
    height: "100vh",
    background: "black",
    color: "white",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: "40px",
    overflow: "hidden"
  }}
>
  {parteActual ? (
    <div style={{ maxWidth: "1200px", width: "100%" }}>
      
      <div style={{
        fontSize: "30px",
        opacity: 0.5,
        marginBottom: "20px"
      }}>
        {parteActual.tipo}
      </div>

      <div
        style={{
          fontSize: "clamp(40px, 6vw, 90px)",
          lineHeight: "1.2",
          whiteSpace: "pre-line",
          wordBreak: "break-word"
        }}
      >
        {parteActual.texto}
      </div>

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