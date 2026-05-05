"use client"

import { useEffect, useRef, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "../../lib/getIglesia"

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
  const [estadoEspecial, setEstadoEspecial] = useState<any>(null)
  const [fondoCancion, setFondoCancion] = useState<any>(null)
  const [cargandoProyector, setCargandoProyector] = useState(true)
  const timeoutCargaProyectorRef = useRef<any>(null)
  const [estadoInicialRevisado, setEstadoInicialRevisado] = useState(false)
  const parteActual = partes[index]
  const [imagenesPrecargadas, setImagenesPrecargadas] = useState<string[]>([])
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayFadingOut, setOverlayFadingOut] = useState(false)
  const overlayTimeoutRef = useRef<any>(null)

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

const ejecutarConTransicion = (accion: () => void) => {
  if (overlayTimeoutRef.current) {
    clearTimeout(overlayTimeoutRef.current)
  }

  // 1. negro instantáneo
  setOverlayVisible(true)
  setOverlayFadingOut(false)

  // 2. esperar a que el negro realmente se pinte
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // 3. cambiar contenido detrás del negro
      accion()

      // 4. empezar fade-out
      overlayTimeoutRef.current = setTimeout(() => {
        setOverlayFadingOut(true)

        // 5. ocultar overlay al terminar transición
        overlayTimeoutRef.current = setTimeout(() => {
          setOverlayVisible(false)
          setOverlayFadingOut(false)
        }, 220)
      }, 40)
    })
  })
}

 useEffect(() => {
  const s = io("http://" + window.location.hostname + ":4000", {
    
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  })
  
s.on("connect", async () => {
  const sala = (await getIglesiaId()) || "global"

  console.log("🖥️ PROYECTOR conectado a sala:", sala)

  setCargandoProyector(true)
  setEstadoInicialRevisado(false)

  s.emit("unirse-sala", { sala })
  s.emit("get-estado")

  if (timeoutCargaProyectorRef.current) {
    clearTimeout(timeoutCargaProyectorRef.current)
  }

  timeoutCargaProyectorRef.current = setTimeout(() => {
    setEstadoInicialRevisado(true)
    setCargandoProyector(false)
  }, 1800)
})

  // 🔥 RECIBIR ESTADO INICIAL
s.on("estado-actual", (estado: any) => {
  setEstadoInicialRevisado(true)
  setCargandoProyector(false)

  if (timeoutCargaProyectorRef.current) {
    clearTimeout(timeoutCargaProyectorRef.current)
  }

  console.log("📺 estado recibido:", estado)

  if (estado.tipo === "cancion") {
    const data = estado.data || {}

    setEstadoEspecial(null)
    setBiblia(null)
    setImagen(null)

    if (data.fondo?.url) {
      precargarImagen(data.fondo.url)
    }

    setFondoCancion(data.fondo || null)
    setPartes(data.partes || [])
    setIndex(data.index || 0)
    setTitulo(data.titulo || "")
    setTono(data.tono || "")
    setIglesia(data.iglesia || "")
    setPaginaBiblia(0)
    return
  }

  if (estado.tipo === "imagen") {
    const data = estado.data || {}

    limpiarPantalla()

    if (data?.url) {
      precargarImagen(data.url)
    }

    setImagen(data.url)
    setIglesia(data.iglesia || "")
    return
  }

  if (estado.tipo === "biblia") {
    const data = estado.data || {}

    limpiarPantalla()
    setBiblia(data)
    setIglesia(data.iglesia || "")
    setPaginaBiblia(data.pagina || 0)
    return
  }

  if (estado.tipo === "estado") {
    const data = estado.data || {}

    limpiarPantalla()
    setEstadoEspecial(data)
    return
  }
})
  // 🔥 TUS EVENTOS EXISTENTES (SE DEJAN TAL CUAL)
  s.on("cargar-cancion", (data: any) => {
  setEstadoInicialRevisado(true)
  setCargandoProyector(false)
  ejecutarConTransicion(() => {
    setEstadoEspecial(null)
    setBiblia(null)
    setImagen(null)

    if (data.fondo?.url) {
      precargarImagen(data.fondo.url)
    }

    setFondoCancion(data.fondo || null)
    setPartes(data.partes || [])
    setIndex(data.index || 0)
    setTitulo(data.titulo || "")
    setTono(data.tono || "")
    setIglesia(data.iglesia || "")
    setPaginaBiblia(0)
  })
})

  s.on("mostrar-imagen", (data: any) => {
    setEstadoInicialRevisado(true)
    setCargandoProyector(false)
    ejecutarConTransicion(() => {
      limpiarPantalla()
      if (data?.url) {
        precargarImagen(data.url)
      }
      setImagen(data.url)
      setIglesia(data.iglesia || "")
    })
  })

  s.on("mostrar-biblia", (data: any) => {
    setEstadoInicialRevisado(true)
    setCargandoProyector(false)
    ejecutarConTransicion(() => {
      limpiarPantalla()
      setBiblia(data)
      setIglesia(data.iglesia || "")
      setPaginaBiblia(data.pagina || 0)
    })
  })

  s.on("cambiar-parte", (i: number) => {
    
    ejecutarConTransicion(() => {
      setEstadoEspecial(null)
      setIndex(i)
    })
  })

  s.on("cambiar-pagina-biblia", (pagina: number) => {
    ejecutarConTransicion(() => {
      setEstadoEspecial(null)
      setPaginaBiblia(pagina)
    })
  })

  s.on("precargar-imagenes", (urls: string[]) => {
    ;(urls || []).forEach((url) => {
      if (url) precargarImagen(url)
    })
  })

  s.on("mostrar-estado", (data: any) => {
    setEstadoInicialRevisado(true)
    setCargandoProyector(false)
    ejecutarConTransicion(() => {
      limpiarPantalla()
      setEstadoEspecial(data)
    })
  })

  setSocket(s)

  return () => {
    if (timeoutCargaProyectorRef.current) {
      clearTimeout(timeoutCargaProyectorRef.current)
    }

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
  setEstadoEspecial(null)
  setBiblia(null)
  setImagen(null)
  setFondoCancion(null)
  setPartes([])
  setTitulo("")
  setTono("")
  setIglesia("")
  setIndex(0)
  setPaginaBiblia(0)
  
}

const esAcordeProyeccion = (token: string) => {
  return /^(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)(#|b)?(m|maj|min|sus|dim|aug)?\d*(\/(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)(#|b)?)?$/i.test(
    token.trim()
  )
}

const detectarFormatoProyeccion = (texto: string) => {
  const lineas = (texto || "").split(/\r?\n/)
  const resultado: { tipo: "solo" | "linea" | "corchete"; letra: string }[] = []

  for (let i = 0; i < lineas.length; i++) {
    const actual = lineas[i]
    const siguiente = lineas[i + 1]

    if (actual.includes("[")) {
      resultado.push({
        tipo: "corchete",
        letra: actual.replace(/\[(.*?)\]/g, "").trim()
      })
      continue
    }

    if (
      actual.trim() &&
      actual.trim().split(/\s+/).every(esAcordeProyeccion) &&
      siguiente
    ) {
      resultado.push({
        tipo: "linea",
        letra: siguiente.trim()
      })
      i++
      continue
    }

    resultado.push({
      tipo: "solo",
      letra: actual.trim()
    })
  }

  return resultado
}

const limpiarCancionParaProyector = (texto: string) => {
  return detectarFormatoProyeccion(texto)
    .map((b) =>
      (b.letra || "")
        .replace(/\/n/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
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

  const textoCancionActual = limpiarCancionParaProyector(
  parteActual?.texto_letra || parteActual?.texto || ""
)
  const etiquetaParteActual = (() => {
    if (!parteActual?.tipo) return ""

    if (parteActual.tipo === "Verso") {
      let numero = 0

      for (let i = 0; i <= index; i++) {
        if (partes[i]?.tipo === "Verso") {
          numero++
        }
      }

      return `Verso ${numero}`
    }

    if (parteActual.tipo === "Coro") {
      return "Coro"
    }

    if (parteActual.tipo === "Puente") {
      return "Puente"
    }

    return parteActual.tipo
  })()

  const precargarImagen = (url: string) => {
  if (!url || imagenesPrecargadas.includes(url)) return

  const img = new Image()
  img.src = url

    img.onload = () => {
      setImagenesPrecargadas(prev =>
        prev.includes(url) ? prev : [...prev, url]
      )
    }
  }
const hayContenidoProyector =
  !!estadoEspecial ||
  !!imagen ||
  !!biblia ||
  partes.length > 0 ||
  !!titulo

if (cargandoProyector) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        inset: 0,
        overflow: "hidden"
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "32px",
          borderRadius: "24px",
          background: "rgba(15,23,42,0.82)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          minWidth: "320px"
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "999px",
            border: "4px solid rgba(255,255,255,0.15)",
            borderTopColor: "#38bdf8",
            margin: "0 auto 20px auto",
            animation: "spinProyector 0.9s linear infinite"
          }}
        />

        <style>{`
          @keyframes spinProyector {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div
          style={{
            fontSize: "clamp(28px, 3vw, 48px)",
            fontWeight: 800,
            marginBottom: "10px"
          }}
        >
          Proyector
        </div>

        <div
          style={{
            fontSize: "clamp(16px, 1.6vw, 24px)",
            opacity: 0.72
          }}
        >
          Preparando proyección...
        </div>
      </div>
    </div>
  )
}

if (estadoInicialRevisado && !hayContenidoProyector) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background:
          "radial-gradient(circle at 50% 25%, rgba(37,99,235,0.28), transparent 35%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        textAlign: "center",
        padding: "5vw",
        boxSizing: "border-box"
      }}
    >
      <div>
        <div
          style={{
            fontSize: "clamp(34px, 5vw, 82px)",
            fontWeight: 900,
            marginBottom: "14px"
          }}
        >
          Cancionero Cristiano
        </div>

        <div
          style={{
            fontSize: "clamp(18px, 2vw, 32px)",
            opacity: 0.72
          }}
        >
          Esperando proyección...
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
        margin: 0,

      }}
    >
      <style>{`
        @keyframes fondoCancionMovimiento {
          0% {
            transform: scale(1.04) translate3d(0, 0, 0);
          }
          50% {
            transform: scale(1.12) translate3d(-1.8%, -1.2%, 0);
          }
          100% {
            transform: scale(1.04) translate3d(0, 0, 0);
          }
        }
      `}</style>

      {!estadoEspecial && !imagen && !biblia && fondoCancion?.tipo === "preset" && (
  <>
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: fondoCancion.fondoCss,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        zIndex: 0
      }}
    />

    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: `rgba(0,0,0,${(fondoCancion.oscuridad ?? 55) / 100})`,
        zIndex: 1
      }}
    />
  </>
)}

        {!estadoEspecial &&
          !imagen &&
          !biblia &&
          fondoCancion &&
          fondoCancion.tipo !== "preset" &&
          fondoCancion.url && (
            <>
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundImage: `url(${fondoCancion.url})`,
                  backgroundSize: fondoCancion.ajuste || "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundColor: "#000",
                  transform:
                  fondoCancion.tipo === "movimiento"
                    ? "scale(1.04)"
                    : "none",
                animation:
                  fondoCancion.tipo === "movimiento"
                    ? "fondoCancionMovimiento 45s ease-in-out infinite"
                    : "none",
                willChange:
                  fondoCancion.tipo === "movimiento"
                    ? "transform"
                    : "auto",
                  zIndex: 0
                }}
              />

              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: `rgba(0,0,0,${(fondoCancion.oscuridad ?? 55) / 100})`,
                  zIndex: 1
                }}
              />
            </>
          )}
              {estadoEspecial?.tipo === "negro" && (
          <div
            style={{
              width: "100vw",
              height: "100vh",
              background: "#000"
            }}
          />
        )}

        {estadoEspecial?.tipo === "espera" && (
          <div
            style={{
              width: "100vw",
              height: "100vh",
              background: "#000",
              color: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "4vh 5vw",
              boxSizing: "border-box",
              gap: "18px"
            }}
          >
            <div
              style={{
                fontSize: "clamp(34px, 4vw, 64px)",
                fontWeight: 700
              }}
            >
              {estadoEspecial.titulo || "Espere un momento"}
            </div>

            {!!estadoEspecial.subtitulo && (
              <div
                style={{
                  fontSize: "clamp(18px, 2vw, 28px)",
                  opacity: 0.7
                }}
              >
                {estadoEspecial.subtitulo}
              </div>
            )}
          </div>
        )}
      {!estadoEspecial && imagen && (
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

      {!estadoEspecial && !imagen && biblia && (
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

      {!estadoEspecial && !imagen && !biblia && (
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
          textAlign: "center",
          position: "relative",
          zIndex: 2
        }}
      >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              minHeight: "64px"
            }}
          >
            <div
              style={{
                fontSize: "clamp(18px, 2vw, 30px)",
                opacity: 0.85
              }}
            >
              {titulo}
            </div>

            {!!etiquetaParteActual && (
              <div
                style={{
                  fontSize: "clamp(16px, 1.8vw, 24px)",
                  opacity: 0.65,
                  fontWeight: 700
                }}
              >
                {etiquetaParteActual}
              </div>
            )}
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
                  textoCancionActual.length > 1000
                    ? "clamp(12px, 1.2vw, 20px)"
                    : textoCancionActual.length > 800
                    ? "clamp(14px, 1.4vw, 24px)"
                    : textoCancionActual.length > 600
                    ? "clamp(16px, 1.8vw, 28px)"
                    : textoCancionActual.length > 420
                    ? "clamp(20px, 2.2vw, 34px)"
                    : textoCancionActual.length > 260
                    ? "clamp(24px, 2.8vw, 42px)"
                    : "clamp(34px, 4vw, 72px)",
                lineHeight: 1.08,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                whiteSpace: "pre-line",
                textAlign: "center"
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

      {estadoEspecial?.tipo === "mensaje" && (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000",
          color: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "4vh 5vw",
          boxSizing: "border-box",
          gap: "18px"
        }}
      >
        <div
          style={{
            fontSize:
              (estadoEspecial.titulo || "").length > 180
                ? "clamp(20px, 2.2vw, 34px)"
                : (estadoEspecial.titulo || "").length > 90
                ? "clamp(28px, 3vw, 50px)"
                : "clamp(42px, 5vw, 90px)",
            fontWeight: 700,
            lineHeight: 1.15,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            whiteSpace: "pre-line",
            maxWidth: "92vw"
          }}
        >
          {estadoEspecial.titulo}
        </div>

        {!!estadoEspecial.subtitulo && (
          <div
            style={{
              fontSize: "clamp(18px, 2vw, 28px)",
              opacity: 0.7
            }}
          >
            {estadoEspecial.subtitulo}
          </div>
        )}
      </div>
    )}
    {estadoEspecial?.tipo === "logo" && (
  <div
    style={{
      width: "100vw",
      height: "100vh",
      background: "#000",
      color: "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "4vh 5vw",
      boxSizing: "border-box",
      gap: "24px"
    }}
  >
    <img
      src={estadoEspecial.url}
      alt="Logo espera"
      style={{
        maxWidth: "40vw",
        maxHeight: "40vh",
        objectFit: "contain"
      }}
    />

    {!!estadoEspecial.titulo && (
      <div
        style={{
          fontSize: "clamp(28px, 3vw, 48px)",
          fontWeight: 700
        }}
      >
        {estadoEspecial.titulo}
      </div>
    )}

    {!!estadoEspecial.subtitulo && (
      <div
        style={{
          fontSize: "clamp(18px, 2vw, 28px)",
          opacity: 0.7
        }}
      >
        {estadoEspecial.subtitulo}
      </div>
    )}
  </div>
)}
    {overlayVisible && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      pointerEvents: "none",
      opacity: overlayFadingOut ? 0 : 1,
      transition: overlayFadingOut ? "opacity 220ms ease-in-out" : "none",
      zIndex: 9999
    }}
  />
)}
    </div>
  )
}