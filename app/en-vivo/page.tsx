"use client"

// ── Transmisión en vivo (nativa, sin OBS) ────────────────────────────────────
// Incremento 1: capturar cámara + micrófono, reflejar la letra que se está
// proyectando (mismo socket que /proyectar) y componer todo en un lienzo que es
// la vista previa de "lo que saldría al aire". El botón "Salir en vivo" (empujar
// a Facebook/YouTube por RTMP con ffmpeg) llega en el siguiente incremento.

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { io, Socket } from "socket.io-client"
import { navegarSPA } from "@/lib/navegar"
import { getSocketUrl } from "@/lib/servidor"
import { getIglesiaId } from "@/lib/getIglesia"
import { useApp } from "@/context/AppContext"
import ObjetoEditable from "@/components/ObjetoEditable"

type Escena = "camara" | "camara-letra" | "letra" | "espera"
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
const CELULAR = "__celular__" // "deviceId" especial: la cámara es el celular (WebRTC)

// Sección colapsable de los controles (a nivel módulo para no perder su estado
// al re-renderizar). Encabezado que abre/cierra; la más usada arranca abierta.
function Seccion({ titulo, sub, defaultOpen = false, children }: { titulo: string; sub?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "15px 20px", background: "transparent", border: "none", cursor: "pointer", color: C.texto, textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{titulo}</span>
          {sub && <span style={{ fontSize: 11.5, color: C.tenue }}>{sub}</span>}
        </span>
        <span style={{ fontSize: 13, color: C.tenue, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>▸</span>
      </button>
      {open && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
    </div>
  )
}

// Posiciones/tamaños por defecto de los objetos movibles (para "Resetear").
const POS_DEF = {
  logo: { pos: { x: ANCHO - 168 - 30, y: 26 }, tam: 168 },
  nombre: { pos: { x: ANCHO / 2 - 220, y: 26 }, tam: 30 },
  letra: { pos: { x: (ANCHO - 680) / 2, y: 348 }, tam: 680 },
  pip: { pos: { x: ANCHO - 360 - 40, y: ALTO - 202 - 40 }, tam: 360 },
  mensajePos: "abajo" as "abajo" | "arriba",
}

// ── Temas de color (marca de la iglesia) ─────────────────────────────────────
// Cada iglesia elige un tema; el acento tiñe líneas, barras, puntos, el nombre,
// la barra de la letra y la letra del mensaje. 12 tonos + color personalizado.
const TEMAS: [string, string][] = [
  ["#f59e0b", "Ámbar"], ["#eab308", "Dorado"], ["#f97316", "Naranja"],
  ["#dc2626", "Rojo"], ["#ec4899", "Rosa"], ["#8b5cf6", "Morado"],
  ["#6366f1", "Índigo"], ["#2563eb", "Azul"], ["#06b6d4", "Cian"],
  ["#14b8a6", "Turquesa"], ["#22c55e", "Verde"], ["#84cc16", "Lima"],
]

// ── Diseños de los gráficos (forma/estilo de los overlays al aire) ───────────
// No es el color: es la FORMA. Cada diseño cambia la caja de la letra, el
// nombre y el mensaje de manera coordinada. El color del tema se aplica encima.
type Diseno = "vidrio" | "tarjeta" | "minimal" | "broadcast"
const DISENOS: [Diseno, string, string][] = [
  ["vidrio", "Vidrio", "Caja oscura translúcida y redondeada, barra de acento."],
  ["tarjeta", "Tarjeta", "Marco con borde de acento y título en pastilla. Editorial."],
  ["minimal", "Minimal", "Sin caja: letra grande con sombra y línea de acento. Limpio."],
  ["broadcast", "Broadcast", "Barras sólidas estilo noticiero de TV. Potente y claro."],
]
const ES_DISENO = (d: string): d is Diseno => DISENOS.some(([id]) => id === d)

// Color de texto legible SOBRE un fondo del color de acento (para pastillas):
// negro cálido si el acento es claro, blanco si es oscuro.
function textoSobreAcento(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return "#141414"
  const n = parseInt(m[1], 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? "#1a1205" : "#ffffff"
}

// Aclara un color hasta que sea legible sobre el vidrio oscuro del mensaje
// (mezcla con blanco si su luminancia es baja). Así cualquier tema, incluso los
// oscuros como rojo o índigo, deja el texto del mensaje nítido y con la marca.
function legibleSobreOscuro(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return "#ffffff"
  const n = parseInt(m[1], 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (lum < 0.62) {
    const t = (0.62 - lum) / 0.62 // cuánto mezclar hacia el blanco
    r = Math.round(r + (255 - r) * t); g = Math.round(g + (255 - g) * t); b = Math.round(b + (255 - b) * t)
  }
  return `rgb(${r},${g},${b})`
}

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
  const [mensajePos, setMensajePos] = useState<"abajo" | "arriba">("abajo")

  // Nombre de la iglesia como objeto movible/redimensionable
  const [nombrePos, setNombrePos] = useState<{ x: number; y: number }>({ x: ANCHO / 2 - 220, y: 26 })
  const [nombreTam, setNombreTam] = useState(30)

  // Letra sobre la cámara como objeto movible/redimensionable (ancho; alto = ancho×RATIO)
  const [letraPos, setLetraPos] = useState<{ x: number; y: number }>({ x: (ANCHO - 680) / 2, y: 348 })
  const [letraTam, setLetraTam] = useState(680)

  // Gráficos propios (imágenes que el usuario sube como objetos movibles)
  const [graficos, setGraficos] = useState<{ id: string; url: string; pos: { x: number; y: number }; w: number; aspecto: number }[]>([])
  const graficoImgs = useRef<Record<string, HTMLImageElement>>({})
  useEffect(() => {
    try { const g = localStorage.getItem("en-vivo-graficos"); if (g) setGraficos(JSON.parse(g)) } catch {}
  }, [])
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-graficos", JSON.stringify(graficos)) } catch {} }, 400); return () => clearTimeout(t) }, [graficos])
  // Cargar la imagen de cada gráfico
  useEffect(() => {
    for (const g of graficos) {
      if (graficoImgs.current[g.id]) continue
      const img = new Image(); img.crossOrigin = "anonymous"
      img.onload = () => { graficoImgs.current[g.id] = img }
      img.src = g.url
    }
    // limpiar imágenes de gráficos eliminados
    for (const id of Object.keys(graficoImgs.current)) if (!graficos.some(g => g.id === id)) delete graficoImgs.current[id]
  }, [graficos])
  const setGraficoPos = (id: string, pos: { x: number; y: number }, w: number) =>
    setGraficos(gs => gs.map(g => g.id === id ? { ...g, pos, w: Math.round(w) } : g))
  const agregarGrafico = (file: File) => {
    const r = new FileReader()
    r.onload = () => {
      const url = String(r.result || "")
      const img = new Image()
      img.onload = () => {
        const w = Math.min(360, img.width)
        setGraficos(gs => [...gs, { id: "g" + Date.now(), url, pos: { x: ANCHO / 2 - w / 2, y: ALTO / 2 - (w * img.height / img.width) / 2 }, w, aspecto: img.height / img.width || 1 }])
      }
      img.src = url
    }
    r.readAsDataURL(file)
  }
  const quitarGrafico = (id: string) => { setGraficos(gs => gs.filter(g => g.id !== id)); delete graficoImgs.current[id] }

  // Personalización (guardada en el equipo)
  const [colorLetra, setColorLetra] = useState("#ffffff")
  const [acento, setAcento] = useState("#f59e0b") // color de marca (acentos) por iglesia
  const [diseno, setDiseno] = useState<Diseno>("vidrio") // forma/estilo de los gráficos
  // Layout: en pantallas anchas, vista previa a la izquierda + controles a la derecha.
  const [esAncho, setEsAncho] = useState(false)
  useEffect(() => {
    const check = () => setEsAncho(window.innerWidth >= 1024)
    check(); window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])
  const [logoPos, setLogoPos] = useState<{ x: number; y: number }>({ x: ANCHO - 168 - 30, y: 26 })
  const [logoTam, setLogoTam] = useState(168)
  const [logoAspecto, setLogoAspecto] = useState(1) // alto/ancho del logo
  // Recuadro de la Cámara 2 (PiP) — objeto movible/redimensionable
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: ANCHO - 360 - 40, y: ALTO - 202 - 40 })
  const [pipTam, setPipTam] = useState(360) // ancho; el alto es 16:9
  useEffect(() => {
    try {
      const c = localStorage.getItem("en-vivo-color-letra"); if (c) setColorLetra(c)
      const ac = localStorage.getItem("en-vivo-acento"); if (ac) setAcento(ac)
      const ds = localStorage.getItem("en-vivo-diseno"); if (ds && ES_DISENO(ds)) setDiseno(ds)
      const gr = localStorage.getItem("en-vivo-grabar"); if (gr === "0") setGrabar(false)
      const la = localStorage.getItem("en-vivo-limpiar-audio"); if (la === "0") setLimpiarAudio(false)
      const ca = localStorage.getItem("en-vivo-calidad"); if (ca === "baja" || ca === "media" || ca === "alta") setCalidad(ca)
      const tr = localStorage.getItem("en-vivo-transiciones"); if (tr === "0") setTransiciones(false)
      const et = localStorage.getItem("en-vivo-espera-texto"); if (et) setEsperaTexto(et)
      const t = localStorage.getItem("en-vivo-logo-tam"); if (t) setLogoTam(Number(t) || 168)
      const p = localStorage.getItem("en-vivo-logo-pos"); if (p) setLogoPos(JSON.parse(p))
      const pip = localStorage.getItem("en-vivo-pip"); if (pip) { const o = JSON.parse(pip); if (o.pos) setPipPos(o.pos); if (o.tam) setPipTam(o.tam) }
      const nom = localStorage.getItem("en-vivo-nombre"); if (nom) { const o = JSON.parse(nom); if (o.pos) setNombrePos(o.pos); if (o.tam) setNombreTam(o.tam) }
      const let_ = localStorage.getItem("en-vivo-letra"); if (let_) { const o = JSON.parse(let_); if (o.pos) setLetraPos(o.pos); if (o.tam) setLetraTam(o.tam) }
      const mp = localStorage.getItem("en-vivo-mensaje-pos"); if (mp === "arriba" || mp === "abajo") setMensajePos(mp)
    } catch {}
  }, [])
  const guardarColor = (c: string) => { setColorLetra(c); try { localStorage.setItem("en-vivo-color-letra", c) } catch {} }
  const guardarAcento = (c: string) => { setAcento(c); try { localStorage.setItem("en-vivo-acento", c) } catch {} }
  const guardarDiseno = (d: Diseno) => { setDiseno(d); try { localStorage.setItem("en-vivo-diseno", d) } catch {} }
  const cambiarLogoTam = (t: number) => { setLogoTam(t) }
  // Guardar posiciones/tamaños (con leve retardo para no escribir en cada píxel)
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-logo-pos", JSON.stringify(logoPos)); localStorage.setItem("en-vivo-logo-tam", String(logoTam)) } catch {} }, 300); return () => clearTimeout(t) }, [logoPos, logoTam])
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-pip", JSON.stringify({ pos: pipPos, tam: pipTam })) } catch {} }, 300); return () => clearTimeout(t) }, [pipPos, pipTam])
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-nombre", JSON.stringify({ pos: nombrePos, tam: nombreTam })) } catch {} }, 300); return () => clearTimeout(t) }, [nombrePos, nombreTam])
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("en-vivo-letra", JSON.stringify({ pos: letraPos, tam: letraTam })) } catch {} }, 300); return () => clearTimeout(t) }, [letraPos, letraTam])


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
  const [txEstado, setTxEstado] = useState<"idle" | "conectando" | "vivo" | "reconectando" | "error">("idle")
  const [errorTx, setErrorTx] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [logsTx, setLogsTx] = useState<string[]>([])
  const recRef = useRef<MediaRecorder | null>(null)
  const txEstadoRef = useRef(txEstado)
  useEffect(() => { txEstadoRef.current = txEstado }, [txEstado])

  // Panel de salud del stream (viene de las estadísticas de ffmpeg).
  const [salud, setSalud] = useState<{ bitrate: number | null; fps: number | null; speed: number | null; drop: number | null } | null>(null)
  const [intento, setIntento] = useState(0) // nº de reintento de reconexión en curso

  // Grabación local (respaldo). Grabador DEDICADO, independiente del de stream,
  // para que una reconexión no interrumpa la grabación.
  const [grabar, setGrabar] = useState(true) // preferencia: grabar el culto
  const [grabInfo, setGrabInfo] = useState<{ carpeta?: string; ruta?: string; listo?: boolean } | null>(null)
  const [grabMB, setGrabMB] = useState(0)
  const intentoRef = useRef(0)

  // ── Audio: reducción de ruido + medidor de nivel (VU) ───────────────────────
  const [limpiarAudio, setLimpiarAudio] = useState(true) // supresión de ruido/eco/AGC
  const limpiarAudioRef = useRef(true)
  const [sinAudio, setSinAudio] = useState(false) // el micro lleva un rato en silencio
  const [audioGen, setAudioGen] = useState(0) // sube cada vez que hay un track de audio nuevo listo
  const audioCtxRef = useRef<any>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vuFillRef = useRef<HTMLDivElement | null>(null)   // barra de nivel (se anima por DOM, sin re-render)
  const vuPeakRef = useRef<HTMLDivElement | null>(null)   // marca de pico
  const rafVuRef = useRef<number>(0)
  const ultimoSonidoRef = useRef<number>(Date.now())

  // ── Tier 3: compartir pantalla, calidad de salida, transiciones ─────────────
  const [pantallaOn, setPantallaOn] = useState(false)
  const [camaraEnPip, setCamaraEnPip] = useState(true) // mostrar la cámara en recuadro sobre la pantalla
  const [fuentesPantalla, setFuentesPantalla] = useState<{ id: string; nombre: string; thumb: string; esPantalla: boolean }[] | null>(null)
  const [pickerPantalla, setPickerPantalla] = useState(false)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Cámara desde el celular (WebRTC por la LAN). El PC es el "host": muestra un
  // QR/código, el celular se une y le manda su video.
  const [celularOn, setCelularOn] = useState(false)           // hay un celular conectado como cámara
  const [camModal, setCamModal] = useState(false)             // modal de emparejamiento (QR)
  const [camCodigo, setCamCodigo] = useState("")
  const [camEstado, setCamEstado] = useState<"esperando" | "conectado" | "error">("esperando")
  const [camError, setCamError] = useState("")
  const phoneVideoRef = useRef<HTMLVideoElement | null>(null)
  const phoneStreamRef = useRef<MediaStream | null>(null)
  const pcHostRef = useRef<RTCPeerConnection | null>(null)
  const camSocketRef = useRef<Socket | null>(null)
  const camCodigoRef = useRef("")

  const [calidad, setCalidad] = useState<"baja" | "media" | "alta">("media")
  const CALIDAD_KBPS: Record<string, number> = { baja: 1200, media: 2500, alta: 4500 }

  const [transiciones, setTransiciones] = useState(true) // fundido al cambiar de escena
  const transRef = useRef<{ hasta: number; snap: HTMLCanvasElement } | null>(null)
  const escenaDibujadaRef = useRef<string>("")

  // Pantalla de espera "El culto comienza pronto" + cuenta regresiva.
  const [esperaTexto, setEsperaTexto] = useState("El culto comienza pronto")
  const [esperaHasta, setEsperaHasta] = useState<number | null>(null) // timestamp objetivo (ms) o null
  const [esperaMin, setEsperaMin] = useState(10) // minutos para el contador

  // Grabar sin transmitir (modo "solo grabar").
  const [grabandoSolo, setGrabandoSolo] = useState(false)
  const recSoloRef = useRef<MediaRecorder | null>(null)

  const [mostrarAtajos, setMostrarAtajos] = useState(false) // leyenda de atajos de teclado
  const [aviso, setAviso] = useState("") // toast breve (resetear/guardar armado)
  const avisoTimerRef = useRef<any>(null)
  const flash = (m: string) => { setAviso(m); if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current); avisoTimerRef.current = setTimeout(() => setAviso(""), 2200) }
  const grabBytesRef = useRef(0)
  const grabActivaRef = useRef(false)

  // Refs para reconectar sin re-suscribir listeners.
  const mimeRef = useRef<string>("video/webm")
  const urlsTxRef = useRef<string[]>([])
  const bitrateRef = useRef<number>(2500) // kbps elegido para la sesión
  const detenidoRef = useRef(false) // el usuario pidió terminar → no reconectar
  const reconTimerRef = useRef<any>(null)
  const reconectarRef = useRef<() => void>(() => {})

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
  const contenidoRef = useRef({ titulo: "", tono: "", partes: [] as any[], index: 0, escena: "camara-letra" as Escena, nombre: "", bibliaTexto: "", bibliaRef: "", mensaje: "", color: "#ffffff", logoPos: { x: 0, y: 0 }, logoTam: 168, camaraActiva: 1 as 1 | 2 | "ambas", pipPos: { x: 0, y: 0 }, pipTam: 360, estadoEsp: null as any, hayVideo: false, nombrePos: { x: 0, y: 0 }, nombreTam: 30, mensajePos: "abajo" as "abajo" | "arriba", letraPos: { x: 0, y: 0 }, letraTam: 940, graficos: [] as { id: string; pos: { x: number; y: number }; w: number; aspecto: number }[], acento: "#f59e0b", diseno: "vidrio" as Diseno, pantallaOn: false, camaraEnPip: true, transiciones: true, esperaTexto: "", esperaHasta: null as number | null, celularOn: false, cam1Celular: false, cam2Celular: false })
  useEffect(() => {
    const bibliaTexto = biblia ? limpiarTexto(biblia.paginas?.[paginaBiblia] || biblia.texto || "") : ""
    contenidoRef.current = { titulo, tono, partes, index, escena, nombre: nombreIglesia, bibliaTexto, bibliaRef: biblia?.referencia || "", mensaje: mostrarMensaje ? mensajeVivo.trim() : "", color: colorLetra, logoPos, logoTam, camaraActiva, pipPos, pipTam, estadoEsp, hayVideo: !!videoUrl, nombrePos, nombreTam, mensajePos, letraPos, letraTam, graficos, acento, diseno, pantallaOn, camaraEnPip, transiciones, esperaTexto, esperaHasta, celularOn, cam1Celular: camaraId === CELULAR, cam2Celular: camara2Id === CELULAR }
  }, [titulo, tono, partes, index, escena, nombreIglesia, biblia, paginaBiblia, mostrarMensaje, mensajeVivo, colorLetra, logoPos, logoTam, camaraActiva, pipPos, pipTam, estadoEsp, videoUrl, nombrePos, nombreTam, mensajePos, letraPos, letraTam, graficos, acento, diseno, pantallaOn, camaraEnPip, transiciones, esperaTexto, esperaHasta, celularOn, camaraId, camara2Id])

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

        // Audio con limpieza opcional (supresión de ruido, eco y ganancia
        // automática). Clave en iglesias: quita el zumbido del salón.
        const audioBase: MediaTrackConstraints = {
          echoCancellation: limpiarAudioRef.current,
          noiseSuppression: limpiarAudioRef.current,
          autoGainControl: limpiarAudioRef.current,
        }
        // El video puede venir del CELULAR (WebRTC) → acá no se pide cámara.
        // El audio puede venir del CELULAR (mic del celular) → acá no se pide mic.
        const constraints: MediaStreamConstraints = {
          video: camaraId === CELULAR ? false
               : camaraId ? { deviceId: { exact: camaraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                          : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: microId === CELULAR ? false
               : microId ? { deviceId: { exact: microId }, ...audioBase } : audioBase,
        }
        // Si TODO viene del celular (cámara y micrófono), no hay getUserMedia local.
        if (!constraints.video && !constraints.audio) {
          streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
          if (videoRef.current) videoRef.current.srcObject = null
          setPermiso("ok"); ultimoSonidoRef.current = Date.now(); setAudioGen(g => g + 1)
          return
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
        ultimoSonidoRef.current = Date.now() // no marcar "sin audio" apenas arranca
        setAudioGen(g => g + 1) // hay un track de audio nuevo → re-enganchar el VU

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

  // Aplicar la limpieza de audio al track EN VIVO (sin reiniciar la cámara).
  useEffect(() => {
    limpiarAudioRef.current = limpiarAudio
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.applyConstraints({ echoCancellation: limpiarAudio, noiseSuppression: limpiarAudio, autoGainControl: limpiarAudio }).catch(() => {})
  }, [limpiarAudio, audioGen])

  // Medidor de nivel (VU): analiza el track de audio y anima la barra por DOM
  // (sin re-render). Avisa si el micrófono lleva un rato en silencio.
  useEffect(() => {
    // El VU mide la fuente de audio ACTIVA (celular si es el mic elegido, si no el PC).
    const celTrack = phoneStreamRef.current?.getAudioTracks?.()[0]
    const track = (microId === CELULAR && celTrack) ? celTrack : streamRef.current?.getAudioTracks()[0]
    if (!track) return
    let cancelado = false
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx(); audioCtxRef.current = ctx
      try { ctx.resume?.() } catch {}
      const src = ctx.createMediaStreamSource(new MediaStream([track]))
      const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.75
      src.connect(an); analyserRef.current = an
      const datos = new Uint8Array(an.fftSize)
      let pico = 0
      const loop = () => {
        if (cancelado) return
        an.getByteTimeDomainData(datos)
        let sum = 0
        for (let i = 0; i < datos.length; i++) { const v = (datos[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / datos.length)              // 0..1
        const nivel = Math.min(1, rms * 2.2)                    // realce para lectura visual
        pico = Math.max(nivel, pico * 0.92)                     // pico con caída suave
        if (nivel > 0.02) ultimoSonidoRef.current = Date.now()
        const col = nivel > 0.9 ? "#f87171" : nivel > 0.65 ? "#fbbf24" : "#4ade80"
        if (vuFillRef.current) { vuFillRef.current.style.width = `${Math.round(nivel * 100)}%`; vuFillRef.current.style.background = col }
        if (vuPeakRef.current) vuPeakRef.current.style.left = `${Math.round(pico * 100)}%`
        rafVuRef.current = requestAnimationFrame(loop)
      }
      rafVuRef.current = requestAnimationFrame(loop)
    } catch { /* Web Audio no disponible: sin medidor */ }
    return () => {
      cancelado = true
      cancelAnimationFrame(rafVuRef.current)
      try { audioCtxRef.current?.close() } catch {}
      audioCtxRef.current = null; analyserRef.current = null
    }
  }, [audioGen, microId, celularOn])

  // Aviso de "sin audio": el micro lleva >4s en silencio mientras hay cámara.
  useEffect(() => {
    if (permiso !== "ok") return
    const t = setInterval(() => setSinAudio(Date.now() - ultimoSonidoRef.current > 4000), 1000)
    return () => clearInterval(t)
  }, [permiso])

  // ── Cámara 2 (opcional, solo video) — para multicámara ──────────────────────
  useEffect(() => {
    let cancelado = false
    if (!camara2Id) {
      stream2Ref.current?.getTracks().forEach(t => t.stop()); stream2Ref.current = null
      if (video2Ref.current) video2Ref.current.srcObject = null
      setCamaraActiva(1) // sin cámara 2, volver a la 1
      return
    }
    // Cámara 2 = CELULAR: el video lo entrega el celular (phoneVideoRef), no hay
    // getUserMedia local. Liberamos la cámara 2 local si estaba abierta.
    if (camara2Id === CELULAR) {
      stream2Ref.current?.getTracks().forEach(t => t.stop()); stream2Ref.current = null
      if (video2Ref.current) video2Ref.current.srcObject = null
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
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    phoneStreamRef.current?.getTracks().forEach(t => t.stop())
    try { pcHostRef.current?.close() } catch {}
    try { camSocketRef.current?.close() } catch {}
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
      if (d?.estado !== "error" && d?.estado !== "terminado") return
      if (detenidoRef.current) return // parada intencional del usuario
      const est = txEstadoRef.current
      // Caída inesperada estando al aire (o reconectando) → reconectar solo.
      if (d?.inesperado && (est === "vivo" || est === "reconectando")) { reconectarRef.current(); return }
      // Falla al conectar por primera vez, o cierre no recuperable → avisar.
      if (est === "conectando" || est === "vivo" || est === "reconectando") {
        try { recRef.current?.stop() } catch {}
        recRef.current = null
        setTxEstado("error")
        setErrorTx(d?.error || (d?.code ? "La transmisión se cortó. Revisa los detalles técnicos más abajo." : "La transmisión terminó inesperadamente."))
      }
    })
    const offLog = tx.onLog((m: string) => {
      agregarLog(m)
      const linea = (m || "").trim()
      if (linea) setErrorTx(prev => (txEstadoRef.current === "conectando" ? linea : prev))
    })
    const offStats = tx.onStats?.((d: any) => {
      setSalud({ bitrate: d?.bitrate ?? null, fps: d?.fps ?? null, speed: d?.speed ?? null, drop: d?.drop ?? null })
      if (txEstadoRef.current === "vivo") intentoRef.current = 0 // estable → resetear reintentos
    })
    const offGrab = tx.onGrabacionListo?.((d: any) => {
      setGrabInfo(gi => ({ ...(gi || {}), carpeta: d?.carpeta, ruta: d?.ruta, listo: true }))
    })
    return () => { offEstado?.(); offLog?.(); offStats?.(); offGrab?.() }
  }, [])

  // Cronómetro de sesión: cuenta al aire Y mientras reconecta (la grabación
  // sigue), sin reiniciarse en la transición. Se pone en 0 al iniciar (salirEnVivo).
  useEffect(() => {
    if (txEstado !== "vivo" && txEstado !== "reconectando" && !grabandoSolo) return
    const t = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [txEstado, grabandoSolo])

  // Atajos de teclado del operador (se ignoran mientras escribes en un campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as any).isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      switch (e.key) {
        case "1": setEscena("camara"); break
        case "2": setEscena("camara-letra"); break
        case "3": setEscena("letra"); break
        case "4": setEscena("espera"); break
        case "m": case "M": if (mensajeVivo.trim() || mostrarMensaje) setMostrarMensaje(v => !v); break
        case "c": case "C": if (camara2Id) setCamaraActiva(a => (a === 1 ? 2 : a === 2 ? "ambas" : 1)); break
        case "r": case "R": resetearPosiciones(); break
        default: return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajeVivo, mostrarMensaje, camara2Id])

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
        // Cada "slot" de cámara puede ser la cámara local o el CELULAR (WebRTC).
        const v1 = cont.cam1Celular ? phoneVideoRef.current : videoRef.current
        const v2 = cont.cam2Celular ? phoneVideoRef.current : video2Ref.current
        // Cámara al aire (1 o 2). Si la 2 no está lista, cae a la 1.
        const v = (cont.camaraActiva === 2 && v2 && v2.videoWidth > 0) ? v2 : v1
        const logo = logoImgRef.current
        const imagen = imagenImgRef.current
        const esLetra = cont.escena === "letra"

        // Contenido activo: prioridad imagen > biblia > letra de canción.
        const hayBiblia = !!cont.bibliaTexto.trim()
        const textoContenido = hayBiblia ? cont.bibliaTexto : limpiarLetra(cont.partes[cont.index])
        const tituloContenido = hayBiblia ? cont.bibliaRef : cont.titulo
        const tonoContenido = hayBiblia ? "" : cont.tono

        // Transición (fundido) al cambiar de escena: capturamos el fotograma
        // anterior ANTES de limpiar, para fundirlo sobre la escena nueva.
        const claveEscena = `${cont.escena}|${cont.pantallaOn ? "p" : ""}`
        if (cont.transiciones && escenaDibujadaRef.current && escenaDibujadaRef.current !== claveEscena && canvas.width) {
          let snap = transRef.current?.snap
          if (!snap) { snap = document.createElement("canvas"); snap.width = ANCHO; snap.height = ALTO }
          const sctx = snap.getContext("2d")
          if (sctx) { sctx.clearRect(0, 0, ANCHO, ALTO); sctx.drawImage(canvas, 0, 0) }
          transRef.current = { hasta: performance.now() + 350, snap }
        }
        escenaDibujadaRef.current = claveEscena

        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, ANCHO, ALTO)

        const hayMensaje = !!cont.mensaje

        if (cont.escena === "espera") {
          // Pantalla de espera: fondo brandeado + logo + nombre + titular + contador.
          dibujarPantallaEspera(ctx, cont.esperaTexto, cont.esperaHasta, cont.nombre, logo, cont.acento)
        } else if (esLetra) {
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
          if (!cont.estadoEsp) dibujarCabecera(ctx, cont.nombre, tituloContenido, tonoContenido, logo, cont.acento)
        } else {
          // Escenas con cámara ("camara" y "camara-letra") o pantalla compartida.
          // v ya resuelve a la cámara al aire (local o celular).
          const sv = screenVideoRef.current
          if (cont.pantallaOn && sv && sv.videoWidth > 0) {
            // Pantalla: "contain" (no recorta diapositivas), letterbox negro.
            const es = Math.min(ANCHO / sv.videoWidth, ALTO / sv.videoHeight)
            const w = sv.videoWidth * es, h = sv.videoHeight * es
            ctx.drawImage(sv, (ANCHO - w) / 2, (ALTO - h) / 2, w, h)
          } else if (v && v.videoWidth > 0) {
            const escala = Math.max(ANCHO / v.videoWidth, ALTO / v.videoHeight)
            const w = v.videoWidth * escala, h = v.videoHeight * escala
            ctx.drawImage(v, (ANCHO - w) / 2, (ALTO - h) / 2, w, h)
          }
          // Recuadro (PiP): la cámara del presentador sobre la pantalla, o la
          // Cámara 2 en modo "ambas". Ambos usan la misma caja movible.
          const pip = (cont.pantallaOn && cont.camaraEnPip && v1 && v1.videoWidth > 0) ? v1
                    : (!cont.pantallaOn && cont.camaraActiva === "ambas" && v2 && v2.videoWidth > 0) ? v2
                    : null
          if (pip) {
            const { x, y } = cont.pipPos, pw = cont.pipTam, ph = pw * 9 / 16
            ctx.save()
            redondear(ctx, x, y, pw, ph, 12); ctx.clip()
            const es = Math.max(pw / pip.videoWidth, ph / pip.videoHeight)
            const w = pip.videoWidth * es, h = pip.videoHeight * es
            ctx.drawImage(pip, x + (pw - w) / 2, y + (ph - h) / 2, w, h)
            ctx.restore()
            ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3
            redondear(ctx, x, y, pw, ph, 12); ctx.stroke()
          }
          // Nombre de la iglesia (objeto movible)
          dibujarNombreCentrado(ctx, cont.nombre, cont.nombrePos, cont.nombreTam, cont.acento, cont.diseno)
          // Letra en caja movible solo en "camara-letra" (letra o versículo)
          if (cont.escena === "camara-letra" && textoContenido.trim()) {
            dibujarLetraCaja(ctx, textoContenido, tituloContenido, tonoContenido, cont.letraPos.x, cont.letraPos.y, cont.letraTam, cont.color, cont.acento, cont.diseno)
          }
          // Gráficos propios (imágenes que el usuario subió)
          for (const g of cont.graficos) {
            const gi = graficoImgs.current[g.id]
            if (gi && gi.width > 0) ctx.drawImage(gi, g.pos.x, g.pos.y, g.w, g.w * g.aspecto)
          }
          // Logo movible/redimensionable (se dibuja al final para tapar la marca)
          if (logo && logo.width > 0) {
            const lw = cont.logoTam, lh = logo.height * (lw / logo.width)
            ctx.globalAlpha = 0.97
            ctx.drawImage(logo, cont.logoPos.x, cont.logoPos.y, lw, lh)
            ctx.globalAlpha = 1
          }
        }

        // Mensaje en vivo: banner sobre todas las escenas (arriba o abajo).
        // El mensaje va sobre todas las escenas MENOS la de espera (ahí molesta).
        if (hayMensaje && cont.escena !== "espera") dibujarMensaje(ctx, cont.mensaje, cont.mensajePos, cont.acento, cont.diseno)

        // Fundido de la transición: el fotograma anterior se desvanece encima.
        const tr = transRef.current
        if (tr) {
          const restante = tr.hasta - performance.now()
          if (restante > 0) { ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, restante / 350)); ctx.drawImage(tr.snap, 0, 0); ctx.restore() }
          else transRef.current = null
        }
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

  // Un MediaStream nuevo del lienzo + audio (cada captureStream da un track
  // propio; el audio se puede compartir entre varios streams sin problema).
  const streamSalida = (): MediaStream | null => {
    if (!canvasRef.current) return null
    // Audio: del CELULAR si es el micrófono elegido (y trae audio); si no, del PC.
    const audioCel = phoneStreamRef.current?.getAudioTracks?.() || []
    const audio = (microId === CELULAR && audioCel.length > 0) ? audioCel
                : (streamRef.current?.getAudioTracks() || [])
    return new MediaStream([
      ...canvasRef.current.captureStream(30).getVideoTracks(),
      ...audio,
    ])
  }

  // Arranca ffmpeg + un grabador de STREAM fresco. Se usa al iniciar y en cada
  // reconexión (el grabador se recrea para que ffmpeg reciba una cabecera limpia).
  // Un solo encode: cada trozo va a ffmpeg y, si se está grabando, también a disco.
  const arrancarStreamRecorder = async (): Promise<boolean> => {
    const tx = (window as any).transmision
    if (!tx) return false
    const res = await tx.iniciar({ rtmpUrls: urlsTxRef.current, bitrateKbps: bitrateRef.current })
    if (!res?.ok) { setErrorTx(res?.error || "No se pudo iniciar la transmisión."); return false }
    try {
      const salida = streamSalida(); if (!salida) return false
      const rec = new MediaRecorder(salida, { mimeType: mimeRef.current, videoBitsPerSecond: bitrateRef.current * 1000, audioBitsPerSecond: 128_000 })
      rec.ondataavailable = async ev => {
        if (!ev.data || !ev.data.size) return
        try {
          const buf = new Uint8Array(await ev.data.arrayBuffer())
          tx.enviarChunk(buf)
          if (grabActivaRef.current) {
            tx.enviarChunkGrabacion?.(buf)
            grabBytesRef.current += buf.byteLength; setGrabMB(Math.round(grabBytesRef.current / 1048576))
          }
        } catch {}
      }
      rec.start(250)
      recRef.current = rec
      return true
    } catch (e: any) { setErrorTx("No se pudo capturar el video: " + (e?.message || "")); return false }
  }

  // Abre el archivo de grabación (respaldo). Los trozos los reparte el grabador
  // de stream (no hay un segundo encode). En reconexión rodamos a un segmento.
  const arrancarGrabacion = async () => {
    const tx = (window as any).transmision
    if (!tx || !grabar) return
    const r = await tx.iniciarGrabacion?.({ nombre: nombreIglesia || "Culto" })
    if (!r?.ok) { setLogsTx(p => [...p, `⚠ no se pudo grabar: ${r?.error || ""}`]); return }
    grabActivaRef.current = true; grabBytesRef.current = 0; setGrabMB(0)
    setGrabInfo({ carpeta: r.carpeta, ruta: r.ruta, listo: false })
  }

  const detenerGrabacion = async () => {
    const tx = (window as any).transmision
    if (grabActivaRef.current) { grabActivaRef.current = false; try { await tx?.detenerGrabacion?.() } catch {} }
  }

  // Reconexión automática: al caerse ffmpeg de forma inesperada, reintenta con
  // espera creciente. La grabación local sigue intacta durante todo el proceso.
  const reconectar = () => {
    if (detenidoRef.current) return
    if (reconTimerRef.current) return // ya hay un reintento agendado (evita duplicar)
    try { recRef.current?.stop() } catch {}
    recRef.current = null
    const n = (intentoRef.current || 0) + 1; intentoRef.current = n; setIntento(n)
    setTxEstado("reconectando")
    if (n > 30) { setTxEstado("error"); setErrorTx("No se pudo reconectar tras varios intentos. Revisa tu conexión."); return }
    const espera = Math.min(2000 * n, 10000)
    reconTimerRef.current = setTimeout(async () => {
      reconTimerRef.current = null
      if (detenidoRef.current) return
      // Rodar la grabación a un segmento nuevo: el grabador se recrea con
      // cabecera nueva, que no puede mezclarse en el mismo archivo mkv.
      if (grabActivaRef.current) { try { await (window as any).transmision?.nuevoSegmentoGrabacion?.() } catch {} }
      const ok = await arrancarStreamRecorder()
      if (ok) setTxEstado("vivo")
      else reconectar()
    }, espera)
  }
  reconectarRef.current = reconectar

  const salirEnVivo = async () => {
    setErrorTx(null)
    const tx = (window as any).transmision
    if (!tx) { setErrorTx("Esto solo funciona en la app de escritorio de Selah Live."); return }
    const rtmpUrls = construirUrls()
    if (rtmpUrls.length === 0) { setErrorTx("Activa al menos una plataforma y pega su clave / URL."); return }
    if (!canvasRef.current || !streamRef.current) { setErrorTx("La cámara aún no está lista."); return }

    setLogsTx([]); setSalud(null); setIntento(0); intentoRef.current = 0
    detenidoRef.current = false
    setSegundos(0)
    setGrabInfo(null); setGrabMB(0)
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
    mimeRef.current = mime
    urlsTxRef.current = rtmpUrls
    bitrateRef.current = CALIDAD_KBPS[calidad]
    setLogsTx(prev => [...prev, `▶ formato de captura: ${mime}`, `▶ destinos: ${rtmpUrls.length}`, `▶ calidad: ${calidad} (${CALIDAD_KBPS[calidad]}k)`, grabar ? "● grabación local: activada" : "○ grabación local: desactivada"])

    // Abrir la grabación ANTES de arrancar el grabador: así el primer trozo (que
    // trae la cabecera mkv) sí queda en el archivo.
    await arrancarGrabacion()
    const ok = await arrancarStreamRecorder()
    if (!ok) { setTxEstado("error"); await detenerGrabacion(); return }
    setTxEstado("vivo")
  }

  const terminar = async () => {
    detenidoRef.current = true
    if (reconTimerRef.current) { clearTimeout(reconTimerRef.current); reconTimerRef.current = null }
    try { recRef.current?.stop() } catch {}
    recRef.current = null
    try { await (window as any).transmision?.detener() } catch {}
    await detenerGrabacion()
    setTxEstado("idle"); setErrorTx(null); setSegundos(0); setSalud(null); setIntento(0); intentoRef.current = 0
  }

  // ── Compartir pantalla ──────────────────────────────────────────────────────
  const abrirPickerPantalla = async () => {
    const tx = (window as any).transmision
    if (!tx?.listarPantallas) { setErrorTx("Compartir pantalla funciona solo en la app de escritorio."); return }
    const r = await tx.listarPantallas()
    if (!r?.ok) { setErrorTx(r?.error || "No se pudieron listar las pantallas."); return }
    setFuentesPantalla(r.fuentes || []); setPickerPantalla(true)
  }

  const elegirPantalla = async (id: string) => {
    try {
      const stream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: id, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } },
      })
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current = stream
      if (screenVideoRef.current) { screenVideoRef.current.srcObject = stream; screenVideoRef.current.muted = true; await screenVideoRef.current.play().catch(() => {}) }
      // Si el usuario detiene la compartición desde el aviso del sistema.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => dejarPantalla())
      setPantallaOn(true); setPickerPantalla(false)
    } catch (e: any) { setErrorTx("No se pudo compartir la pantalla: " + (e?.message || "")) }
  }

  const dejarPantalla = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null
    setPantallaOn(false)
  }

  // ── Cámara desde el celular (host WebRTC) ───────────────────────────────────
  const cerrarCamaraCelular = (avisar = true) => {
    try { if (avisar) camSocketRef.current?.emit("camara:fin", { codigo: camCodigoRef.current }) } catch {}
    try { pcHostRef.current?.close() } catch {}; pcHostRef.current = null
    try { camSocketRef.current?.close() } catch {}; camSocketRef.current = null
    phoneStreamRef.current?.getTracks().forEach(t => t.stop()); phoneStreamRef.current = null
    if (phoneVideoRef.current) phoneVideoRef.current.srcObject = null
    setCelularOn(false); setCamModal(false); setCamEstado("esperando")
    // Liberar los slots que apuntaban al celular (cámara y mic vuelven al PC).
    setCamaraId(prev => prev === CELULAR ? "" : prev)
    setCamara2Id(prev => prev === CELULAR ? "" : prev)
    setMicroId(prev => prev === CELULAR ? "" : prev)
  }

  const abrirCamaraCelular = async () => {
    const tx = (window as any).transmision
    if (!tx?.infoRedCamara) { setErrorTx("Usar el celular como cámara funciona solo en la app de escritorio."); return }
    setCamError(""); setCamEstado("esperando")
    const codigo = Math.random().toString(36).slice(2, 8).toUpperCase()
    camCodigoRef.current = codigo; setCamCodigo(codigo)
    setCamModal(true)

    // Señalización (host): espera la oferta del celular y responde.
    const socket = io(getSocketUrl(), { transports: ["websocket", "polling"], forceNew: true })
    camSocketRef.current = socket
    socket.on("connect", () => socket.emit("camara:host", { codigo }))
    socket.on("camara:senal", async ({ data }: any) => {
      if (!data) return
      try {
        if (data.tipo === "offer") {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })
          pcHostRef.current = pc
          pc.ontrack = (e) => {
            phoneStreamRef.current = e.streams[0]
            if (phoneVideoRef.current) { phoneVideoRef.current.srcObject = e.streams[0]; phoneVideoRef.current.play().catch(() => {}) }
          }
          pc.onicecandidate = (e) => { if (e.candidate) socket.emit("camara:senal", { codigo, data: { tipo: "ice", candidate: e.candidate } }) }
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
              setCelularOn(true); setCamEstado("conectado")
              // Queda disponible como Cámara 2 (se puede cambiar a 1 o "ambas").
              setCamara2Id(prev => prev ? prev : CELULAR)
            }
            else if (pc.connectionState === "failed") { setCamEstado("error"); setCamError("No se pudo enlazar con el celular. ¿Están en la misma red?") }
          }
          await pc.setRemoteDescription(data.sdp)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit("camara:senal", { codigo, data: { tipo: "answer", sdp: pc.localDescription } })
        } else if (data.tipo === "ice" && data.candidate && pcHostRef.current) {
          await pcHostRef.current.addIceCandidate(data.candidate)
        }
      } catch {}
    })
    socket.on("camara:par-fin", () => cerrarCamaraCelular(false))
    socket.on("connect_error", () => { setCamEstado("error"); setCamError("No se pudo abrir la señalización.") })
  }

  // Formato de captura preferido (H264 mkv → menos CPU en el i3).
  const elegirMime = () => [
    "video/x-matroska;codecs=avc1,opus",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "video/webm"

  // ── Pantalla de espera + cuenta regresiva ───────────────────────────────────
  const guardarEsperaTexto = (t: string) => { setEsperaTexto(t); try { localStorage.setItem("en-vivo-espera-texto", t) } catch {} }
  const iniciarEspera = () => { setEsperaHasta(Date.now() + Math.max(0, esperaMin) * 60000); setEscena("espera") }

  // ── Grabar sin transmitir (solo a disco) ────────────────────────────────────
  const grabarSolo = async () => {
    const tx = (window as any).transmision
    if (!tx?.iniciarGrabacion) { setErrorTx("Grabar funciona solo en la app de escritorio."); return }
    if (!canvasRef.current || !streamRef.current) { setErrorTx("La cámara aún no está lista."); return }
    setErrorTx(null)
    const r = await tx.iniciarGrabacion({ nombre: nombreIglesia || "Culto" })
    if (!r?.ok) { setErrorTx(r?.error || "No se pudo iniciar la grabación."); return }
    grabActivaRef.current = true; grabBytesRef.current = 0; setGrabMB(0)
    setGrabInfo({ carpeta: r.carpeta, ruta: r.ruta, listo: false })
    try {
      const salida = streamSalida(); if (!salida) return
      mimeRef.current = elegirMime()
      const rec = new MediaRecorder(salida, { mimeType: mimeRef.current, videoBitsPerSecond: CALIDAD_KBPS[calidad] * 1000, audioBitsPerSecond: 128_000 })
      rec.ondataavailable = async ev => {
        if (!ev.data || !ev.data.size) return
        try { const buf = new Uint8Array(await ev.data.arrayBuffer()); tx.enviarChunkGrabacion?.(buf); grabBytesRef.current += buf.byteLength; setGrabMB(Math.round(grabBytesRef.current / 1048576)) } catch {}
      }
      rec.start(1000); recSoloRef.current = rec
      setSegundos(0); setGrabandoSolo(true)
    } catch (e: any) { setErrorTx("No se pudo capturar: " + (e?.message || "")); grabActivaRef.current = false; try { await tx.detenerGrabacion?.() } catch {} }
  }
  const detenerGrabarSolo = async () => {
    try { recSoloRef.current?.stop() } catch {}
    recSoloRef.current = null
    setGrabandoSolo(false)
    await detenerGrabacion()
    setSegundos(0)
  }

  // ── Resetear posiciones + guardar/restaurar armado ──────────────────────────
  const resetearPosiciones = () => {
    setLogoPos(POS_DEF.logo.pos); setLogoTam(POS_DEF.logo.tam)
    setNombrePos(POS_DEF.nombre.pos); setNombreTam(POS_DEF.nombre.tam)
    setLetraPos(POS_DEF.letra.pos); setLetraTam(POS_DEF.letra.tam)
    setPipPos(POS_DEF.pip.pos); setPipTam(POS_DEF.pip.tam)
    setMensajePos(POS_DEF.mensajePos)
    flash("Posiciones restauradas")
  }
  const guardarArmado = () => {
    try {
      localStorage.setItem("en-vivo-armado", JSON.stringify({ logoPos, logoTam, nombrePos, nombreTam, letraPos, letraTam, pipPos, pipTam, mensajePos, diseno, acento }))
      flash("Armado guardado")
    } catch { flash("No se pudo guardar") }
  }
  const restaurarArmado = () => {
    try {
      const raw = localStorage.getItem("en-vivo-armado"); if (!raw) { flash("No hay armado guardado"); return }
      const a = JSON.parse(raw)
      if (a.logoPos) setLogoPos(a.logoPos); if (a.logoTam) setLogoTam(a.logoTam)
      if (a.nombrePos) setNombrePos(a.nombrePos); if (a.nombreTam) setNombreTam(a.nombreTam)
      if (a.letraPos) setLetraPos(a.letraPos); if (a.letraTam) setLetraTam(a.letraTam)
      if (a.pipPos) setPipPos(a.pipPos); if (a.pipTam) setPipTam(a.pipTam)
      if (a.mensajePos) setMensajePos(a.mensajePos)
      if (a.diseno && ES_DISENO(a.diseno)) guardarDiseno(a.diseno)
      if (a.acento) guardarAcento(a.acento)
      flash("Armado restaurado")
    } catch { flash("No se pudo restaurar") }
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

      <div style={{ maxWidth: esAncho ? 1280 : 920, margin: "0 auto", padding: "24px", display: esAncho ? "grid" : "block", gridTemplateColumns: esAncho ? "minmax(0,1.55fr) minmax(0,1fr)" : undefined, gap: 22, alignItems: "start" }}>
        {/* Columna izquierda: vista previa (fija/sticky en escritorio) */}
        <div style={esAncho ? { position: "sticky", top: 12 } : {}}>
        {/* Marco (passe-partout): un margen claro alrededor del cuadro para que
            se note dónde termina exactamente lo que sale al aire. */}
        <div style={{ padding: 10, borderRadius: 20, background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 14px 40px rgba(0,0,0,0.45)" }}>
        {/* Vista previa (lo que saldría al aire) */}
        <div style={{ position: "relative", zIndex: 5, borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.3)", background: "#000", aspectRatio: "16 / 9", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)" }}>
          <canvas ref={canvasRef} width={ANCHO} height={ALTO}
            style={{ width: "100%", height: "100%", display: "block" }} />

          {/* Editor: manijas para mover/redimensionar objetos (solo escenas con
              cámara). Es HTML sobre el lienzo → NO sale al aire. */}
          {(escena === "camara" || escena === "camara-letra") && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {logoImgRef.current && (
                <ObjetoEditable etiqueta="Logo" pos={logoPos} w={logoTam} h={logoTam * logoAspecto}
                  minW={60} maxW={520}
                  onChange={(p, w) => { setLogoPos(p); setLogoTam(Math.round(w)) }} />
              )}
              {nombreIglesia && (
                <ObjetoEditable etiqueta="Nombre" pos={nombrePos} w={cajaNombre(nombreIglesia, nombreTam).w} h={cajaNombre(nombreIglesia, nombreTam).h}
                  minW={120} maxW={900}
                  onChange={(p, w) => { setNombrePos(p); setNombreTam(Math.max(16, Math.round(w / (nombreIglesia.length * 0.66)))) }} />
              )}
              {((camaraActiva === "ambas" && camara2Id) || (pantallaOn && camaraEnPip)) && (
                <ObjetoEditable etiqueta={pantallaOn ? "Cámara" : "Cámara 2"} pos={pipPos} w={pipTam} h={pipTam * 9 / 16}
                  minW={160} maxW={900}
                  onChange={(p, w) => { setPipPos(p); setPipTam(Math.round(w)) }} />
              )}
              {escena === "camara-letra" && (
                <ObjetoEditable etiqueta="Letra" pos={letraPos} w={letraTam}
                  h={altoLetraCaja(biblia ? limpiarTexto(biblia.paginas?.[paginaBiblia] || biblia.texto || "") : limpiarLetra(partes[index]), letraTam, letraPos.y)}
                  soloAncho minW={280} maxW={ANCHO}
                  onChange={(p, w) => { setLetraPos(p); setLetraTam(Math.round(w)) }} />
              )}
              {graficos.map(g => (
                <ObjetoEditable key={g.id} etiqueta="Gráfico" pos={g.pos} w={g.w} h={g.w * g.aspecto}
                  minW={40} maxW={ANCHO}
                  onChange={(p, w) => setGraficoPos(g.id, p, w)} />
              ))}
            </div>
          )}
          {/* etiqueta: vista previa o EN VIVO con cronómetro */}
          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: 99, fontSize: 11.5, fontWeight: 800, color: "#fff", backdropFilter: "blur(4px)", background: txEstado === "vivo" ? "rgba(220,38,38,.85)" : txEstado === "reconectando" ? "rgba(217,119,6,.85)" : "rgba(0,0,0,.55)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: txEstado === "vivo" ? "#fff" : txEstado === "reconectando" ? "#fbbf24" : "#4ade80", boxShadow: txEstado === "vivo" ? "0 0 6px #fff" : "none" }} />
            {txEstado === "vivo" ? `EN VIVO · ${fmtTiempo(segundos)}` : txEstado === "reconectando" ? "RECONECTANDO…" : "VISTA PREVIA"}
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
          <div style={{ marginTop: 8, textAlign: "center", fontSize: 10.5, letterSpacing: 0.5, color: C.tenue, fontWeight: 700 }}>
            CUADRO 1280 × 720 — TODO LO DE ADENTRO SALE AL AIRE
          </div>
        </div>

        {/* Audio del micrófono: medidor de nivel (VU) + reducción de ruido */}
        {permiso === "ok" && (
          <div style={{ marginTop: 12, background: C.panel, border: `1px solid ${sinAudio ? "rgba(248,113,113,0.5)" : C.borde}`, borderRadius: 12, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: C.suave, display: "flex", alignItems: "center", gap: 6 }}>🎙️ Audio del micrófono</span>
              {sinAudio && <span style={{ fontSize: 11, fontWeight: 800, color: "#f87171" }}>⚠ Sin señal</span>}
            </div>
            <div style={{ position: "relative", height: 12, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div ref={vuFillRef} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "0%", background: "#4ade80", borderRadius: 99 }} />
              <div ref={vuPeakRef} style={{ position: "absolute", top: -2, bottom: -2, left: "0%", width: 2, background: "rgba(255,255,255,0.9)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: C.tenue, flex: 1, minWidth: 150 }}>
                {sinAudio ? "No se detecta sonido — revisa el micrófono o que no esté silenciado." : "Habla o toca: la barra debe moverse en verde. Rojo = satura."}
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 11.5, color: C.suave, fontWeight: 700 }}>Reducir ruido</span>
                <button type="button" onClick={() => { const v = !limpiarAudio; setLimpiarAudio(v); try { localStorage.setItem("en-vivo-limpiar-audio", v ? "1" : "0") } catch {} }} aria-label="Reducir ruido del micrófono"
                  style={{ position: "relative", width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", background: limpiarAudio ? C.verde : "rgba(255,255,255,0.14)", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: limpiarAudio ? 21 : 3, width: 18, height: 18, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
                </button>
              </label>
            </div>
          </div>
        )}

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
        {/* Pantalla compartida (alimenta el lienzo) */}
        <video ref={screenVideoRef} autoPlay muted playsInline
          style={{ position: "absolute", width: 2, height: 2, opacity: 0, pointerEvents: "none", left: 0, top: 0 }} />
        {/* Cámara del celular por WebRTC (alimenta el lienzo) */}
        <video ref={phoneVideoRef} autoPlay muted playsInline
          style={{ position: "absolute", width: 2, height: 2, opacity: 0, pointerEvents: "none", left: 0, top: 0 }} />
        </div>{/* fin columna izquierda */}

        {/* Columna derecha: controles (con scroll propio en escritorio) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, ...(esAncho ? { maxHeight: "calc(100vh - 48px)", overflowY: "auto", paddingRight: 4 } : {}) }}>
        {/* Cámaras y micrófono */}
        <Seccion titulo="Cámaras y micrófono" defaultOpen>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ fontSize: 12.5, color: C.tenue }}>
              🎥 Cámara 1
              <select value={camaraId} onChange={e => { const val = e.target.value; setCamaraId(val); if (val === camara2Id) setCamara2Id("") }} style={selectEstilo}>
                {camaras.length === 0 && <option value="">(sin cámaras)</option>}
                {camaras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                {celularOn && <option value={CELULAR}>📱 Celular</option>}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: C.tenue }}>
              📱 Cámara 2 (opcional)
              <select value={camara2Id} onChange={e => setCamara2Id(e.target.value)} style={selectEstilo}>
                <option value="">(ninguna)</option>
                {camaras.filter(c => c.id !== camaraId).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                {celularOn && camaraId !== CELULAR && <option value={CELULAR}>📱 Celular</option>}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: C.tenue, gridColumn: "1 / -1" }}>
              🎙️ Micrófono / entrada de audio
              <select value={microId} onChange={e => setMicroId(e.target.value)} style={selectEstilo}>
                {micros.length === 0 && <option value="">(sin micrófonos)</option>}
                {micros.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                {celularOn && <option value={CELULAR}>📱 Micrófono del celular</option>}
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
        </Seccion>

        {/* Escena al aire */}
        <Seccion titulo="Escena al aire" defaultOpen>
            <div style={{ fontSize: 12, color: C.tenue, marginBottom: 12 }}>
                {conectadoSala
                  ? (estadoEsp ? `Proyectando: ${nombreEstado(estadoEsp.tipo)}`
                    : biblia?.referencia ? `Proyectando: ${biblia.referencia}`
                    : titulo ? `Proyectando: ${titulo}${tono ? ` · ${tono}` : ""}`
                    : videoUrl ? "Proyectando una animación"
                    : imagenUrl ? "Proyectando una imagen"
                    : "Sin proyección activa")
                  : "Conectando con la proyección…"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {([
                ["camara", "🎥 Cámara", "Solo la cámara"],
                ["camara-letra", "🎥 + 📝 Letra", "Letra sobre la cámara"],
                ["letra", "📺 Proyección", "Letra, imagen o versículo"],
                ["espera", "⏳ Espera", "Comienza pronto + contador"],
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

            {/* Config de la pantalla de espera (solo cuando esa escena está activa) */}
            {escena === "espera" && (
              <div style={{ marginTop: 12, background: C.panel2, border: `1px solid ${C.borde}`, borderRadius: 12, padding: "12px 14px" }}>
                <input value={esperaTexto} onChange={e => guardarEsperaTexto(e.target.value)}
                  placeholder="El culto comienza pronto" maxLength={60}
                  style={{ ...selectEstilo, marginTop: 0, width: "100%" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: C.tenue }}>Comienza en</span>
                  <input type="number" min={0} max={120} value={esperaMin} onChange={e => setEsperaMin(Math.max(0, Number(e.target.value) || 0))}
                    style={{ ...selectEstilo, marginTop: 0, width: 74, textAlign: "center" }} />
                  <span style={{ fontSize: 12.5, color: C.tenue }}>min</span>
                  <button onClick={iniciarEspera} style={botonBase({ background: C.azul, color: "#fff", padding: "8px 14px", fontSize: 12.5 })}>▶ Iniciar cuenta</button>
                  {esperaHasta && <button onClick={() => setEsperaHasta(null)} style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.suave, padding: "8px 12px", fontSize: 12.5 })}>Quitar contador</button>}
                </div>
              </div>
            )}

            {/* Transiciones + Compartir pantalla */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => { const v = !transiciones; setTransiciones(v); try { localStorage.setItem("en-vivo-transiciones", v ? "1" : "0") } catch {} }} aria-label="Transiciones"
                style={{ position: "relative", width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", background: transiciones ? C.verde : "rgba(255,255,255,0.14)", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: transiciones ? 21 : 3, width: 18, height: 18, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
              </button>
              <span style={{ fontSize: 12.5, color: C.suave }}>Fundido suave al cambiar de escena</span>
            </div>
        </Seccion>

        {/* Fuentes: pantalla y celular */}
        <Seccion titulo="Fuentes" sub="Pantalla · Celular">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>🖥️ Compartir pantalla</div>
                  <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 2 }}>Proyecta ProPresenter, PowerPoint o un video de otra app; la letra y el mensaje se sobreponen igual.</div>
                </div>
                {pantallaOn
                  ? <button onClick={dejarPantalla} style={botonBase({ background: C.rojo, color: "#fff", padding: "9px 13px", fontSize: 12.5 })}>Dejar de compartir</button>
                  : <button onClick={abrirPickerPantalla} disabled={!esEscritorio} style={botonBase({ background: "rgba(37,99,235,0.15)", color: "#93c5fd", padding: "9px 13px", fontSize: 12.5, border: `1px solid ${C.azul}`, opacity: esEscritorio ? 1 : 0.5 })}>Elegir pantalla…</button>}
              </div>
              {pantallaOn && (
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
                  <button type="button" onClick={() => setCamaraEnPip(v => !v)} aria-label="Mostrar cámara en recuadro"
                    style={{ position: "relative", width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", background: camaraEnPip ? C.verde : "rgba(255,255,255,0.14)", flexShrink: 0 }}>
                    <span style={{ position: "absolute", top: 3, left: camaraEnPip ? 21 : 3, width: 18, height: 18, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
                  </button>
                  <span style={{ fontSize: 12.5, color: C.suave }}>Mostrar mi cámara en un recuadro (arrástrala en la vista previa)</span>
                </label>
              )}
              {!esEscritorio && <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 8 }}>Disponible solo en la app de escritorio.</div>}
            </div>

            {/* Usar el celular como cámara (WebRTC por la LAN) */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borde}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>📱 Usar celular como cámara</div>
                  <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 2 }}>Tu celular como cámara inalámbrica por WiFi: escaneas un QR y listo. Sin apps de terceros ni cable.</div>
                </div>
                {celularOn
                  ? <button onClick={() => cerrarCamaraCelular(true)} style={botonBase({ background: C.rojo, color: "#fff", padding: "9px 13px", fontSize: 12.5 })}>Desconectar</button>
                  : <button onClick={abrirCamaraCelular} disabled={!esEscritorio} style={botonBase({ background: "rgba(37,99,235,0.15)", color: "#93c5fd", padding: "9px 13px", fontSize: 12.5, border: `1px solid ${C.azul}`, opacity: esEscritorio ? 1 : 0.5 })}>Conectar celular…</button>}
              </div>
              {celularOn && <div style={{ fontSize: 11.5, color: "#4ade80", marginTop: 8, fontWeight: 700 }}>● Celular conectado como cámara</div>}
              {!esEscritorio && <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 8 }}>Disponible solo en la app de escritorio.</div>}
            </div>
        </Seccion>

        {/* Mensaje en vivo */}
        <Seccion titulo="Mensaje en vivo">
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: C.tenue }}>Posición:</span>
              {(["abajo", "arriba"] as const).map(p => (
                <button key={p} onClick={() => { setMensajePos(p); try { localStorage.setItem("en-vivo-mensaje-pos", p) } catch {} }}
                  style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                    background: mensajePos === p ? "rgba(37,99,235,0.2)" : C.panel2,
                    border: `1.5px solid ${mensajePos === p ? C.azul : C.borde}`, color: mensajePos === p ? "#93c5fd" : C.texto }}>
                  {p === "abajo" ? "⬇ Abajo" : "⬆ Arriba"}
                </button>
              ))}
            </div>
        </Seccion>

        {/* Apariencia (personalización) */}
        <Seccion titulo="Apariencia" sub="Diseño · color · logo">

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

            {/* Diseño de los gráficos (forma/estilo al aire) */}
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: C.tenue }}>Diseño</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {DISENOS.map(([id, nom, desc]) => (
                  <button key={id} onClick={() => guardarDiseno(id)} title={desc}
                    style={{ flex: "1 1 160px", textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: diseno === id ? "rgba(37,99,235,0.16)" : "rgba(255,255,255,0.03)",
                      border: diseno === id ? `2px solid ${acento}` : "2px solid rgba(255,255,255,0.12)", color: C.texto }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                      {diseno === id && <span style={{ color: acento }}>✓</span>}{nom}
                    </div>
                    <div style={{ fontSize: 11, color: C.tenue, marginTop: 3, lineHeight: 1.3 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tema de color (marca de la iglesia) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: C.tenue, minWidth: 90 }}>Tema de color</span>
              {TEMAS.map(([col, nom]) => (
                <button key={col} onClick={() => guardarAcento(col)} title={nom}
                  style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: col,
                    boxShadow: acento === col ? `0 0 0 2px #0b1220, 0 0 0 4px ${col}` : "none",
                    border: acento === col ? `2px solid #fff` : "2px solid rgba(255,255,255,0.2)" }} />
              ))}
              <label title="Color personalizado" style={{ position: "relative", width: 34, height: 30, borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px dashed rgba(255,255,255,0.35)", color: C.suave, fontSize: 16 }}>
                +
                <input type="color" value={acento} onChange={e => guardarAcento(e.target.value)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </label>
            </div>
            <div style={{ fontSize: 11.5, color: C.tenue, marginBottom: 16 }}>
              El tema tiñe las líneas, barras, el nombre y la letra del mensaje — así cada iglesia se ve distinta.
            </div>

            {/* Tamaño del logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: C.tenue, minWidth: 90 }}>Tamaño del logo</span>
              <input type="range" min={70} max={380} value={logoTam} onChange={e => cambiarLogoTam(Number(e.target.value))}
                style={{ flex: 1, minWidth: 160, accentColor: C.azul }} />
              <span style={{ fontSize: 12, color: C.suave, width: 46, textAlign: "right" }}>{logoTam}px</span>
            </div>
            <div style={{ fontSize: 12, color: C.tenue, marginTop: 10 }}>
              💡 En la vista previa puedes <strong style={{ color: C.suave }}>arrastrar y redimensionar</strong> el logo, el nombre, la letra, la Cámara 2 y los gráficos (tira de la esquina azul). Todo se guarda solo.
            </div>

            {/* Resetear / guardar armado */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={resetearPosiciones} title="Volver todo a su posición por defecto"
                style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, padding: "8px 12px", fontSize: 12.5 })}>↺ Resetear posiciones</button>
              <button onClick={guardarArmado} title="Guardar la posición actual de todo"
                style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, padding: "8px 12px", fontSize: 12.5 })}>💾 Guardar armado</button>
              <button onClick={restaurarArmado} title="Volver al armado guardado"
                style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, padding: "8px 12px", fontSize: 12.5 })}>↩ Restaurar</button>
            </div>

            {/* Atajos de teclado */}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setMostrarAtajos(v => !v)} style={{ background: "transparent", border: "none", color: C.suave, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                ⌨️ Atajos de teclado {mostrarAtajos ? "▲" : "▼"}
              </button>
              {mostrarAtajos && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.suave, lineHeight: 1.9 }}>
                  {[["1 / 2 / 3 / 4", "Cambiar escena (Cámara / Letra / Proyección / Espera)"], ["M", "Mostrar/ocultar mensaje"], ["C", "Alternar cámara (1 → 2 → ambas)"], ["R", "Resetear posiciones"]].map(([k, d]) => (
                    <div key={k as string} style={{ display: "flex", gap: 10 }}>
                      <span style={{ display: "inline-block", minWidth: 74, fontFamily: "ui-monospace, Consolas, monospace", color: C.texto, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 8px", fontSize: 11.5, textAlign: "center" }}>{k}</span>
                      <span>{d}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: C.tenue, marginTop: 4 }}>Los atajos se ignoran mientras escribes en un campo.</div>
                </div>
              )}
            </div>

            {/* Gráficos propios */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: C.tenue }}>Gráficos propios (marcos, adornos, logos de aliados…)</span>
                <label style={botonBase({ background: "rgba(37,99,235,0.15)", color: "#93c5fd", padding: "8px 12px", fontSize: 12.5, border: `1px solid ${C.azul}` })}>
                  ➕ Agregar imagen
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) agregarGrafico(f); e.currentTarget.value = "" }} />
                </label>
              </div>
              {graficos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {graficos.map((g, i) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "6px 8px 6px 6px" }}>
                      <img src={g.url} alt="" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 6, background: "rgba(0,0,0,.3)" }} />
                      <span style={{ fontSize: 12, color: C.suave }}>Gráfico {i + 1}</span>
                      <button onClick={() => quitarGrafico(g.id)} title="Quitar"
                        style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "0 4px" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </Seccion>

        {/* Salir en vivo */}
        <Seccion titulo="Salir en vivo" sub="Transmite a tu plataforma" defaultOpen>
          <div style={{ fontSize: 12.5, color: C.tenue, marginBottom: 16 }}>Transmite esta vista directo a tu plataforma.</div>

          {!esEscritorio ? (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.suave }}>
              Transmitir en vivo funciona solo en la <strong style={{ color: C.texto }}>app de escritorio</strong> de Selah Live (aquí en el navegador puedes probar la cámara y la letra, pero no salir al aire).
            </div>
          ) : grabandoSolo ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: "#f87171", boxShadow: "0 0 8px #f87171" }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#f87171" }}>GRABANDO · {fmtTiempo(segundos)}</div>
                  <div style={{ fontSize: 12, color: C.tenue }}>Solo grabación (no estás transmitiendo) · {grabMB} MB</div>
                </div>
              </div>
              <button onClick={detenerGrabarSolo} style={botonBase({ background: C.rojo, color: "#fff" })}>■ Detener grabación</button>
            </div>
          ) : (txEstado === "vivo" || txEstado === "conectando" || txEstado === "reconectando") ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 99, background: txEstado === "vivo" ? "#f87171" : "#fbbf24", boxShadow: txEstado === "vivo" ? "0 0 8px #f87171" : "none" }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: txEstado === "vivo" ? "#f87171" : "#fbbf24" }}>
                      {txEstado === "vivo" ? `AL AIRE · ${fmtTiempo(segundos)}`
                        : txEstado === "reconectando" ? `Reconectando… (intento ${intento})`
                        : "Conectando…"}
                    </div>
                    <div style={{ fontSize: 12, color: C.tenue }}>
                      {PLATAFORMAS.filter(p => destinos[p.key].activo && destinos[p.key].valor.trim()).map(p => p.nombre).join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                <button onClick={terminar} style={botonBase({ background: C.rojo, color: "#fff" })}>■ Terminar transmisión</button>
              </div>

              {/* Panel de salud del stream */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(() => {
                  const chip = (etq: string, val: string, col: string = C.suave) => (
                    <div key={etq} style={{ background: C.panel2, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "7px 11px", minWidth: 80 }}>
                      <div style={{ fontSize: 10, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.5 }}>{etq}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{val}</div>
                    </div>
                  )
                  const sp = salud?.speed ?? null
                  const saludTxt = sp == null ? "—" : sp >= 0.95 ? "Fluido" : sp >= 0.8 ? "Justo" : "Lento"
                  const saludCol = sp == null ? C.suave : sp >= 0.95 ? "#4ade80" : sp >= 0.8 ? "#fbbf24" : "#f87171"
                  const grabando = !!grabInfo && !grabInfo.listo
                  return [
                    chip("Bitrate", salud?.bitrate != null ? `${(salud.bitrate / 1000).toFixed(1)} Mbps` : "—"),
                    chip("FPS", salud?.fps != null ? String(Math.round(salud.fps)) : "—"),
                    chip("Salud", saludTxt, saludCol),
                    chip("Caídos", salud?.drop != null ? String(salud.drop) : "0"),
                    grabando ? chip("● REC", `${grabMB} MB`, "#f87171") : null,
                  ]
                })()}
              </div>
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

              {/* Calidad de salida */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: C.tenue, minWidth: 58 }}>Calidad</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([["baja", "Baja", "1.2 Mbps · internet lento"], ["media", "Media", "2.5 Mbps · recomendada"], ["alta", "Alta", "4.5 Mbps · buena subida"]] as const).map(([id, txt, sub]) => (
                    <button key={id} title={sub} onClick={() => { setCalidad(id); try { localStorage.setItem("en-vivo-calidad", id) } catch {} }}
                      style={{ padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                        background: calidad === id ? "rgba(37,99,235,0.2)" : C.panel2,
                        border: `1.5px solid ${calidad === id ? C.azul : C.borde}`, color: calidad === id ? "#93c5fd" : C.texto }}>{txt}</button>
                  ))}
                </div>
              </div>

              {/* Grabación local (respaldo del culto) */}
              <label style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer", background: C.panel2, border: `1px solid ${grabar ? C.azul : C.borde}`, borderRadius: 12, padding: "11px 14px" }}>
                <button type="button" onClick={() => { const v = !grabar; setGrabar(v); try { localStorage.setItem("en-vivo-grabar", v ? "1" : "0") } catch {} }} aria-label="Grabar el culto"
                  style={{ position: "relative", width: 46, height: 26, borderRadius: 99, border: "none", cursor: "pointer", background: grabar ? C.verde : "rgba(255,255,255,0.14)", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: grabar ? 23 : 3, width: 20, height: 20, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
                </button>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.texto }}>Grabar el culto (respaldo local)</div>
                  <div style={{ fontSize: 11.5, color: C.tenue }}>Guarda el video en tu PC mientras transmites — respaldo si se cae internet y para subirlo después.</div>
                </div>
              </label>

              <button onClick={salirEnVivo} disabled={permiso !== "ok"}
                style={botonBase({ background: C.rojo, color: "#fff", width: "100%", padding: "14px", opacity: permiso !== "ok" ? 0.5 : 1 })}>
                ● Salir en vivo
              </button>

              <button onClick={grabarSolo} disabled={permiso !== "ok"}
                style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.texto, width: "100%", padding: "11px", marginTop: 8, opacity: permiso !== "ok" ? 0.5 : 1 })}>
                ⏺️ Grabar sin transmitir
              </button>
              <div style={{ fontSize: 11, color: C.tenue, marginTop: 6, textAlign: "center" }}>Graba el culto a tu PC sin sacarlo al aire (ensayo o respaldo).</div>

              {grabInfo && !grabInfo.listo && (
                <div style={{ marginTop: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.suave }}>
                  ⏳ Guardando la grabación (preparando el .mp4)…
                </div>
              )}
              {grabInfo?.listo && (
                <div style={{ marginTop: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.28)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span>✅ Grabación guardada{grabInfo.ruta ? `: ${grabInfo.ruta.split(/[\\/]/).pop()}` : ""}.</span>
                  <button onClick={() => (window as any).transmision?.abrirCarpetaGrabaciones?.()} style={botonBase({ background: "rgba(255,255,255,0.08)", color: C.texto, padding: "6px 11px", fontSize: 12 })}>📂 Abrir carpeta</button>
                </div>
              )}
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
        </Seccion>

        {/* Aviso de conexión */}
        <div style={{ marginTop: 4, fontSize: 12, color: C.tenue, textAlign: "center", lineHeight: 1.6 }}>
          Para una transmisión estable, conéctate por <strong style={{ color: C.suave }}>cable de red</strong> (no WiFi) y con buena subida de internet.
        </div>
        </div>{/* fin columna derecha */}
      </div>

      {/* Aviso breve (toast) */}
      {aviso && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 1100, background: "rgba(17,24,39,0.97)", border: `1px solid ${C.borde}`, borderRadius: 99, padding: "9px 18px", fontSize: 13, fontWeight: 700, color: C.texto, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
          {aviso}
        </div>
      )}

      {/* Emparejar el celular como cámara (QR + código) */}
      {camModal && (
        <div onClick={() => (celularOn ? setCamModal(false) : cerrarCamaraCelular(true))} style={{ position: "fixed", inset: 0, background: "rgba(2,6,14,0.82)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 22, maxWidth: 400, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>📱 Conectar el celular</div>
            {camEstado === "conectado" ? (
              <>
                <div style={{ fontSize: 40, margin: "18px 0 8px" }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#4ade80" }}>¡Celular conectado!</div>
                <div style={{ fontSize: 12.5, color: C.tenue, marginTop: 6 }}>Ya se ve en la vista previa. Deja la app abierta en el celular.</div>
                <button onClick={() => setCamModal(false)} style={botonBase({ background: C.azul, color: "#fff", width: "100%", padding: "12px", marginTop: 16 })}>Listo</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: C.suave, marginTop: 8, marginBottom: 8, lineHeight: 1.7, textAlign: "left" }}>
                  En el celular (misma red WiFi):<br />
                  1. Abre <strong style={{ color: C.texto }}>Selah</strong> → <strong style={{ color: C.texto }}>📷 Cámara</strong><br />
                  2. Escribe este código:
                </div>
                <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 8, color: "#93c5fd", margin: "8px 0 4px", background: "rgba(37,99,235,0.1)", borderRadius: 12, padding: "10px 0" }}>{camCodigo}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, fontSize: 13, color: camEstado === "error" ? "#f87171" : "#fbbf24", fontWeight: 700 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: camEstado === "error" ? "#f87171" : "#fbbf24" }} />
                  {camEstado === "error" ? (camError || "Error") : "Esperando el celular…"}
                </div>
                <button onClick={() => cerrarCamaraCelular(true)} style={botonBase({ background: "rgba(255,255,255,0.06)", color: C.suave, width: "100%", padding: "11px", marginTop: 16 })}>Cancelar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selector de pantalla/ventana a compartir */}
      {pickerPantalla && (
        <div onClick={() => setPickerPantalla(false)} style={{ position: "fixed", inset: 0, background: "rgba(2,6,14,0.82)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, maxWidth: 840, width: "100%", maxHeight: "82vh", overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Elige qué compartir</div>
              <button onClick={() => setPickerPantalla(false)} style={{ background: "transparent", border: "none", color: C.suave, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            {!fuentesPantalla ? <div style={{ color: C.tenue }}>Cargando…</div>
              : fuentesPantalla.length === 0 ? <div style={{ color: C.tenue }}>No se encontraron pantallas ni ventanas.</div>
                : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
                  {fuentesPantalla.map(f => (
                    <button key={f.id} onClick={() => elegirPantalla(f.id)} style={{ background: C.panel2, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 8, cursor: "pointer", textAlign: "left" }}>
                      {f.thumb
                        ? <img src={f.thumb} alt="" style={{ width: "100%", borderRadius: 8, background: "#000", aspectRatio: "16 / 9", objectFit: "contain", display: "block" }} />
                        : <div style={{ aspectRatio: "16 / 9", background: "#000", borderRadius: 8 }} />}
                      <div style={{ fontSize: 12, color: C.texto, marginTop: 6, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{f.esPantalla ? "🖥️" : "🪟"}</span>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.nombre}</span>
                      </div>
                    </button>
                  ))}
                </div>}
          </div>
        </div>
      )}
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

// Fuente de la letra según el ANCHO de la caja (escala, con topes legibles).
// Caja más ancha → letra más grande, así siempre se ve balanceada.
function fontLetra(w: number): number { return Math.round(Math.max(20, Math.min(54, w / 20))) }
const LETRA_PADX = 38, LETRA_PADBOT = 22, LETRA_TITULO_H = 46

function envolverLineas(ctx: CanvasRenderingContext2D, texto: string, maxW: number, font: number): string[] {
  ctx.font = `700 ${font}px 'Segoe UI', system-ui, sans-serif`
  try { (ctx as any).letterSpacing = "0px" } catch {}
  const out: string[] = []
  for (const b of (texto || "").split("\n")) { const l = b.trim(); if (l) out.push(...ajustarLinea(ctx, l, maxW)) }
  return out
}

// Canvas oculto para medir texto en el render de React (sin dibujar).
let _medCanvas: HTMLCanvasElement | null = null
function medirCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null
  if (!_medCanvas) _medCanvas = document.createElement("canvas")
  return _medCanvas.getContext("2d")
}

// Mide la caja de letra: la fuente escala con el ANCHO, pero se topa para que la
// caja QUEPA en el espacio disponible bajo su posición (no se sale de pantalla).
// Único cálculo compartido por el dibujo y el editor → siempre calzan.
function medirLetra(ctx: CanvasRenderingContext2D | null, texto: string, w: number, yTop: number): { font: number; lineas: string[]; h: number } {
  const dispo = Math.max(150, ALTO - yTop - 22)
  const t = texto || ""
  const wrap = (f: number) => ctx ? envolverLineas(ctx, t, w - LETRA_PADX * 2, f) : t.split("\n").filter(l => l.trim())
  const altoDe = (f: number, n: number) => LETRA_TITULO_H + Math.max(n, t.trim() ? 1 : 0) * f * 1.34 + LETRA_PADBOT
  let font = fontLetra(w)
  let lineas = wrap(font)
  let h = altoDe(font, lineas.length)
  while (h > dispo && font > 16) { font -= 2; lineas = wrap(font); h = altoDe(font, lineas.length) }
  return { font, lineas, h: Math.round(h) }
}

// Alto que tendrá la caja de letra (para el editor: la caja calza con el dibujo).
function altoLetraCaja(texto: string, w: number, yTop: number): number {
  return medirLetra(medirCtx(), texto, w, yTop).h
}

// Letra sobre la cámara: caja movible cuyo ALTO se ajusta al texto (no a un
// ratio fijo). La fuente escala con el ancho y se topa para no desbordar.
function dibujarLetraCaja(ctx: CanvasRenderingContext2D, texto: string, titulo: string, tono: string, x: number, y: number, w: number, color: string, acento = "#f59e0b", diseno: Diseno = "vidrio") {
  const { font, lineas, h } = medirLetra(ctx, texto, w, y)
  const lineH = font * 1.34
  const et = titulo ? (tono ? `${titulo.toUpperCase()}    ·    ${tono}` : titulo.toUpperCase()).slice(0, 60) : ""

  ctx.save()

  if (diseno === "broadcast") {
    // ── Broadcast: banda de acento con el título (texto oscuro) + banda oscura
    //    con la letra alineada a la izquierda. Esquinas rectas (estilo noticiero).
    ctx.fillStyle = "rgba(9,12,20,0.92)"; ctx.fillRect(x, y, w, h)
    ctx.fillStyle = acento; ctx.fillRect(x, y, w, LETRA_TITULO_H)
    if (et) {
      ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.font = "800 21px 'Segoe UI', system-ui, sans-serif"
      try { (ctx as any).letterSpacing = "1px" } catch {}
      ctx.fillStyle = textoSobreAcento(acento)
      ctx.fillText(et, x + LETRA_PADX, y + LETRA_TITULO_H / 2 + 1, w - LETRA_PADX * 2)
      try { (ctx as any).letterSpacing = "0px" } catch {}
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
    ctx.fillStyle = color
    ctx.font = `700 ${font}px 'Segoe UI', system-ui, sans-serif`
    let tyb = y + LETRA_TITULO_H + font * 0.92
    for (const l of lineas) { ctx.fillText(l, x + LETRA_PADX, tyb); tyb += lineH }
    ctx.restore()
    return
  }

  if (diseno === "tarjeta") {
    // ── Tarjeta: fondo tenue + borde de acento; título en pastilla que monta
    //    sobre el borde superior. Esquinas menos redondeadas (editorial).
    ctx.fillStyle = "rgba(10,14,22,0.70)"; redondear(ctx, x, y, w, h, 12); ctx.fill()
    ctx.strokeStyle = acento; ctx.lineWidth = 2
    redondear(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke()
    if (et) {
      ctx.font = "800 19px 'Segoe UI', system-ui, sans-serif"
      try { (ctx as any).letterSpacing = "1px" } catch {}
      const tw = Math.min(ctx.measureText(et).width + 30, w - 40)
      const px = x + 26, ph = 34, py = y - ph / 2
      ctx.fillStyle = acento; redondear(ctx, px, py, tw, ph, 8); ctx.fill()
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = textoSobreAcento(acento)
      ctx.fillText(et, px + 15, py + ph / 2 + 1, tw - 24)
      try { (ctx as any).letterSpacing = "0px" } catch {}
    }
  } else if (diseno === "minimal") {
    // ── Minimal: sin caja. Título con línea corta de acento; la letra (abajo)
    //    se apoya en la sombra para leerse sobre cualquier fondo.
    if (et) {
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 8
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif"
      try { (ctx as any).letterSpacing = "2px" } catch {}
      ctx.fillText(et, x + w / 2, y + 24)
      try { (ctx as any).letterSpacing = "0px" } catch {}
      ctx.shadowBlur = 0
      ctx.fillStyle = acento; redondear(ctx, x + w / 2 - 26, y + 34, 52, 3.5, 1.75); ctx.fill()
    }
  } else {
    // ── Vidrio (actual): scrim + barra de acento a la izquierda + divisor.
    const bg = ctx.createLinearGradient(0, y, 0, y + h)
    bg.addColorStop(0, "rgba(8,13,24,0.30)"); bg.addColorStop(1, "rgba(6,10,20,0.82)")
    ctx.fillStyle = bg; redondear(ctx, x, y, w, h, 18); ctx.fill()
    ctx.fillStyle = acento; redondear(ctx, x + 15, y + 14, 5, h - 28, 3); ctx.fill()
    if (et) {
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
      ctx.fillStyle = "rgba(255,255,255,0.82)"
      ctx.font = "700 19px 'Segoe UI', system-ui, sans-serif"
      try { (ctx as any).letterSpacing = "1.5px" } catch {}
      ctx.fillText(et, x + LETRA_PADX, y + 30)
      try { (ctx as any).letterSpacing = "0px" } catch {}
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + LETRA_PADX, y + 40, w - LETRA_PADX * 2, 1.5)
    }
  }

  // Letra centrada — común a Vidrio, Tarjeta y Minimal (Broadcast ya retornó).
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"
  ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 6
  ctx.fillStyle = color
  ctx.font = `700 ${font}px 'Segoe UI', system-ui, sans-serif`
  let ty = y + LETRA_TITULO_H + font * 0.82
  for (const l of lineas) { ctx.fillText(l, x + w / 2, ty); ty += lineH }
  ctx.restore()
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

// Fondo oscuro sofisticado para la escena "Proyección": degradado diagonal,
// brillo suave arriba y viñeta en los bordes para dar profundidad.
function dibujarFondoBrandeado(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  g.addColorStop(0, "#0d1a2e"); g.addColorStop(0.55, "#08111f"); g.addColorStop(1, "#04080f")
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO)
  // Brillo tenue arriba al centro
  const r = ctx.createRadialGradient(ANCHO / 2, ALTO * 0.30, 30, ANCHO / 2, ALTO * 0.30, ANCHO * 0.7)
  r.addColorStop(0, "rgba(56,120,255,0.12)"); r.addColorStop(1, "rgba(56,120,255,0)")
  ctx.fillStyle = r; ctx.fillRect(0, 0, ANCHO, ALTO)
  // Viñeta en los bordes
  const v = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ALTO * 0.4, ANCHO / 2, ALTO / 2, ANCHO * 0.72)
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)")
  ctx.fillStyle = v; ctx.fillRect(0, 0, ANCHO, ALTO)
}

// Pantalla de espera: fondo brandeado + logo + titular + cuenta regresiva +
// nombre de la iglesia. Se muestra al aire mientras la gente llega.
function dibujarPantallaEspera(ctx: CanvasRenderingContext2D, texto: string, hasta: number | null, nombre: string, logo: HTMLImageElement | null, acento = "#f59e0b") {
  dibujarFondoBrandeado(ctx)
  const cx = ANCHO / 2
  ctx.save()
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"

  let y = 150
  if (logo && logo.width > 0) {
    const lw = 190, lh = logo.height * (lw / logo.width)
    ctx.globalAlpha = 0.97
    ctx.drawImage(logo, cx - lw / 2, y - lh / 2, lw, lh)
    ctx.globalAlpha = 1
    y += lh / 2 + 34
  } else { y = 232 }

  // Línea de acento
  ctx.fillStyle = acento; redondear(ctx, cx - 42, y, 84, 4, 2); ctx.fill(); y += 44

  // Titular ("El culto comienza pronto")
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8
  ctx.font = "700 42px 'Segoe UI', system-ui, sans-serif"
  ctx.fillText((texto || "").slice(0, 60), cx, y); ctx.shadowBlur = 0; y += 24

  // Cuenta regresiva grande
  if (hasta) {
    const rem = Math.max(0, Math.floor((hasta - Date.now()) / 1000))
    const mm = String(Math.floor(rem / 60)).padStart(2, "0")
    const ss = String(rem % 60).padStart(2, "0")
    if (rem > 0) {
      ctx.fillStyle = "#fff"; ctx.font = "800 104px 'Segoe UI', system-ui, sans-serif"
      ctx.fillText(`${mm}:${ss}`, cx, y + 108)
    } else {
      ctx.fillStyle = acento; ctx.font = "800 68px 'Segoe UI', system-ui, sans-serif"
      ctx.fillText("¡Comenzamos!", cx, y + 96)
    }
  }

  // Nombre de la iglesia abajo
  if (nombre) {
    ctx.font = "700 24px 'Segoe UI', system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.6)"
    try { (ctx as any).letterSpacing = "2px" } catch {}
    ctx.fillText(nombre.toUpperCase(), cx, ALTO - 58)
    try { (ctx as any).letterSpacing = "0px" } catch {}
  }
  ctx.restore()
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
function dibujarCabecera(ctx: CanvasRenderingContext2D, nombre: string, titulo: string, tono: string, logo: HTMLImageElement | null, acento = "#f59e0b") {
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
    ctx.fillStyle = acento
    ctx.font = "700 22px 'Segoe UI', system-ui, sans-serif"
    const et = tono ? `${titulo.toUpperCase()}  ·  ${tono}` : titulo.toUpperCase()
    ctx.fillText(et, ANCHO - 40, yc)
  }
  // Línea divisoria fina bajo la cabecera (degradado, se desvanece a los lados)
  ctx.shadowBlur = 0
  const ld = ctx.createLinearGradient(40, 0, ANCHO - 40, 0)
  ld.addColorStop(0, "rgba(255,255,255,0)"); ld.addColorStop(0.5, "rgba(255,255,255,0.16)"); ld.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = ld; ctx.fillRect(40, yc + 30, ANCHO - 80, 1.5)
  ctx.restore()
}

// Caja estimada del nombre (para el editor y el dibujo). Sin medir en canvas.
function cajaNombre(nombre: string, tam: number) {
  return { w: Math.max(160, nombre.length * tam * 0.66), h: tam * 1.7 }
}

// Nombre de la iglesia (objeto movible): centrado dentro de su caja, con línea
// de acento ámbar debajo.
function dibujarNombreCentrado(ctx: CanvasRenderingContext2D, nombre: string, pos: { x: number; y: number }, tam: number, acento = "#f59e0b", diseno: Diseno = "vidrio") {
  if (!nombre) return
  const { w, h } = cajaNombre(nombre, tam)
  const cx = pos.x + w / 2, cy = pos.y + h / 2
  ctx.save()

  if (diseno === "tarjeta") {
    // Placa con borde de acento alrededor del nombre (misma familia que la letra).
    ctx.fillStyle = "rgba(10,14,22,0.55)"; redondear(ctx, pos.x + 2, pos.y + 2, w - 4, h - 4, 9); ctx.fill()
    ctx.strokeStyle = acento; ctx.lineWidth = 2; redondear(ctx, pos.x + 3, pos.y + 3, w - 6, h - 6, 8); ctx.stroke()
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
    try { (ctx as any).letterSpacing = `${Math.round(tam / 12)}px` } catch {}
    ctx.fillStyle = "rgba(255,255,255,0.97)"
    ctx.fillText(nombre.toUpperCase(), cx, cy + 1)
    try { (ctx as any).letterSpacing = "0px" } catch {}
    ctx.restore()
    return
  }

  if (diseno === "broadcast") {
    // Placa sólida de acento con el nombre en texto oscuro (estilo noticiero).
    ctx.fillStyle = acento; ctx.fillRect(pos.x, pos.y, w, h)
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = `800 ${tam}px 'Segoe UI', system-ui, sans-serif`
    try { (ctx as any).letterSpacing = `${Math.round(tam / 14)}px` } catch {}
    ctx.fillStyle = textoSobreAcento(acento)
    ctx.fillText(nombre.toUpperCase(), cx, cy + 1)
    try { (ctx as any).letterSpacing = "0px" } catch {}
    ctx.restore()
    return
  }

  if (diseno === "minimal") {
    // Sin caja: nombre centrado con sombra y un puntito de acento a cada lado.
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
    try { (ctx as any).letterSpacing = `${Math.round(tam / 10)}px` } catch {}
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10
    ctx.fillStyle = "rgba(255,255,255,0.96)"
    ctx.fillText(nombre.toUpperCase(), cx, cy)
    try { (ctx as any).letterSpacing = "0px" } catch {}
    ctx.shadowBlur = 0
    const tw = Math.min(ctx.measureText(nombre.toUpperCase()).width, w)
    ctx.fillStyle = acento
    ctx.beginPath(); ctx.arc(cx - tw / 2 - 16, cy, 3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + tw / 2 + 16, cy, 3, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    return
  }

  // Vidrio (actual): nombre + línea de acento con un puntito a cada lado.
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
  try { (ctx as any).letterSpacing = `${Math.round(tam / 10)}px` } catch {}
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10
  ctx.fillStyle = "rgba(255,255,255,0.96)"
  ctx.fillText(nombre.toUpperCase(), cx, cy - tam * 0.18)
  try { (ctx as any).letterSpacing = "0px" } catch {}
  ctx.shadowBlur = 0
  const lineaW = Math.min(w * 0.42, tam * 3.6)
  const ly = cy + tam * 0.64
  ctx.fillStyle = acento
  redondear(ctx, cx - lineaW / 2, ly - 1.5, lineaW, 3, 1.5); ctx.fill()
  ctx.beginPath(); ctx.arc(cx - lineaW / 2 - 9, ly, 2.6, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + lineaW / 2 + 9, ly, 2.6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// Mensaje en vivo: banner sobre todas las escenas (abajo o arriba).
function dibujarMensaje(ctx: CanvasRenderingContext2D, texto: string, posicion: "abajo" | "arriba" = "abajo", acento = "#f59e0b", diseno: Diseno = "vidrio") {
  ctx.save()

  if (diseno === "tarjeta") {
    // Cápsula centrada con borde de acento (no ocupa todo el ancho).
    const h = 60
    let tam = 29
    ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
    const maxTxt = ANCHO - 260
    while (ctx.measureText(texto).width > maxTxt && tam > 18) { tam -= 2; ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif` }
    const tw = ctx.measureText(texto).width
    const w = Math.min(tw + 110, ANCHO - 80)
    const x = (ANCHO - w) / 2, y = posicion === "arriba" ? 24 : ALTO - 24 - h
    const cy = y + h / 2
    ctx.fillStyle = "rgba(10,14,22,0.74)"; redondear(ctx, x, y, w, h, h / 2); ctx.fill()
    ctx.strokeStyle = acento; ctx.lineWidth = 2; redondear(ctx, x + 1, y + 1, w - 2, h - 2, (h - 2) / 2); ctx.stroke()
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillStyle = acento
    ctx.beginPath(); ctx.arc(x + 30, cy, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = legibleSobreOscuro(acento)
    ctx.fillText(texto, x + 30 + (w - 30) / 2, cy + 1)
    ctx.restore()
    return
  }

  if (diseno === "broadcast") {
    // Barra sólida de acento a todo el ancho, con texto oscuro (ticker de TV).
    const h = 66, y = posicion === "arriba" ? 0 : ALTO - h, cy = y + h / 2
    ctx.fillStyle = acento; ctx.fillRect(0, y, ANCHO, h)
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, posicion === "arriba" ? h - 3 : y, ANCHO, 3)
    let tam = 30
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = `800 ${tam}px 'Segoe UI', system-ui, sans-serif`
    const maxW = ANCHO - 120
    while (ctx.measureText(texto).width > maxW && tam > 18) { tam -= 2; ctx.font = `800 ${tam}px 'Segoe UI', system-ui, sans-serif` }
    ctx.fillStyle = textoSobreAcento(acento)
    ctx.fillText(texto, ANCHO / 2, cy + 1)
    ctx.restore()
    return
  }

  if (diseno === "minimal") {
    // Sin barra: texto centrado con sombra y un puntito de acento a cada lado.
    const y = posicion === "arriba" ? 46 : ALTO - 46
    let tam = 31
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
    const maxW = ANCHO - 200
    while (ctx.measureText(texto).width > maxW && tam > 18) { tam -= 2; ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif` }
    const tw = ctx.measureText(texto).width
    ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 10
    ctx.fillStyle = legibleSobreOscuro(acento)
    ctx.fillText(texto, ANCHO / 2, y)
    ctx.shadowBlur = 0
    ctx.fillStyle = acento
    ctx.beginPath(); ctx.arc(ANCHO / 2 - tw / 2 - 20, y, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(ANCHO / 2 + tw / 2 + 20, y, 4, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    return
  }

  const h = 76, y = posicion === "arriba" ? 0 : ALTO - h
  // Fondo "vidrio oscuro"
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, "rgba(10,14,24,0.88)"); g.addColorStop(1, "rgba(6,10,18,0.94)")
  ctx.fillStyle = g; ctx.fillRect(0, y, ANCHO, h)
  // Línea de acento (borde interior)
  ctx.fillStyle = acento; ctx.fillRect(0, posicion === "arriba" ? h - 3 : y, ANCHO, 3)
  // Punto ámbar + texto
  const cy = y + h / 2
  let tam = 31
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  const maxW = ANCHO - 160
  ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif`
  while (ctx.measureText(texto).width > maxW && tam > 18) { tam -= 2; ctx.font = `700 ${tam}px 'Segoe UI', system-ui, sans-serif` }
  const anchoTexto = ctx.measureText(texto).width
  // dot de acento a la izquierda del texto
  ctx.fillStyle = acento
  ctx.beginPath(); ctx.arc(ANCHO / 2 - anchoTexto / 2 - 22, cy, 5, 0, Math.PI * 2); ctx.fill()
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 6
  // La letra del mensaje toma el color del tema (aclarado para que siempre se lea).
  ctx.fillStyle = legibleSobreOscuro(acento)
  ctx.fillText(texto, ANCHO / 2, cy + 1)
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
