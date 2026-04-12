"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "@/lib/supabase"

export default function ProyectarPage() {
  const [socket, setSocket] = useState<any>(null)
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const [titulo, setTitulo] = useState("")
  type BibliaType = {referencia: string,texto: string } | null
  const [biblia, setBiblia] = useState<BibliaType | null>(null)

  const [imagen, setImagen] = useState<string | null>(null)
const [tono, setTono] = useState("")
  console.log("RENDER PROYECTOR")


  
useEffect(() => {
  const check = async () => {
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
      window.location.href = "/login"
    }
  }

  check()
}, [])
  
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
  const prevBodyOverflow = document.body.style.overflow
  const prevHtmlOverflow = document.documentElement.style.overflow
  const prevBodyMargin = document.body.style.margin

  document.body.style.overflow = "hidden"
  document.documentElement.style.overflow = "hidden"
  document.body.style.margin = "0"

  return () => {
    document.body.style.overflow = prevBodyOverflow
    document.documentElement.style.overflow = prevHtmlOverflow
    document.body.style.margin = prevBodyMargin
  }
}, [])

useEffect(() => {
  const s = io("http://" + window.location.hostname + ":4000")

  s.on("cargar-cancion", (data) => {
  setBiblia(null)
  setImagen(null)
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
const limpiarAcordes = (texto: string) => {
  return texto.replace(/\[(.*?)\]/g, "")
}

useEffect(() => {
  if (!socket) return

  const handler = (data: any) => {
    limpiarPantalla()
    setBiblia(data)
  }

  socket.on("mostrar-biblia", handler)

  return () => {
    socket.off("mostrar-biblia", handler)
  }
}, [socket])

useEffect(() => {
  if (!socket) return

  const handler = (data: any) => {
    limpiarPantalla()
    setImagen(data.url)
  }

  socket.on("mostrar-imagen", handler)

  return () => {
    socket.off("mostrar-imagen", handler)
  }
}, [socket])

const limpiarPantalla = () => {
  setBiblia(null)
  setImagen(null)
  setPartes([])
  setTitulo("")
  setTono("")
  setIndex(0)
}

const limpiarTextoProyeccion = (texto: string) => {
  return texto
    .replace(/\[(.*?)\]/g, "")
    .replace(/\/n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

  return (
  <div
    style={{
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#000",
      color: "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "fixed",
      inset: 0,
      padding: 0,
      margin: 0
    }}
  >
    {/* IMAGEN */}
    {imagen && (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "black"
        }}
      >
        <img
          src={imagen}
          alt="Proyección"
          style={{
            width: "100vw",
            height: "100vh",
            objectFit: "contain",
            display: "block",
            background: "black"
          }}
        />
      </div>
    )}

    {/* BIBLIA */}
    {!imagen && biblia && (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4vh 5vw",
          boxSizing: "border-box",
          gap: "2vh",
          textAlign: "center"
        }}
      >
        <div
          style={{
            fontSize: "clamp(24px, 3vw, 46px)",
            fontWeight: 700,
            opacity: 0.95
          }}
        >
          {biblia.referencia}
        </div>

        <div
          style={{
            maxWidth: "92vw",
            maxHeight: "78vh",
            overflow: "hidden",
            fontSize:
              limpiarTextoProyeccion(biblia.texto).length > 1800
                ? "clamp(16px, 1.8vw, 26px)"
                : limpiarTextoProyeccion(biblia.texto).length > 1200
                ? "clamp(18px, 2vw, 30px)"
                : limpiarTextoProyeccion(biblia.texto).length > 700
                ? "clamp(22px, 2.5vw, 38px)"
                : limpiarTextoProyeccion(biblia.texto).length > 350
                ? "clamp(28px, 3vw, 48px)"
                : "clamp(36px, 4.5vw, 72px)",
            lineHeight: 1.35,
            wordBreak: "break-word",
            textAlign: "center"
          }}
        >
          {limpiarTextoProyeccion(biblia.texto)}
        </div>
      </div>
    )}

    {/* CANCIÓN */}
    {!imagen && !biblia && (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "3vh 4vw",
          boxSizing: "border-box",
          textAlign: "center"
        }}
      >
        <div
          style={{
            fontSize: "clamp(18px, 2vw, 30px)",
            opacity: 0.85,
            minHeight: "40px"
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            flex: 1,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "0 2vw"
          }}
        >
          <div
            style={{
              maxWidth: "92vw",
              maxHeight: "72vh",
              overflow: "hidden",
              fontSize:
                limpiarTextoProyeccion(parteActual?.texto || "").length > 500
                  ? "clamp(22px, 2.5vw, 40px)"
                  : limpiarTextoProyeccion(parteActual?.texto || "").length > 250
                  ? "clamp(28px, 3.4vw, 56px)"
                  : "clamp(40px, 5vw, 90px)",
              lineHeight: 1.25,
              wordBreak: "break-word",
              whiteSpace: "normal"
            }}
          >
            {limpiarTextoProyeccion(parteActual?.texto || "")}
          </div>
        </div>

        <div
          style={{
            fontSize: "clamp(16px, 1.8vw, 24px)",
            opacity: 0.75,
            minHeight: "32px"
          }}
        >
          {tono && `Tono: ${tono}`}
        </div>
      </div>
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