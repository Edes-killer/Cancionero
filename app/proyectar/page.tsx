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
  const [logoMarcaUrl, setLogoMarcaUrl] = useState("")
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

  s.emit("unirse-sala", { sala, pantalla: "proyectar" })
  setTimeout(() => {
    s.emit("get-estado")
  }, 150)

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
    setLogoMarcaUrl(data.logo_marca_url || "")
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
      setLogoMarcaUrl(data.logo_marca_url || "")
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

const limpiarHTMLProyeccion = (texto: string) => {
  return (texto || "")
    // quitar bloques completos de autor/créditos antiguos
    .replace(/<font[^>]*>\s*Por:[\s\S]*?<\/font>/gi, "")
    .replace(/<font[^>]*>\s*Autor:[\s\S]*?<\/font>/gi, "")
    .replace(/<font[^>]*>\s*Iglesia:[\s\S]*?<\/font>/gi, "")

    // quitar cualquier etiqueta HTML restante
    .replace(/<[^>]+>/g, "")

    // limpiar entidades básicas
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

const limpiarCancionParaProyector = (texto: string) => {
  const textoSinHTML = limpiarHTMLProyeccion(texto)

  return detectarFormatoProyeccion(textoSinHTML)
    .map((b) =>
      limpiarHTMLProyeccion(b.letra || "")
        .replace(/\/n/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
}
  

  const limpiarTextoProyeccion = (texto: string) => {
  return limpiarHTMLProyeccion(texto)
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

  const palabrasBibliaActual = textoBibliaActual
  .split(/\s+/)
  .filter(Boolean)

const largoBibliaActual = textoBibliaActual.length
const totalPalabrasBibliaActual = palabrasBibliaActual.length

const fontSizeBibliaProyector =
  largoBibliaActual > 1800 || totalPalabrasBibliaActual > 300
    ? "clamp(16px, 1.6vw, 26px)"
    : largoBibliaActual > 1300 || totalPalabrasBibliaActual > 220
    ? "clamp(18px, 1.9vw, 30px)"
    : largoBibliaActual > 900 || totalPalabrasBibliaActual > 150
    ? "clamp(22px, 2.4vw, 38px)"
    : largoBibliaActual > 550 || totalPalabrasBibliaActual > 90
    ? "clamp(28px, 3vw, 50px)"
    : largoBibliaActual > 260 || totalPalabrasBibliaActual > 45
    ? "clamp(36px, 4vw, 66px)"
    : "clamp(46px, 5.4vw, 88px)"

const lineHeightBibliaProyector =
  largoBibliaActual > 1300 || totalPalabrasBibliaActual > 220
    ? 1.22
    : largoBibliaActual > 700 || totalPalabrasBibliaActual > 120
    ? 1.28
    : 1.34

  const textoCancionActual = limpiarCancionParaProyector(
  parteActual?.texto_letra || parteActual?.texto || ""
)

  const lineasCancionActual = textoCancionActual
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const totalLineasCancionActual = lineasCancionActual.length
  const largoCancionActual = textoCancionActual.length

  const largoLineaMasLargaCancionActual = lineasCancionActual.reduce(
    (max, linea) => Math.max(max, linea.length),
    0
  )

  const fontSizeCancionProyector =
  totalLineasCancionActual >= 10 &&
  (largoLineaMasLargaCancionActual >= 42 || largoCancionActual > 950)
    ? "clamp(18px, 1.9vw, 30px)"
    : totalLineasCancionActual >= 10
    ? "clamp(24px, 2.7vw, 42px)"
    : totalLineasCancionActual >= 8 &&
      (largoLineaMasLargaCancionActual >= 40 || largoCancionActual > 780)
    ? "clamp(21px, 2.3vw, 36px)"
    : totalLineasCancionActual >= 8
    ? "clamp(28px, 3.2vw, 52px)"
    : totalLineasCancionActual >= 6 &&
      (largoLineaMasLargaCancionActual >= 38 || largoCancionActual > 620)
    ? "clamp(24px, 2.8vw, 42px)"
    : totalLineasCancionActual >= 6
    ? "clamp(32px, 3.8vw, 60px)"
    : totalLineasCancionActual >= 4 &&
      (largoLineaMasLargaCancionActual >= 36 || largoCancionActual > 420)
    ? "clamp(28px, 3.2vw, 50px)"
    : totalLineasCancionActual >= 4
    ? "clamp(38px, 4.6vw, 74px)"
    : "clamp(44px, 5.2vw, 84px)"

  const lineHeightCancionProyector =
  totalLineasCancionActual >= 10
    ? 1.02
    : totalLineasCancionActual >= 7
    ? 1.06
    : 1.1
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
      background:
        "radial-gradient(circle at 50% 30%, rgba(37,99,235,0.22), transparent 38%), linear-gradient(180deg, #020617 0%, #000 100%)",
      color: "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "5vh 6vw",
      boxSizing: "border-box",
      gap: "18px"
    }}
  >
    <div
      style={{
        fontSize:
          (estadoEspecial.titulo || "").length > 70
            ? "clamp(34px, 4vw, 64px)"
            : "clamp(48px, 6vw, 104px)",
        fontWeight: 900,
        lineHeight: 1.05,
        maxWidth: "90vw",
        textShadow: "0 8px 30px rgba(0,0,0,0.45)"
      }}
    >
      {estadoEspecial.titulo || "Espere un momento"}
    </div>

    {!!estadoEspecial.subtitulo && (
      <div
        style={{
          fontSize: "clamp(18px, 2vw, 32px)",
          opacity: 0.68,
          fontWeight: 600,
          maxWidth: "80vw"
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
              fontSize: "clamp(18px, 2vw, 34px)",
              fontWeight: 800,
              opacity: 0.78,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              maxWidth: "90vw",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
            title={biblia.referencia}
          >
            {biblia.referencia}
          </div>

          <div
            style={{
              maxWidth: "90vw",
              maxHeight: "74vh",
              overflow: "hidden",
              fontSize: fontSizeBibliaProyector,
              lineHeight: lineHeightBibliaProyector,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
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
              gap: "10px",
              minHeight: "78px",
              paddingTop: "0.5vh",
              maxWidth: "92vw"
            }}
          >
            <div
              style={{
                fontSize: "clamp(16px, 1.7vw, 28px)",
                opacity: 0.72,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                maxWidth: "92vw",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              title={titulo}
            >
              {titulo}
            </div>

            {!!etiquetaParteActual && (
              <div
                style={{
                  fontSize: "clamp(14px, 1.35vw, 22px)",
                  opacity: 0.82,
                  fontWeight: 800,
                  padding: "5px 16px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)"
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
                maxHeight: "70vh",
                overflow: "hidden",
                fontSize: fontSizeCancionProyector,
                lineHeight: lineHeightCancionProyector,
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
              gap: "4px",
              minHeight: "42px",
              justifyContent: "center"
            }}
          >
            {tono && (
              <div
                style={{
                  fontSize: "clamp(13px, 1.25vw, 20px)",
                  opacity: 0.48,
                  fontWeight: 600,
                  letterSpacing: "0.02em"
                }}
              >
                Tono: {tono}
              </div>
            )}

            {iglesia && (
              <div
                style={{
                  fontSize: "clamp(12px, 1.1vw, 18px)",
                  opacity: 0.38
                }}
              >
                {iglesia}
              </div>
            )}
          </div>
        </div>
      )}

      {estadoEspecial?.tipo === "mensaje" && (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            background:
              "radial-gradient(circle at 50% 35%, rgba(34,197,94,0.18), transparent 38%), linear-gradient(180deg, #020617 0%, #000 100%)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "5vh 6vw",
            boxSizing: "border-box",
            gap: "20px"
          }}
        >
          <div
            style={{
              fontSize:
                (estadoEspecial.titulo || "").length > 220
                  ? "clamp(22px, 2.4vw, 38px)"
                  : (estadoEspecial.titulo || "").length > 140
                  ? "clamp(28px, 3.2vw, 52px)"
                  : (estadoEspecial.titulo || "").length > 70
                  ? "clamp(38px, 4.5vw, 74px)"
                  : "clamp(54px, 6.5vw, 112px)",
              fontWeight: 900,
              lineHeight: 1.08,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "pre-line",
              maxWidth: "90vw",
              textShadow: "0 8px 30px rgba(0,0,0,0.45)"
            }}
          >
            {estadoEspecial.titulo}
          </div>

          {!!estadoEspecial.subtitulo && (
            <div
              style={{
                fontSize: "clamp(17px, 1.8vw, 30px)",
                opacity: 0.62,
                fontWeight: 600,
                maxWidth: "80vw"
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
          background:
            "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), transparent 36%), linear-gradient(180deg, #020617 0%, #000 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "5vh 6vw",
          boxSizing: "border-box",
          gap: "28px"
        }}
      >
        <img
          src={estadoEspecial.url}
          alt="Logo espera"
          style={{
            maxWidth: "42vw",
            maxHeight: "42vh",
            objectFit: "contain",
            filter: "drop-shadow(0 16px 35px rgba(0,0,0,0.5))"
          }}
        />

        {!!estadoEspecial.titulo && (
          <div
            style={{
              fontSize: "clamp(28px, 3.2vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.08,
              maxWidth: "90vw",
              textShadow: "0 8px 30px rgba(0,0,0,0.45)"
            }}
          >
            {estadoEspecial.titulo}
          </div>
        )}

        {!!estadoEspecial.subtitulo && (
          <div
            style={{
              fontSize: "clamp(18px, 2vw, 32px)",
              opacity: 0.65,
              fontWeight: 600
            }}
          >
            {estadoEspecial.subtitulo}
          </div>
        )}
      </div>
    )}
    {logoMarcaUrl && !estadoEspecial && !imagen && (
      <div
        style={{
          position: "fixed",
          top: "800px",
          left: "580px",
          width: "80px",
          height: "80px",
          borderRadius: "18px", 
          overflow: "hidden",
          background: "rgba(0,0,0,0.22)",
          
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 30,
          backdropFilter: "blur(4px)",
          opacity: 0.75
        }}
      >
        <img
          src={logoMarcaUrl}
          alt="Logo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "999px",
            transform: "scale(1)",
            display: "block"
          }}
        />
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