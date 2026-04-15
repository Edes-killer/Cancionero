"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "@/lib/supabase"

export default function ProyectarPage() {
  const [socket, setSocket] = useState<any>(null)
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [biblia, setBiblia] = useState<any>(null)
  const [imagen, setImagen] = useState<string | null>(null)
  const [tono, setTono] = useState("")
  const [paginaBiblia, setPaginaBiblia] = useState(0)
  const [iglesia, setIglesia] = useState("")
  const parteActual = partes[index]

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

  s.on("cargar-cancion", (data: any) => {
  setBiblia(null)
  setImagen(null)
  setPartes(data.partes || [])
  setIndex(data.index || 0)
  setTitulo(data.titulo || "")
  setTono(data.tono || "")
  setIglesia(data.iglesia || "")
  setPaginaBiblia(0)
})

  s.on("cambiar-parte", (i: number) => {
    setIndex(i)
  })

  s.on("mostrar-biblia", (data: any) => {
  limpiarPantalla()
  setBiblia(data)
  setIglesia(data.iglesia || "")
  setPaginaBiblia(data.pagina || 0)
})

  s.on("cambiar-pagina-biblia", (pagina: number) => {
    setPaginaBiblia(pagina)
  })

  s.on("mostrar-imagen", (data: any) => {
  limpiarPantalla()
  setImagen(data.url)
  setIglesia(data.iglesia || "")
})

  setSocket(s)

  return () => {
    s.disconnect()
  }
}, [])

useEffect(() => {
  if (!socket) return

  const handler = (e: KeyboardEvent) => {
    if (
      e.key === "ArrowRight" ||
      e.key === "ArrowDown" ||
      e.key === "PageDown" ||
      e.key === " "
    ) {
      e.preventDefault()
      console.log("TECLA -> siguiente")
      socket.emit("control-siguiente")
    }

    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp" ||
      e.key === "PageUp"
    ) {
      e.preventDefault()
      console.log("TECLA -> anterior")
      socket.emit("control-anterior")
    }
  }

  window.addEventListener("keydown", handler)
  return () => {
    window.removeEventListener("keydown", handler)
  }
}, [socket])

    const limpiarPantalla = () => {
  setBiblia(null)
  setImagen(null)
  setPartes([])
  setTitulo("")
  setTono("")
  setIglesia("")
  setIndex(0)
  setPaginaBiblia(0)
}

  const limpiarTextoProyeccion = (texto: string) => {
    return (texto || "")
      .replace(/\[(.*?)\]/g, "")
      .replace(/\/n/g, " ")
      .replace(/\\n/g, " ")
      .replace(/\r?\n|\r/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  const textoBibliaActual = limpiarTextoProyeccion(
    biblia?.paginas?.[paginaBiblia] || biblia?.texto || ""
  )

  const textoCancionActual = limpiarTextoProyeccion(parteActual?.texto || "")

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
      {imagen && (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000"
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
              background: "#000"
            }}
          />
        </div>
      )}

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
                textoBibliaActual.length > 1800
                  ? "clamp(16px, 1.8vw, 26px)"
                  : textoBibliaActual.length > 1200
                  ? "clamp(18px, 2vw, 30px)"
                  : textoBibliaActual.length > 700
                  ? "clamp(22px, 2.5vw, 38px)"
                  : textoBibliaActual.length > 350
                  ? "clamp(28px, 3vw, 48px)"
                  : "clamp(36px, 4.5vw, 72px)",
              lineHeight: 1.35,
              wordBreak: "break-word",
              textAlign: "center"
            }}
          >
            {textoBibliaActual}
          </div>
          {iglesia && (
            <div
              style={{
                fontSize: "clamp(14px, 1.5vw, 20px)",
                opacity: 0.6,
                marginTop: "10px"
              }}
            >
              {iglesia}
            </div>
          )}
        </div>
      )}

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
                  textoCancionActual.length > 500
                    ? "clamp(22px, 2.5vw, 40px)"
                    : textoCancionActual.length > 250
                    ? "clamp(28px, 3.4vw, 56px)"
                    : "clamp(40px, 5vw, 90px)",
                lineHeight: 1.25,
                wordBreak: "break-word",
                whiteSpace: "normal"
              }}
            >
              {textoCancionActual}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              minHeight: "48px"
            }}
          >
            <div
              style={{
                fontSize: "clamp(16px, 1.8vw, 24px)",
                opacity: 0.8
              }}
            >
              {tono && `Tono: ${tono}`}
            </div>

            <div
              style={{
                fontSize: "clamp(14px, 1.5vw, 20px)",
                opacity: 0.6
              }}
            >
              {iglesia}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}