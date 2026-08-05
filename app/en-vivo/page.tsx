"use client"

// ── Transmisión en vivo (nativa, sin OBS) ────────────────────────────────────
// Incremento 1: capturar cámara + micrófono, reflejar la letra que se está
// proyectando (mismo socket que /proyectar) y componer todo en un lienzo que es
// la vista previa de "lo que saldría al aire". El botón "Salir en vivo" (empujar
// a Facebook/YouTube por RTMP con ffmpeg) llega en el siguiente incremento.

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { io } from "socket.io-client"
import { navegarSPA } from "@/lib/navegar"
import { getSocketUrl } from "@/lib/servidor"
import { getIglesiaId } from "@/lib/getIglesia"
import { useApp } from "@/context/AppContext"

type Escena = "camara" | "camara-letra" | "letra"
type DestKey = "facebook" | "youtube" | "tiktok" | "custom"

const PLATAFORMAS: { key: DestKey; nombre: string; emoji: string; esUrl: boolean; ayuda: string; placeholder: string }[] = [
  { key: "facebook", nombre: "Facebook", emoji: "📘", esUrl: false, placeholder: "Clave de transmisión de Facebook", ayuda: "Live Producer → “Usar software de streaming” → copia la Clave de transmisión." },
  { key: "youtube", nombre: "YouTube", emoji: "▶️", esUrl: false, placeholder: "Clave de transmisión de YouTube", ayuda: "Estudio → Transmitir en vivo → copia la Clave de transmisión." },
  { key: "tiktok", nombre: "TikTok", emoji: "🎵", esUrl: true, placeholder: "URL RTMP completa de TikTok", ayuda: "Requiere cuenta con LIVE. En TikTok LIVE Studio pega servidor + clave juntos." },
  { key: "custom", nombre: "Otra (RTMP)", emoji: "🔗", esUrl: true, placeholder: "rtmp://servidor/app/clave", ayuda: "Pega la URL RTMP/RTMPS completa que te da la plataforma." },
]

function urlDeDestino(k: DestKey, valor: string): string {
  const v = valor.trim()
  if (!v) return ""
  if (k === "facebook") return "rtmps://live-api-s.facebook.com:443/rtmp/" + v
  if (k === "youtube") return "rtmp://a.rtmp.youtube.com/live2/" + v
  return v // tiktok / custom: URL completa
}

const C = {
  fondo: "#060d1a", panel: "#111b2e", panel2: "#0d1626",
  borde: "rgba(255,255,255,0.08)", texto: "#eaf0fb",
  suave: "rgba(234,240,251,0.6)", tenue: "rgba(234,240,251,0.4)",
  azul: "#2563eb", verde: "#16a34a", rojo: "#dc2626", ambar: "#f59e0b",
}

const ANCHO = 1280, ALTO = 720 // lienzo de salida (720p)

interface Disp { id: string; label: string }

export default function EnVivoPage() {
  const router = useRouter()

  const [camaras, setCamaras] = useState<Disp[]>([])
  const [micros, setMicros] = useState<Disp[]>([])
  const [camaraId, setCamaraId] = useState<string>("")
  const [camara2Id, setCamara2Id] = useState<string>("") // 2da cámara (opcional)
  const [camaraActiva, setCamaraActiva] = useState<1 | 2 | "ambas">(1) // cuál está al aire
  const [microId, setMicroId] = useState<string>("")
  const [permiso, setPermiso] = useState<"pidiendo" | "ok" | "denegado">("pidiendo")
  const [errorCam, setErrorCam] = useState<string | null>(null)
  const [escena, setEscena] = useState<Escena>("camara-letra")
  const [reintento, setReintento] = useState(0)

  // Mensaje en vivo (banner que el operador escribe y muestra sobre todo)
  const [mensajeVivo, setMensajeVivo] = useState("")
  const [mostrarMensaje, setMostrarMensaje] = useState(false)

  // Personalización (guardada en el equipo)
  const [colorLetra, setColorLetra] = useState("#ffffff")
  const [logoPos, setLogoPos] = useState<{ x: number; y: number }>({ x: ANCHO - 168 - 30, y: 26 })
  const [logoTam, setLogoTam] = useState(168)
  const [logoAspecto, setLogoAspecto] = useState(1) // alto/ancho del logo
  // Recuadro de la Cámara 2 (PiP) — objeto movible/redimensionable
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: ANCHO - 360 - 40, y: ALTO - 202 - 40 })
  const [pipTam, setPipTam] = useState(360) // ancho; el alto es 16:9
  useEffect(() => {
    try {
      const c = localStorage.getItem("en-vivo-color-letra"); if (c) setColorLetra(c)
      const t = localStorage.getItem("en-vivo-logo-tam"); if (t) setLogoTam(Number(t) || 168)
      const p = localStorage.getItem("en-vivo-logo-pos"); if (p) setLogoPos(JSON.parse(p))
      const pip = localStorage.getItem("en-vivo-pip"); if (pip) { const o = JSON.parse(pip); if (o.pos) setPipPos(o.pos); if (o.tam) setPipTam(o.tam) }
    } catch {}
  }, [])
  const guardarColor = (c: string) => { setColorLetra(c); try { localStorage.setItem("en-vivo-color-letra", c) } catch {} }
  const cambiarLogoTam = (t: number) => { setLogoTam(t) }
  // Guardar posiciones/tamaños (con leve retardo para no escribir en cada píxel)
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-logo-pos", JSON.stringify(logoPos)); localStorage.setItem("en-vivo-logo-tam", String(logoTam)) } catch {} }, 300); return () => clearTimeout(t) }, [logoPos, logoTam])
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-pip", JSON.stringify({ pos: pipPos, tam: pipTam })) } catch {} }, 300); return () => clearTimeout(t) }, [pipPos, pipTam])


  // Datos de la iglesia (logo + nombre) desde la configuración, no del socket:
  // así el logo nuevo que subes en Config se refleja al tiro.
  const { logoUrl: logoIglesia, nombreIglesia } = useApp()

  // Contenido que se está proyectando (espejo por socket)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [partes, setPartes] = useState<any[]>([]) // cada parte es un objeto { texto_letra|texto, tipo }
  const [index, setIndex] = useState(0)
  const [imagenUrl, setImagenUrl] = useState<string | null>(null) // imagen proyectada
  const [videoUrl, setVideoUrl] = useState<string | null>(null)   // animación corta muda proyectada
  const [biblia, setBiblia] = useState<any>(null)                 // versículo proyectado
  const [paginaBiblia, setPaginaBiblia] = useState(0)
  const [estadoEsp, setEstadoEsp] = useState<any>(null)           // pantalla especial (cuenta regresiva, mensaje, descanso…)
  const [logoSocket, setLogoSocket] = useState("")
  const [conectadoSala, setConectadoSala] = useState(false)

  // El logo: preferir el de la config; si no hay, el que llegue por socket.
  const logoUrl = logoIglesia || logoSocket

  // Transmisión (Incremento 2)
  const [esEscritorio, setEsEscritorio] = useState(false)
  // Destinos: varias plataformas a la vez. valor = clave (FB/YT) o URL (TikTok/otra).
  const [destinos, setDestinos] = useState<Record<DestKey, { activo: boolean; valor: string }>>({
    facebook: { activo: true, valor: "" },
    youtube: { activo: false, valor: "" },
    tiktok: { activo: false, valor: "" },
    custom: { activo: false, valor: "" },
  })
  useEffect(() => {
    try { const g = localStorage.getItem("en-vivo-destinos"); if (g) setDestinos(d => ({ ...d, ...JSON.parse(g) })) } catch {}
  }, [])
  const setDestino = (k: DestKey, patch: Partial<{ activo: boolean; valor: string }>) => {
    setDestinos(prev => { const next = { ...prev, [k]: { ...prev[k], ...patch } }; try { localStorage.setItem("en-vivo-destinos", JSON.stringify(next)) } catch {}; return next })
  }
  const [txEstado, setTxEstado] = useState<"idle" | "conectando" | "vivo" | "error">("idle")
  const [errorTx, setErrorTx] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [logsTx, setLogsTx] = useState<string[]>([])
  const recRef = useRef<MediaRecorder | null>(null)
  const txEstadoRef = useRef(txEstado)
  useEffect(() => { txEstadoRef.current = txEstado }, [txEstado])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const video2Ref = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)   // cámara 1 (trae el audio)
  const stream2Ref = useRef<MediaStream | null>(null)  // cámara 2 (solo video)
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const imagenImgRef = useRef<HTMLImageElement | null>(null)
  const espImgRef = useRef<HTMLImageElement | null>(null) // imagen/logo de la pantalla especial
  const videoProyRef = useRef<HTMLVideoElement | null>(null) // animación proyectada
  const rafRef = useRef<number>(0)

  // Refs con el contenido para que el loop de dibujo (que no se re-crea) siempre
  // lea lo último sin re-suscribirse en cada cambio de parte.
  const contenidoRef = useRef({ titulo: "", tono: "", partes: [] as any[], index: 0, escena: "camara-letra" as Escena, nombre: "", bibliaTexto: "", bibliaRef: "", mensaje: "", color: "#ffffff", logoPos: { x: 0, y: 0 }, logoTam: 168, camaraActiva: 1 as 1 | 2 | "ambas", pipPos: { x: 0, y: 0 }, pipTam: 360, estadoEsp: null as any, hayVideo: false })
  useEffect(() => {
    const bibliaTexto = biblia ? limpiarTexto(biblia.paginas?.[paginaBiblia] || biblia.texto || "") : ""
    contenidoRef.current = { titulo, tono, partes, index, escena, nombre: nombreIglesia, bibliaTexto, bibliaRef: biblia?.referencia || "", mensaje: mostrarMensaje ? mensajeVivo.trim() : "", color: colorLetra, logoPos, logoTam, camaraActiva, pipPos, pipTam, estadoEsp, hayVideo: !!videoUrl }
  }, [titulo, tono, partes, index, escena, nombreIglesia, biblia, paginaBiblia, mostrarMensaje, mensajeVivo, colorLetra, logoPos, logoTam, camaraActiva, pipPos, pipTam, estadoEsp, videoUrl])

  // ── Cargar la imagen proyectada (para la escena de contenido) ───────────────
  useEffect(() => {
    if (!imagenUrl) { imagenImgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => { imagenImgRef.current = img }
    img.onerror = () => { imagenImgRef.current = null }
    img.src = imagenUrl
  }, [imagenUrl])

  // ── Reproducir la animación proyectada (video mudo en loop) ─────────────────
  useEffect(() => {
    const el = videoProyRef.current
    if (!el) return
    if (!videoUrl) { try { el.pause() } catch {}; el.removeAttribute("src"); el.load?.(); return }
    el.src = videoUrl
    el.loop = true; el.muted = true
    el.play().catch(() => {})
  }, [videoUrl])

  // ── Cargar la imagen/logo de la pantalla especial (logo/descanso) ───────────
  useEffect(() => {
    const url = estadoEsp?.url || estadoEsp?.logo_marca_url
    if (!url) { espImgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => { espImgRef.current = img }
    img.onerror = () => { espImgRef.current = null }
    img.src = url
  }, [estadoEsp])

  // ── Cargar el logo de la iglesia (para la marca de agua) ────────────────────
  useEffect(() => {
    if (!logoUrl) { logoImgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = "anonymous" // necesario para no "manchar" el lienzo al transmitir
    img.onload = () => { logoImgRef.current = img; setLogoAspecto(img.height / img.width || 1) }
    img.onerror = () => { logoImgRef.current = null }
    img.src = logoUrl
  }, [logoUrl])

  // ── Cámara + micrófono ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false

    const iniciar = async () => {
      try {
        setPermiso("pidiendo"); setErrorCam(null)
        // Detener el stream anterior si cambiamos de dispositivo
        streamRef.current?.getTracks().forEach(t => t.stop())

        const constraints: MediaStreamConstraints = {
          video: camaraId ? { deviceId: { exact: camaraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                          : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: microId ? { deviceId: { exact: microId } } : true,
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.muted = true // asegurar autoplay sin bloqueo del navegador
          await videoRef.current.play().catch(() => {})
        }
        setPermiso("ok")

        // Con permiso ya concedido, las etiquetas de los dispositivos aparecen
        const dispositivos = await navigator.mediaDevices.enumerateDevices()
        if (cancelado) return
        const cams = dispositivos.filter(d => d.kind === "videoinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Cámara ${i + 1}` }))
        const mics = dispositivos.filter(d => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Micrófono ${i + 1}` }))
        setCamaras(cams); setMicros(mics)
        // Reflejar el dispositivo realmente en uso
        const vTrack = stream.getVideoTracks()[0]
        if (vTrack && !camaraId) { const s = vTrack.getSettings(); if (s.deviceId) setCamaraId(s.deviceId) }
        const aTrack = stream.getAudioTracks()[0]
        if (aTrack && !microId) { const s = aTrack.getSettings(); if (s.deviceId) setMicroId(s.deviceId) }
      } catch (e: any) {
        if (cancelado) return
        console.error("getUserMedia:", e)
        const nombre = e?.name || ""
        if (nombre === "NotAllowedError" || nombre === "SecurityError") {
          setPermiso("denegado")
          setErrorCam("No diste permiso a la cámara/micrófono. Actívalo y vuelve a intentar.")
        } else if (nombre === "NotReadableError" || nombre === "TrackStartError" || nombre === "AbortError") {
          setPermiso("denegado")
          setErrorCam("La cámara o el micrófono están siendo usados por otra aplicación (por ejemplo Facebook Live Producer, una videollamada, u otra ventana de Selah). Ciérrala y reintenta.")
        } else if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
          setPermiso("denegado")
          setErrorCam("No se encontró la cámara seleccionada. Conecta una cámara y reintenta.")
        } else {
          setPermiso("denegado")
          setErrorCam("No se pudo abrir la cámara. " + (nombre ? nombre + ": " : "") + (e?.message || ""))
        }
      }
    }

    iniciar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaraId, microId, reintento])

  // ── Cámara 2 (opcional, solo video) — para multicámara ──────────────────────
  useEffect(() => {
    let cancelado = false
    if (!camara2Id) {
      stream2Ref.current?.getTracks().forEach(t => t.stop()); stream2Ref.current = null
      if (video2Ref.current) video2Ref.current.srcObject = null
      setCamaraActiva(1) // sin cámara 2, volver a la 1
      return
    }
    const iniciar = async () => {
      try {
        stream2Ref.current?.getTracks().forEach(t => t.stop())
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: camara2Id }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        stream2Ref.current = stream
        if (video2Ref.current) {
          video2Ref.current.srcObject = stream
          video2Ref.current.muted = true
          await video2Ref.current.play().catch(() => {})
        }
      } catch (e) { console.error("getUserMedia cámara 2:", e) }
    }
    iniciar()
    return () => { cancelado = true }
  }, [camara2Id, reintento])

  // Detener las cámaras al salir de la pantalla
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    stream2Ref.current?.getTracks().forEach(t => t.stop())
  }, [])

  // Refrescar la lista cuando conectas/desconectas una cámara (o el celular por
  // app puente) sin tener que reabrir la pantalla.
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.addEventListener) return
    const actualizar = async () => {
      try {
        const ds = await md.enumerateDevices()
        setCamaras(ds.filter(d => d.kind === "videoinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Cámara ${i + 1}` })))
        setMicros(ds.filter(d => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Micrófono ${i + 1}` })))
      } catch {}
    }
    md.addEventListener("devicechange", actualizar)
    return () => md.removeEventListener("devicechange", actualizar)
  }, [])

  // ── Espejo del contenido proyectado (mismo socket que /proyectar) ───────────
  useEffect(() => {
    let activo = true
    const s = io(getSocketUrl(), { reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 })

    const aplicarCancion = (d: any) => {
      setImagenUrl(null); setVideoUrl(null); setBiblia(null); setEstadoEsp(null)
      setPartes(d.partes || []); setIndex(d.index || 0)
      setTitulo(d.titulo || ""); setTono(d.tono || "")
      if (d.logo_marca_url) setLogoSocket(d.logo_marca_url)
    }
    const aplicarImagen = (d: any) => {
      setPartes([]); setTitulo(""); setTono(""); setIndex(0); setBiblia(null); setEstadoEsp(null)
      if (d?.video) { setVideoUrl(d?.url || null); setImagenUrl(null) }
      else { setImagenUrl(d?.url || null); setVideoUrl(null) }
    }
    const aplicarBiblia = (d: any) => {
      setPartes([]); setTitulo(""); setTono(""); setIndex(0); setImagenUrl(null); setVideoUrl(null); setEstadoEsp(null)
      setBiblia(d || null); setPaginaBiblia(d?.pagina || 0)
      if (d?.logo_marca_url) setLogoSocket(d.logo_marca_url)
    }
    const aplicarEstado = (d: any) => {
      setPartes([]); setTitulo(""); setTono(""); setIndex(0); setImagenUrl(null); setVideoUrl(null); setBiblia(null)
      setEstadoEsp(d || null)
      if (d?.logo_marca_url) setLogoSocket(d.logo_marca_url)
    }
    const limpiar = () => { setPartes([]); setTitulo(""); setTono(""); setIndex(0); setImagenUrl(null); setVideoUrl(null); setBiblia(null); setEstadoEsp(null) }

    s.on("connect", async () => {
      if (!activo) return
      const sala = (await getIglesiaId()) || "global"
      s.emit("unirse-sala", { sala, pantalla: "en-vivo" })
      setTimeout(() => s.emit("get-estado"), 150)
      setConectadoSala(true)
    })
    s.on("disconnect", () => { if (activo) setConectadoSala(false) })

    s.on("estado-actual", (estado: any) => {
      if (!activo) return
      if (estado.tipo === "cancion") aplicarCancion(estado.data || {})
      else if (estado.tipo === "imagen") aplicarImagen(estado.data || {})
      else if (estado.tipo === "biblia") aplicarBiblia(estado.data || {})
      else if (estado.tipo === "estado") aplicarEstado(estado.data || {})
      else limpiar()
    })
    s.on("cargar-cancion", (d: any) => { if (activo) aplicarCancion(d || {}) })
    s.on("cambiar-parte", (i: number) => { if (activo) setIndex(i) })
    s.on("mostrar-imagen", (d: any) => { if (activo) aplicarImagen(d || {}) })
    s.on("mostrar-biblia", (d: any) => { if (activo) aplicarBiblia(d || {}) })
    s.on("cambiar-pagina-biblia", (p: number) => { if (activo) setPaginaBiblia(p) })
    s.on("mostrar-estado", (d: any) => { if (activo) aplicarEstado(d || {}) })

    return () => { activo = false; s.disconnect() }
  }, [])

  // ── Transmisión: detectar escritorio + escuchar estado/logs de ffmpeg ───────
  useEffect(() => {
    const tx = (window as any).transmision
    setEsEscritorio(!!tx)
    if (!tx) return
    const agregarLog = (linea: string) => {
      const l = (linea || "").trim()
      if (l) setLogsTx(prev => [...prev, ...l.split("\n").map(x => x.trim()).filter(Boolean)].slice(-60))
    }
    const offEstado = tx.onEstado((d: any) => {
      agregarLog(d?.estado === "error" ? `⛔ error de proceso: ${d?.error || ""}` : `■ ffmpeg terminó (código ${d?.code})`)
      // ffmpeg terminó/erró mientras creíamos estar al aire → avisar
      if (d?.estado === "error" || d?.estado === "terminado") {
        if (txEstadoRef.current === "vivo" || txEstadoRef.current === "conectando") {
          try { recRef.current?.stop() } catch {}
          recRef.current = null
          setTxEstado("error")
          setErrorTx(d?.error || (d?.code ? "La transmisión se cortó. Revisa los detalles técnicos más abajo." : "La transmisión terminó inesperadamente."))
        }
      }
    })
    const offLog = tx.onLog((m: string) => {
      agregarLog(m)
      const linea = (m || "").trim()
      if (linea) setErrorTx(prev => (txEstadoRef.current === "conectando" ? linea : prev))
    })
    return () => { offEstado?.(); offLog?.() }
  }, [])

  // Cronómetro mientras está al aire
  useEffect(() => {
    if (txEstado !== "vivo") return
    setSegundos(0)
    const t = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [txEstado])

  // ── Bucle de composición: cámara + letra + logo → lienzo ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dibujar = () => {
      // Blindado: un error acá NO debe matar el bucle (antes lo mataba y se
      // congelaba todo). Pase lo que pase, re-agendamos el siguiente fotograma.
      try {
        const cont = contenidoRef.current
        // Cámara al aire (1 o 2). Si la 2 no está lista, cae a la 1.
        const v2 = video2Ref.current
        const v = (cont.camaraActiva === 2 && v2 && v2.videoWidth > 0) ? v2 : videoRef.current
        const logo = logoImgRef.current
        const imagen = imagenImgRef.current
        const esLetra = cont.escena === "letra"

        // Contenido activo: prioridad imagen > biblia > letra de canción.
        const hayBiblia = !!cont.bibliaTexto.trim()
        const textoContenido = hayBiblia ? cont.bibliaTexto : limpiarLetra(cont.partes[cont.index])
        const tituloContenido = hayBiblia ? cont.bibliaRef : cont.titulo
        const tonoContenido = hayBiblia ? "" : cont.tono

        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, ANCHO, ALTO)

        const hayMensaje = !!cont.mensaje

        if (esLetra) {
          // Escena "Proyección": diapositiva con fondo, SIN cámara.
          dibujarFondoBrandeado(ctx)
          const vProy = videoProyRef.current
          if (cont.estadoEsp) {
            dibujarEstadoEspecial(ctx, cont.estadoEsp, espImgRef.current || logo, cont.nombre, cont.color)
          } else if (cont.hayVideo && vProy && vProy.videoWidth > 0) {
            dibujarImagenContenida(ctx, vProy) // el video se dibuja igual que una imagen (contain)
          } else if (imagen) {
            dibujarImagenContenida(ctx, imagen)
          } else if (textoContenido.trim()) {
            dibujarDiapositivaLetra(ctx, textoContenido, cont.color)
          } else {
            dibujarEspera(ctx, cont.nombre, logo)
          }
          if (!cont.estadoEsp) dibujarCabecera(ctx, cont.nombre, tituloContenido, tonoContenido, logo)
        } else {
          // Escenas con cámara ("camara" y "camara-letra").
          if (v && v.videoWidth > 0) {
            const escala = Math.max(ANCHO / v.videoWidth, ALTO / v.videoHeight)
            const w = v.videoWidth * escala, h = v.videoHeight * escala
            ctx.drawImage(v, (ANCHO - w) / 2, (ALTO - h) / 2, w, h)
          }
          // Cámara 2 como recuadro (PiP) cuando el modo es "ambas".
          if (cont.camaraActiva === "ambas" && v2 && v2.videoWidth > 0) {
            const { x, y } = cont.pipPos, pw = cont.pipTam, ph = pw * 9 / 16
            ctx.save()
            redondear(ctx, x, y, pw, ph, 12); ctx.clip()
            const es = Math.max(pw / v2.videoWidth, ph / v2.videoHeight)
            const w = v2.videoWidth * es, h = v2.videoHeight * es
            ctx.drawImage(v2, x + (pw - w) / 2, y + (ph - h) / 2, w, h)
            ctx.restore()
            ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3
            redondear(ctx, x, y, pw, ph, 12); ctx.stroke()
          }
          // Nombre de la iglesia (centrado arriba, elegante)
          dibujarNombreCentrado(ctx, cont.nombre)
          // Contenido abajo solo en "camara-letra" (letra o versículo)
          if (cont.escena === "camara-letra" && textoContenido.trim()) {
            dibujarRotuloInferior(ctx, textoContenido, tituloContenido, tonoContenido, hayMensaje ? 84 : 0, cont.color)
          }
          // Logo movible/redimensionable (se dibuja al final para tapar la marca)
          if (logo && logo.width > 0) {
            const lw = cont.logoTam, lh = logo.height * (lw / logo.width)
            ctx.globalAlpha = 0.97
            ctx.drawImage(logo, cont.logoPos.x, cont.logoPos.y, lw, lh)
            ctx.globalAlpha = 1
          }
        }

        // Mensaje en vivo: banner abajo, sobre todas las escenas.
        if (hayMensaje) dibujarMensaje(ctx, cont.mensaje)
      } catch (e) {
        console.error("Error dibujando fotograma:", e)
      }
      rafRef.current = requestAnimationFrame(dibujar)
    }
    rafRef.current = requestAnimationFrame(dibujar)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const reintentar = () => { setErrorCam(null); setPermiso("pidiendo"); setReintento(n => n + 1) }

  const construirUrls = (): string[] =>
    PLATAFORMAS.filter(p => destinos[p.key].activo).map(p => urlDeDestino(p.key, destinos[p.key].valor)).filter(Boolean)

  const salirEnVivo = async () => {
    setErrorTx(null)
    const tx = (window as any).transmision
    if (!tx) { setErrorTx("Esto solo funciona en la app de escritorio de Selah Live."); return }
    const rtmpUrls = construirUrls()
    if (rtmpUrls.length === 0) { setErrorTx("Activa al menos una plataforma y pega su clave / URL."); return }
    if (!canvasRef.current || !streamRef.current) { setErrorTx("La cámara aún no está lista."); return }

    setLogsTx([])
    setTxEstado("conectando")
    // Preferir H264 (lo puede comprimir la tarjeta gráfica → más fps en el i3);
    // VP8 es por software y ahoga los PC lentos (~10fps). ffmpeg lee cualquiera.
    const mime = [
      "video/x-matroska;codecs=avc1,opus",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/webm;codecs=h264,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "video/webm"
    setLogsTx(prev => [...prev, `▶ formato de captura: ${mime}`, `▶ destinos: ${rtmpUrls.length}`])

    const res = await tx.iniciar({ rtmpUrls })
    if (!res?.ok) { setTxEstado("error"); setErrorTx(res?.error || "No se pudo iniciar la transmisión."); return }

    try {
      const salida = new MediaStream([
        ...(canvasRef.current.captureStream(30).getVideoTracks()),
        ...(streamRef.current.getAudioTracks()),
      ])
      const rec = new MediaRecorder(salida, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 })
      rec.ondataavailable = async ev => {
        if (ev.data && ev.data.size) {
          try { tx.enviarChunk(new Uint8Array(await ev.data.arrayBuffer())) } catch {}
        }
      }
      rec.start(250) // enviar trozos cada 250ms
      recRef.current = rec
      setTxEstado("vivo")
    } catch (e: any) {
      setTxEstado("error"); setErrorTx("No se pudo capturar el video: " + (e?.message || ""))
      try { await tx.detener() } catch {}
    }
  }

  const terminar = async () => {
    try { recRef.current?.stop() } catch {}
    recRef.current = null
    try { await (window as any).transmision?.detener() } catch {}
    setTxEstado("idle"); setErrorTx(null); setSegundos(0)
  }

  return (
    <div style={{ minHeight: "100vh", background: C.fondo, color: C.texto, fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "0 0 60px" }}>
      {/* Encabezado */}
      <div style={{ borderBottom: `1px solid ${C.borde}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navegarSPA(router, "/")} style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, padding: "8px 12px" })}>← Inicio</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}>
              🎥 Transmisión en vivo
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: "rgba(245,158,11,.14)", color: C.ambar, border: "1px solid rgba(245,158,11,.3)" }}>PREMIUM</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.tenue, marginTop: 2 }}>Cámara + la letra que proyectas, sin instalar nada más</div>
          </div>
        </div>
        <button onClick={() => navegarSPA(router, "/transmision")} style={botonBase({ background: "transparent", color: C.suave, border: `1px solid ${C.borde}`, padding: "8px 12px", fontSize: 13 })}>
          Usar OBS (avanzado)
        </button>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px" }}>
        {/* Vista previa (lo que saldría al aire) */}
        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: `1px solid ${C.borde}`, background: "#000", aspectRatio: "16 / 9" }}>
          <canvas ref={canvasRef} width={ANCHO} height={ALTO}
            style={{ width: "100%", height: "100%", display: "block" }} />

          {/* Editor: manijas para mover/redimensionar objetos (solo escenas con
              cámara). Es HTML sobre el lienzo → NO sale al aire. */}
          {escena !== "letra" && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {logoImgRef.current && (
                <ObjetoEditable etiqueta="Logo" pos={logoPos} w={logoTam} h={logoTam * logoAspecto}
                  minW={60} maxW={520}
                  onChange={(p, w) => { setLogoPos(p); setLogoTam(Math.round(w)) }} />
              )}
              {camaraActiva === "ambas" && camara2Id && (
                <ObjetoEditable etiqueta="Cámara 2" pos={pipPos} w={pipTam} h={pipTam * 9 / 16}
                  minW={160} maxW={900}
                  onChange={(p, w) => { setPipPos(p); setPipTam(Math.round(w)) }} />
              )}
            </div>
          )}
          {/* etiqueta: vista previa o EN VIVO con cronómetro */}
          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: 99, fontSize: 11.5, fontWeight: 800, color: "#fff", backdropFilter: "blur(4px)", background: txEstado === "vivo" ? "rgba(220,38,38,.85)" : "rgba(0,0,0,.55)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: txEstado === "vivo" ? "#fff" : "#4ade80", boxShadow: txEstado === "vivo" ? "0 0 6px #fff" : "none" }} />
            {txEstado === "vivo" ? `EN VIVO · ${fmtTiempo(segundos)}` : "VISTA PREVIA"}
          </div>
          {permiso !== "ok" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, background: "rgba(6,13,26,.82)", textAlign: "center", padding: 24 }}>
              {permiso === "pidiendo" ? (
                <div style={{ color: C.suave, fontSize: 14 }}>Abriendo la cámara…</div>
              ) : (
                <>
                  <div style={{ fontSize: 30 }}>📷</div>
                  <div style={{ color: "#fca5a5", fontSize: 14, maxWidth: 420 }}>{errorCam}</div>
                  <button onClick={reintentar} style={botonBase({ background: C.azul, color: "#fff" })}>Reintentar</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Video que alimenta el lienzo. NO usar display:none: con eso el
            navegador no decodifica los fotogramas (videoWidth queda en 0 y no
            se dibuja la cámara). Se oculta pero se mantiene renderizado. */}
        <video ref={videoRef} autoPlay muted playsInline
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
          style={{ position: "absolute", width: 2, height: 2, opacity: 0, pointerEvents: "none", left: 0, top: 0 }} />
        <video ref={video2Ref} autoPlay muted playsInline
          onLoadedMetadata={() => video2Ref.current?.play().catch(() => {})}
          style={{ position: "absolute", width: 2, height: 2, opacity: 0, pointerEvents: "none", left: 0, top: 0 }} />
        {/* Animación proyectada (video mudo en loop) */}
        <video ref={videoProyRef} muted loop playsInline crossOrigin="anonymous"
          style={{ position: "absolute", width: 2, height: 2, opacity: 0, pointerEvents: "none", left: 0, top: 0 }} />

        {/* Controles */}
        <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, marginTop: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ fontSize: 12.5, color: C.tenue }}>
              🎥 Cámara 1
              <select value={camaraId} onChange={e => { const val = e.target.value; setCamaraId(val); if (val === camara2Id) setCamara2Id("") }} style={selectEstilo}>
                {camaras.length === 0 && <option value="">(sin cámaras)</option>}
                {camaras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: C.tenue }}>
              📱 Cámara 2 (opcional)
              <select value={camara2Id} onChange={e => setCamara2Id(e.target.value)} style={selectEstilo}>
                <option value="">(ninguna)</option>
                {camaras.filter(c => c.id !== camaraId).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: C.tenue, gridColumn: "1 / -1" }}>
              🎙️ Micrófono / entrada de audio
              <select value={microId} onChange={e => setMicroId(e.target.value)} style={selectEstilo}>
                {micros.length === 0 && <option value="">(sin micrófonos)</option>}
                {micros.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          </div>

          {/* Cambio de cámara en vivo (solo si hay 2da cámara) */}
          {camara2Id && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cámara al aire</div>
              <div style={{ fontSize: 12, color: C.tenue, marginBottom: 12 }}>Cambia en vivo (el audio no se corta). “Ambas” pone la Cámara 2 como recuadro movible.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {([[1, "🎥 Cámara 1"], [2, "📱 Cámara 2"], ["ambas", "🎥+📱 Ambas"]] as const).map(([n, txt]) => (
                  <button key={String(n)} onClick={() => setCamaraActiva(n)} style={{
                    padding: "13px 8px", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 13.5,
                    background: camaraActiva === n ? "rgba(220,38,38,0.16)" : C.panel2,
                    border: `1.5px solid ${camaraActiva === n ? C.rojo : C.borde}`,
                    color: camaraActiva === n ? "#fca5a5" : C.texto,
                  }}>
                    {camaraActiva === n && <span style={{ fontSize: 10, display: "block", fontWeight: 800, marginBottom: 2 }}>● AL AIRE</span>}
                    {txt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Escena al aire</div>
              <div style={{ fontSize: 12, color: C.tenue }}>
                {conectadoSala
                  ? (estadoEsp ? `Proyectando: ${nombreEstado(estadoEsp.tipo)}`
                    : biblia?.referencia ? `Proyectando: ${biblia.referencia}`
                    : titulo ? `Proyectando: ${titulo}${tono ? ` · ${tono}` : ""}`
                    : videoUrl ? "Proyectando una animación"
                    : imagenUrl ? "Proyectando una imagen"
                    : "Sin proyección activa")
                  : "Conectando con la proyección…"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {([
                ["camara", "🎥 Cámara", "Solo la cámara"],
                ["camara-letra", "🎥 + 📝 Letra", "Letra sobre la cámara"],
                ["letra", "📺 Proyección", "Letra, imagen o versículo"],
              ] as const).map(([id, txt, sub]) => (
                <button key={id} onClick={() => setEscena(id)} style={{
                  padding: "12px 10px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                  background: escena === id ? "rgba(37,99,235,0.2)" : C.panel2,
                  border: `1.5px solid ${escena === id ? C.azul : C.borde}`,
                  color: escena === id ? "#93c5fd" : C.texto,
                }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{txt}</div>
                  <div style={{ fontSize: 10.5, color: escena === id ? "#93c5fd" : C.tenue, marginTop: 3 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mensaje en vivo */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Mensaje en vivo</div>
            <div style={{ fontSize: 12, color: C.tenue, marginBottom: 12 }}>Un texto que aparece abajo, sobre cualquier escena (ej. “Bienvenidos”, “Ofrenda por transferencia…”).</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={mensajeVivo} onChange={e => setMensajeVivo(e.target.value)}
                placeholder="Escribe el mensaje…"
                style={{ ...selectEstilo, marginTop: 0, flex: 1, minWidth: 200 }} />
              <button onClick={() => setMostrarMensaje(v => !v)} disabled={!mensajeVivo.trim() && !mostrarMensaje}
                style={botonBase({
                  background: mostrarMensaje ? C.rojo : C.verde, color: "#fff",
                  opacity: (!mensajeVivo.trim() && !mostrarMensaje) ? 0.5 : 1,
                })}>
                {mostrarMensaje ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {/* Personalización */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Personalización</div>

            {/* Color de la letra */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontSize: 12.5, color: C.tenue, minWidth: 90 }}>Color de letra</span>
              {[["#ffffff", "Blanco"], ["#fde68a", "Cálido"], ["#fbbf24", "Amarillo"], ["#67e8f9", "Cian"], ["#86efac", "Verde"]].map(([col, nom]) => (
                <button key={col} onClick={() => guardarColor(col)} title={nom}
                  style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: col,
                    border: colorLetra === col ? `3px solid ${C.azul}` : "2px solid rgba(255,255,255,0.2)" }} />
              ))}
              <input type="color" value={colorLetra} onChange={e => guardarColor(e.target.value)}
                title="Color personalizado" style={{ width: 34, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer" }} />
            </div>

            {/* Tamaño del logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: C.tenue, minWidth: 90 }}>Tamaño del logo</span>
              <input type="range" min={70} max={380} value={logoTam} onChange={e => cambiarLogoTam(Number(e.target.value))}
                style={{ flex: 1, minWidth: 160, accentColor: C.azul }} />
              <span style={{ fontSize: 12, color: C.suave, width: 46, textAlign: "right" }}>{logoTam}px</span>
            </div>
            <div style={{ fontSize: 12, color: C.tenue, marginTop: 10 }}>
              💡 Arrastra el <strong style={{ color: C.suave }}>logo</strong> en la vista previa para moverlo (útil para tapar la marca de Iriun). Se guarda solo.
            </div>
          </div>
        </div>

        {/* Salir en vivo */}
        <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, marginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Salir en vivo</div>
          <div style={{ fontSize: 12.5, color: C.tenue, marginBottom: 16 }}>Transmite esta vista directo a tu plataforma.</div>

          {!esEscritorio ? (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.suave }}>
              Transmitir en vivo funciona solo en la <strong style={{ color: C.texto }}>app de escritorio</strong> de Selah Live (aquí en el navegador puedes probar la cámara y la letra, pero no salir al aire).
            </div>
          ) : (txEstado === "vivo" || txEstado === "conectando") ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: txEstado === "vivo" ? "#f87171" : "#fbbf24", boxShadow: txEstado === "vivo" ? "0 0 8px #f87171" : "none" }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: txEstado === "vivo" ? "#f87171" : "#fbbf24" }}>
                    {txEstado === "vivo" ? `AL AIRE · ${fmtTiempo(segundos)}` : "Conectando…"}
                  </div>
                  <div style={{ fontSize: 12, color: C.tenue }}>
                    {PLATAFORMAS.filter(p => destinos[p.key].activo && destinos[p.key].valor.trim()).map(p => p.nombre).join(" · ") || "—"}
                  </div>
                </div>
              </div>
              <button onClick={terminar} style={botonBase({ background: C.rojo, color: "#fff" })}>■ Terminar transmisión</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.tenue, marginBottom: 12 }}>Activa una o varias plataformas — se transmite a todas a la vez (necesitas buena subida de internet).</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {PLATAFORMAS.map(p => {
                  const d = destinos[p.key]
                  return (
                    <div key={p.key} style={{ background: C.panel2, border: `1px solid ${d.activo ? C.azul : C.borde}`, borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{p.emoji} {p.nombre}</div>
                        <button onClick={() => setDestino(p.key, { activo: !d.activo })} aria-label={`Activar ${p.nombre}`}
                          style={{ position: "relative", width: 46, height: 26, borderRadius: 99, border: "none", cursor: "pointer", background: d.activo ? C.verde : "rgba(255,255,255,0.14)", flexShrink: 0 }}>
                          <span style={{ position: "absolute", top: 3, left: d.activo ? 23 : 3, width: 20, height: 20, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
                        </button>
                      </div>
                      {d.activo && (
                        <>
                          <input value={d.valor} onChange={e => setDestino(p.key, { valor: e.target.value })}
                            placeholder={p.placeholder} style={{ ...selectEstilo, marginTop: 10 }} />
                          <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 7 }}>{p.ayuda}</div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              <button onClick={salirEnVivo} disabled={permiso !== "ok"}
                style={botonBase({ background: C.rojo, color: "#fff", width: "100%", padding: "14px", opacity: permiso !== "ok" ? 0.5 : 1 })}>
                ● Salir en vivo
              </button>
            </>
          )}

          {errorTx && (
            <div style={{ marginTop: 14, background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fca5a5", wordBreak: "break-word" }}>
              ⚠️ {errorTx}
            </div>
          )}

          {/* Detalles técnicos (para diagnóstico) */}
          {esEscritorio && logsTx.length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: C.suave, fontWeight: 700 }}>🔧 Detalles técnicos (para soporte)</summary>
              <div style={{ marginTop: 10, background: "#0a1120", border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 12px", maxHeight: 180, overflow: "auto" }}>
                <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "#c7d2e5", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, Consolas, monospace" }}>
                  {logsTx.join("\n")}
                </pre>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { navigator.clipboard?.writeText(logsTx.join("\n")).catch(() => {}) }}
                  style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, padding: "7px 12px", fontSize: 12.5 })}>📋 Copiar</button>
                <button onClick={() => (window as any).transmision?.abrirLog?.()}
                  style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, padding: "7px 12px", fontSize: 12.5 })}>📂 Abrir registro completo</button>
              </div>
            </details>
          )}
        </div>

        {/* Aviso de conexión */}
        <div style={{ marginTop: 14, fontSize: 12, color: C.tenue, textAlign: "center", lineHeight: 1.6 }}>
          Para una transmisión estable, conéctate por <strong style={{ color: C.suave }}>cable de red</strong> (no WiFi) y con buena subida de internet.
        </div>
      </div>
    </div>
  )
}

// Recuadro editable (mover + redimensionar) sobre la vista previa. Es HTML, no
// se dibuja en el lienzo → las manijas NO salen al aire. Coordenadas en el
// espacio del lienzo (1280×720); se posiciona en % del contenedor.
function ObjetoEditable({ pos, w, h, onChange, etiqueta, minW = 60, maxW = ANCHO }: {
  pos: { x: number; y: number }; w: number; h: number
  onChange: (p: { x: number; y: number }, w: number) => void
  etiqueta: string; minW?: number; maxW?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const est = useRef<{ modo: "mover" | "escalar"; px: number; py: number; x: number; y: number; w: number } | null>(null)
  const rectCont = () => ref.current?.parentElement?.getBoundingClientRect()

  const iniciar = (modo: "mover" | "escalar") => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    est.current = { modo, px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, w }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
  }
  const mover = (e: React.PointerEvent) => {
    if (!est.current) return
    const r = rectCont(); if (!r) return
    const dx = (e.clientX - est.current.px) * (ANCHO / r.width)
    const dy = (e.clientY - est.current.py) * (ALTO / r.height)
    if (est.current.modo === "mover") {
      onChange({ x: Math.max(0, Math.min(ANCHO - w, est.current.x + dx)), y: Math.max(0, Math.min(ALTO - h, est.current.y + dy)) }, w)
    } else {
      onChange(pos, Math.max(minW, Math.min(maxW, est.current.w + dx)))
    }
  }
  const soltar = (e: React.PointerEvent) => { est.current = null; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {} }

  return (
    <div ref={ref} onPointerDown={iniciar("mover")} onPointerMove={mover} onPointerUp={soltar}
      style={{
        position: "absolute", left: `${pos.x / ANCHO * 100}%`, top: `${pos.y / ALTO * 100}%`,
        width: `${w / ANCHO * 100}%`, height: `${h / ALTO * 100}%`,
        border: "1.5px dashed rgba(147,197,253,0.95)", borderRadius: 6, cursor: "move",
        boxSizing: "border-box", pointerEvents: "auto", touchAction: "none",
      }}>
      <span style={{ position: "absolute", top: -19, left: 0, fontSize: 10, fontWeight: 700, color: "#93c5fd", background: "rgba(0,0,0,0.55)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{etiqueta}</span>
      <div onPointerDown={iniciar("escalar")} onPointerMove={mover} onPointerUp={soltar}
        style={{ position: "absolute", right: -9, bottom: -9, width: 18, height: 18, borderRadius: 5, background: "#2563eb", border: "2px solid #fff", cursor: "nwse-resize", touchAction: "none" }} />
    </div>
  )
}

// Extrae la letra de una parte (que es un objeto) y la limpia: quita HTML,
// acordes entre corchetes y normaliza saltos/espacios. Prefiere texto_letra.
function limpiarLetra(p: any): string {
  const raw = p?.texto_letra || p?.texto || ""
  if (typeof raw !== "string") return ""
  return raw
    .replace(/<[^>]*>/g, " ")     // etiquetas HTML
    .replace(/\[[^\]]*\]/g, "")   // acordes: [Do], [Sol], etc.
    .replace(/\\n|\/n/g, "\n")    // saltos escapados
    .replace(/\r/g, "")
    .split("\n").map((l: string) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n")
}

// Limpia texto suelto (versículo bíblico): quita HTML/acordes y lo deja en un
// solo párrafo (el ajuste por ancho lo reparte en líneas).
function limpiarTexto(texto: string): string {
  if (typeof texto !== "string") return ""
  return texto
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\n|\/n/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ── Dibujo del rótulo inferior con la letra ────────────────────────────────────
// offsetY: cuánto subir el rótulo (para dejar espacio al mensaje en vivo abajo).
function dibujarRotuloInferior(ctx: CanvasRenderingContext2D, texto: string, titulo: string, tono: string, offsetY = 0, color = "#ffffff") {
  const BASE = ALTO - offsetY
  const maxAncho = ANCHO - 160
  const envolver = (t: number) => {
    ctx.font = `700 ${t}px 'Segoe UI', system-ui, sans-serif`
    const ls: string[] = []
    for (const bruto of texto.split("\n")) { const l = bruto.trim(); if (l) ls.push(...ajustarLinea(ctx, l, maxAncho)) }
    return ls
  }
  // Achicar la fuente hasta que TODO quepa (bloque ≤ ~50% de la pantalla).
  const maxBloque = ALTO * 0.5
  let tamano = 44
  let mostradas = envolver(tamano)
  while (mostradas.length * tamano * 1.28 > maxBloque && tamano > 24) { tamano -= 3; mostradas = envolver(tamano) }
  const alturaLinea = tamano * 1.28
  const padY = 34
  const altoBloque = mostradas.length * alturaLinea + padY * 2

  // Degradado inferior para legibilidad
  const grad = ctx.createLinearGradient(0, BASE - altoBloque - 60, 0, BASE)
  grad.addColorStop(0, "rgba(0,0,0,0)")
  grad.addColorStop(1, "rgba(0,0,0,0.78)")
  ctx.fillStyle = grad
  ctx.fillRect(0, BASE - altoBloque - 60, ANCHO, altoBloque + 60)

  // Título + tono (arriba del rótulo)
  if (titulo) {
    ctx.font = "600 24px 'Segoe UI', system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.72)"
    ctx.textAlign = "center"
    const etiqueta = tono ? `${titulo.toUpperCase()}  ·  ${tono}` : titulo.toUpperCase()
    ctx.fillText(etiqueta, ANCHO / 2, BASE - altoBloque - 6)
  }

  // Letra
  ctx.font = `700 ${tamano}px 'Segoe UI', system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.shadowColor = "rgba(0,0,0,0.85)"
  ctx.shadowBlur = 8
  let y = BASE - altoBloque + padY + tamano
  ctx.fillStyle = color
  for (const l of mostradas) {
    ctx.fillText(l, ANCHO / 2, y)
    y += alturaLinea
  }
  ctx.shadowBlur = 0
}

function ajustarLinea(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number): string[] {
  const palabras = texto.split(" ")
  const out: string[] = []
  let actual = ""
  for (const p of palabras) {
    const prueba = actual ? actual + " " + p : p
    if (ctx.measureText(prueba).width > maxAncho && actual) { out.push(actual); actual = p }
    else actual = prueba
  }
  if (actual) out.push(actual)
  return out
}

function redondear(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Fondo oscuro con un leve brillo, para la escena "Letra" (sin cámara).
function dibujarFondoBrandeado(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, ALTO)
  g.addColorStop(0, "#0b1626"); g.addColorStop(1, "#050b16")
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO)
  const r = ctx.createRadialGradient(ANCHO / 2, ALTO * 0.36, 40, ANCHO / 2, ALTO * 0.36, ANCHO * 0.72)
  r.addColorStop(0, "rgba(37,99,235,0.10)"); r.addColorStop(1, "rgba(37,99,235,0)")
  ctx.fillStyle = r; ctx.fillRect(0, 0, ANCHO, ALTO)
}

// Imagen o video "contain" centrado (letterbox) sobre el fondo.
function dibujarImagenContenida(ctx: CanvasRenderingContext2D, el: HTMLImageElement | HTMLVideoElement) {
  const iw = (el as any).videoWidth || (el as any).naturalWidth || el.width
  const ih = (el as any).videoHeight || (el as any).naturalHeight || el.height
  if (!iw || !ih) return
  const escala = Math.min(ANCHO / iw, ALTO / ih)
  const w = iw * escala, h = ih * escala
  ctx.drawImage(el, (ANCHO - w) / 2, (ALTO - h) / 2, w, h)
}

// Letra grande centrada para la escena "Proyección". Se achica sola hasta que
// TODO el texto quepa en el área (nunca se corta).
function dibujarDiapositivaLetra(ctx: CanvasRenderingContext2D, texto: string, color = "#ffffff") {
  const maxAncho = ANCHO - 200
  const brutas = texto.split("\n").map(b => b.trim()).filter(Boolean)
  const medir = (t: number) => {
    ctx.font = `700 ${t}px 'Segoe UI', system-ui, sans-serif`
    const ls: string[] = []
    for (const b of brutas) ls.push(...ajustarLinea(ctx, b, maxAncho))
    return ls
  }
  const areaTop = 132, areaAlto = ALTO - 46 - areaTop
  let tamano = 64
  let lineas = medir(tamano)
  // Achicar hasta que todas las líneas quepan en alto (mínimo 22px)
  while (lineas.length * tamano * 1.3 > areaAlto && tamano > 22) { tamano -= 3; lineas = medir(tamano) }
  const alturaLinea = tamano * 1.3
  const totalH = lineas.length * alturaLinea
  let y = areaTop + (areaAlto - totalH) / 2 + tamano
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"
  ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 10
  ctx.fillStyle = color
  ctx.font = `700 ${tamano}px 'Segoe UI', system-ui, sans-serif`
  for (const l of lineas) { ctx.fillText(l, ANCHO / 2, y); y += alturaLinea }
  ctx.shadowBlur = 0
}

// Diapositiva de espera (nada proyectado): logo + nombre centrados.
function dibujarEspera(ctx: CanvasRenderingContext2D, nombre: string, logo: HTMLImageElement | null) {
  let cy = ALTO / 2
  if (logo && logo.width > 0) {
    const lw = 260, lh = logo.height * (lw / logo.width)
    ctx.globalAlpha = 0.97
    ctx.drawImage(logo, (ANCHO - lw) / 2, cy - lh - 20, lw, lh)
    ctx.globalAlpha = 1
    cy += 12
  }
  if (nombre) {
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.font = "700 40px 'Segoe UI', system-ui, sans-serif"
    ctx.fillText(nombre.toUpperCase(), ANCHO / 2, cy + 34)
  }
}

// Pantalla especial (cuenta regresiva, mensaje, logo, descanso, espera) en la
// escena Proyección. Se dibuja sobre el fondo brandeado.
function dibujarEstadoEspecial(ctx: CanvasRenderingContext2D, esp: any, img: HTMLImageElement | null, nombre: string, color: string) {
  const t = esp?.tipo
  ctx.textAlign = "center"; ctx.textBaseline = "middle"

  if (t === "cuenta-regresiva") {
    const seg = Math.max(0, Math.floor((new Date(esp.hasta).getTime() - Date.now()) / 1000))
    const pad = (n: number) => String(n).padStart(2, "0")
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60
    const texto = seg > 0 ? (h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`) : "¡Comenzamos!"
    ctx.fillStyle = color
    ctx.font = `900 ${seg > 0 ? 190 : 96}px 'Segoe UI', system-ui, sans-serif`
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 14
    ctx.fillText(texto, ANCHO / 2, ALTO / 2 - (esp.mensaje && seg > 0 ? 40 : 0))
    ctx.shadowBlur = 0
    if (esp.mensaje && seg > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.78)"
      ctx.font = "600 36px 'Segoe UI', system-ui, sans-serif"
      ctx.fillText(String(esp.mensaje).slice(0, 90), ANCHO / 2, ALTO / 2 + 130)
    }
    return
  }

  if ((t === "logo" || t === "descanso") && img && img.width > 0) {
    const maxW = 460, maxH = 320
    const es = Math.min(maxW / img.width, maxH / img.height)
    const w = img.width * es, h = img.height * es
    ctx.globalAlpha = t === "descanso" ? 0.72 : 0.97
    ctx.drawImage(img, (ANCHO - w) / 2, ALTO / 2 - h / 2 - 30, w, h)
    ctx.globalAlpha = 1
    const sub = esp.titulo || esp.iglesia || nombre || ""
    if (sub) {
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.font = "700 34px 'Segoe UI', system-ui, sans-serif"
      ctx.fillText(String(sub).slice(0, 60), ANCHO / 2, ALTO / 2 + 190)
    }
    return
  }

  // mensaje / espera (y respaldo): título grande + subtítulo
  const titulo = esp.titulo || (t === "espera" ? "Espere un momento" : "")
  const sub = esp.subtitulo || esp.mensaje || ""
  if (titulo) {
    ctx.fillStyle = color
    ctx.font = "900 68px 'Segoe UI', system-ui, sans-serif"
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10
    // ajuste simple por ancho
    const lineas = ajustarLinea(ctx, String(titulo), ANCHO - 200).slice(0, 4)
    let y = ALTO / 2 - (lineas.length - 1) * 44 - (sub ? 30 : 0)
    for (const l of lineas) { ctx.fillText(l, ANCHO / 2, y); y += 88 }
    ctx.shadowBlur = 0
  }
  if (sub) {
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.font = "600 32px 'Segoe UI', system-ui, sans-serif"
    ctx.fillText(String(sub).slice(0, 120), ANCHO / 2, ALTO / 2 + 150)
  }
}

// Cabecera (esquinas) para la escena "Letra": logo + nombre a la izquierda,
// título · tono a la derecha. Con sombra para leerse sobre cualquier fondo.
function dibujarCabecera(ctx: CanvasRenderingContext2D, nombre: string, titulo: string, tono: string, logo: HTMLImageElement | null) {
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 8
  ctx.textBaseline = "middle"
  const yc = 58
  let x = 40
  if (logo && logo.width > 0) {
    const lh = 72, lw = logo.width * (lh / logo.height)
    ctx.globalAlpha = 0.97
    ctx.drawImage(logo, x, yc - lh / 2, lw, lh)
    ctx.globalAlpha = 1
    x += lw + 18
  }
  if (nombre) {
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.font = "700 26px 'Segoe UI', system-ui, sans-serif"
    ctx.fillText(nombre.toUpperCase(), x, yc)
  }
  if (titulo) {
    ctx.textAlign = "right"
    ctx.fillStyle = C.ambar
    ctx.font = "700 22px 'Segoe UI', system-ui, sans-serif"
    const et = tono ? `${titulo.toUpperCase()}  ·  ${tono}` : titulo.toUpperCase()
    ctx.fillText(et, ANCHO - 40, yc)
  }
  ctx.restore()
}

// Nombre de la iglesia centrado arriba, elegante (línea de acento ámbar debajo).
function dibujarNombreCentrado(ctx: CanvasRenderingContext2D, nombre: string) {
  if (!nombre) return
  ctx.save()
  const texto = nombre.toUpperCase()
  const y = 52
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.font = "700 30px 'Segoe UI', system-ui, sans-serif"
  try { (ctx as any).letterSpacing = "3px" } catch {}
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10
  ctx.fillStyle = "rgba(255,255,255,0.96)"
  ctx.fillText(texto, ANCHO / 2, y)
  const w = ctx.measureText(texto).width
  try { (ctx as any).letterSpacing = "0px" } catch {}
  ctx.shadowBlur = 0
  // Línea de acento ámbar debajo del nombre
  const lineaW = Math.min(w * 0.5, 130)
  ctx.fillStyle = C.ambar
  redondear(ctx, ANCHO / 2 - lineaW / 2, y + 24, lineaW, 4, 2); ctx.fill()
  ctx.restore()
}

// Mensaje en vivo: banner inferior sobre todas las escenas.
function dibujarMensaje(ctx: CanvasRenderingContext2D, texto: string) {
  ctx.save()
  const h = 72, y = ALTO - h
  // Fondo del banner
  const g = ctx.createLinearGradient(0, y, 0, ALTO)
  g.addColorStop(0, "rgba(120,53,15,0.92)"); g.addColorStop(1, "rgba(146,64,14,0.92)")
  ctx.fillStyle = g; ctx.fillRect(0, y, ANCHO, h)
  // Línea de acento arriba
  ctx.fillStyle = C.ambar; ctx.fillRect(0, y, ANCHO, 4)
  // Texto (ajustado a una línea; si es muy largo se achica)
  let tam = 32
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillStyle = "#fff"
  const maxW = ANCHO - 120
  ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
  while (ctx.measureText(texto).width > maxW && tam > 18) { tam -= 2; ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif` }
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 6
  ctx.fillText(texto, ANCHO / 2, y + h / 2 + 2)
  ctx.restore()
}

function fmtTiempo(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60
  const mm = String(m).padStart(2, "0"), ss = String(seg).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function nombreEstado(t: string): string {
  return t === "cuenta-regresiva" ? "Cuenta regresiva"
    : t === "mensaje" ? "Mensaje"
    : t === "logo" ? "Logo"
    : t === "descanso" ? "Descanso"
    : t === "espera" ? "Pantalla de espera"
    : "Pantalla especial"
}

function botonBase(extra: React.CSSProperties): React.CSSProperties {
  return { padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, ...extra }
}

const selectEstilo: React.CSSProperties = {
  width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)", background: "#0a1525",
  color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
}
