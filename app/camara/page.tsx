"use client"

// ── Cámara desde el celular (Fase 2) ─────────────────────────────────────────
// Página que abre el CELULAR (servida por el PC en la LAN). Captura la cámara,
// se une a la sala por código y envía el video al PC por WebRTC. La señalización
// (oferta/respuesta/ICE) viaja por el Socket.IO del PC; el video va directo.

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { io, Socket } from "socket.io-client"
import { buscarServidorEnRed, getSocketUrl } from "@/lib/servidor"
import { logError } from "@/lib/Errorlogger"
import OnboardingTour from "@/components/OnboardingTour"
import { TOUR_CAMARA_MOVIL } from "@/lib/tours"
import { navegarSPA } from "@/lib/navegar"
import { capturaVigente } from "@/lib/capturaVigente"

type Estado = "abriendo" | "listo" | "conectando" | "conectado" | "error"

// Audio en ALTA FIDELIDAD (música): sin procesamiento de voz (echo/ruido/AGC), que
// arruina cantos e instrumentos. Estéreo y 48 kHz si el equipo los da.
const AUDIO_HIFI: MediaTrackConstraints = {
  echoCancellation: false, noiseSuppression: false, autoGainControl: false,
  sampleRate: { ideal: 48000 }, channelCount: { ideal: 2 },
}
type CalidadCamara = "auto" | "720" | "1080" | "4k"
const restriccionesVideo = (calidad: CalidadCamara): MediaTrackConstraints => ({
  width: { ideal: calidad === "4k" ? 3840 : calidad === "720" ? 1280 : 1920 },
  height: { ideal: calidad === "4k" ? 2160 : calidad === "720" ? 720 : 1080 },
  frameRate: { ideal: 30, max: 30 },
})

export default function CamaraMovil() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>("abriendo")
  const [error, setError] = useState("")
  const [diag, setDiag] = useState("")   // diagnóstico si falla el cambio de cámara
  const [codigo, setCodigo] = useState("")
  const [facing, setFacing] = useState<"environment" | "user">("environment")
  const [resolucion, setResolucion] = useState("detectando…")
  const [cambiandoCamara, setCambiandoCamara] = useState(false)
  const [calidad, setCalidad] = useState<CalidadCamara>("auto")
  const [envioReal, setEnvioReal] = useState("")
  const calidadRef = useRef<CalidadCamara>("auto")
  const aperturaRef = useRef<Promise<boolean> | null>(null)
  const cicloCapturaRef = useRef(0)
  const montadoRef = useRef(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)     // preview local (solo video)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const icePendienteRef = useRef<RTCIceCandidateInit[]>([])
  const socketRef = useRef<Socket | null>(null)
  const videoSenderRef = useRef<RTCRtpSender | null>(null)
  const audioSenderRef = useRef<RTCRtpSender | null>(null)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const audioTrackRef = useRef<MediaStreamTrack | null>(null) // mic del celular (se obtiene 1 vez)
  const codigoRef = useRef("")
  const hostIdRef = useRef("")
  useEffect(() => { codigoRef.current = codigo }, [codigo])

  // Reconexión automática: recordamos que el usuario QUIERE estar conectado, para
  // volver a enlazar solo al regresar a la app o tras un corte, sin re-escribir el
  // código. reconectandoRef evita apilar reintentos; reintentoTimerRef los agenda.
  const quiereConectadoRef = useRef(false)
  const reconectandoRef = useRef(false)
  const reintentoTimerRef = useRef<any>(0)
  const descubriendoServidorRef = useRef(false)
  const ultimoDescubrimientoRef = useRef(0)
  const ultimoLogConexRef = useRef(0)   // throttle del log de errores de conexión
  const estableciendoRef = useRef(false)
  const logConex = (m: string) => {
    const now = Date.now()
    if (now - ultimoLogConexRef.current < 15000) return   // máx 1 cada 15 s (reintentos)
    ultimoLogConexRef.current = now
    logError(m, { tipo: "socket", pagina: "/camara" })
  }

  // Código desde la URL (?code=XXXX) o del último uso (localStorage).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const c = (p.get("code") || p.get("codigo") || "").toUpperCase().trim()
    if (c) { setCodigo(c); return }
    try { const g = localStorage.getItem("selah-camara-codigo"); if (g) setCodigo(g) } catch {}
  }, [])

  const ponerPreview = (vt: MediaStreamTrack | null) => {
    const s = new MediaStream(); if (vt) s.addTrack(vt)
    streamRef.current = s
    if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}) }
  }

  // Cámara realmente activa (para recuperar si un cambio falla).
  const facingRef = useRef<"environment" | "user">("environment")

  // Obtiene un stream para la cámara pedida probando VARIAS estrategias, porque el
  // facingMode es poco fiable en algunos WebView de Android (no resuelven "user"):
  //   1) facingMode exact  2) facingMode suave  3) por deviceId (enumerando y
  // eligiendo la frontal/trasera por etiqueta, o por heurística si no hay labels).
  const obtenerStreamCamara = async (modo: "environment" | "user", incluirAudio: boolean): Promise<MediaStream> => {
    const audio = incluirAudio ? AUDIO_HIFI : false
    // Automático acompaña la salida Full HD; 4K queda disponible por elección.
    const vBase = restriccionesVideo(calidadRef.current)
    const gUM = (video: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video, audio })
    const errs: string[] = []
    // Después del primer permiso Android ya entrega etiquetas confiables. Para
    // voltear, ir directo al deviceId evita que dos intentos facingMode dejen el
    // HAL de cámara ocupado antes de probar la frontal correcta.
    const camsPrevias = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput")
    const reFront = /front|frontal|face|self|user/i
    const reBack = /back|rear|tras|environment|world|main/i
    const candidatas = camsPrevias.filter(d => (modo === "user" ? reFront : reBack).test(d.label))
    for (const candidata of candidatas) {
      // Abrir primero sin resolución exigida: varios WebView/Samsung devuelven
      // NotReadableError al cambiar de sensor y negociar 4K en la misma llamada.
      // Algunos equipos publican DOS cámaras frontales; probamos ambas, no solo
      // la primera (que puede ser un sensor auxiliar no abrible por WebView).
      try { return await gUM({ deviceId: { exact: candidata.deviceId } }) }
      catch (e: any) {
        errs.push(`${candidata.label || "directa"}=` + (e?.name || "?"))
        await new Promise(r => setTimeout(r, 500))
      }
    }
    try { return await gUM({ facingMode: { exact: modo } }) } catch (e: any) { errs.push("exact=" + (e?.name || "?")) }
    // No aceptar silenciosamente la trasera cuando se pidió la frontal.
    if (!candidatas.length && modo === "environment") {
      try { return await gUM({ facingMode: modo, ...vBase }) } catch (e: any) { errs.push("suave=" + (e?.name || "?")) }
    }
    // Fallback definitivo: elegir por deviceId.
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput")
    const frontal = modo === "user"
    let elegida = cams.find(d => (frontal ? reFront : reBack).test(d.label))
    // Sin etiquetas útiles: heurística — la trasera suele ser la 1ª, la frontal la última.
    if (!elegida && cams.length > 1) elegida = frontal ? cams[cams.length - 1] : cams[0]
    if (!elegida && modo === "environment") elegida = cams[0]
    const lista = cams.map(c => c.label || "(sin nombre)").join(" | ")
    if (!elegida) { setDiag(`0 cámaras · ${errs.join(" ")}`); throw new Error("sin-camaras") }
    try { return await gUM({ deviceId: { exact: elegida.deviceId } }) }
    catch (e: any) {
      errs.push("id=" + (e?.name || "?"))
      const d = `${cams.length} cám: ${lista} · ${errs.join(" ")}`
      setDiag(d)
      logError(`No se pudo abrir la cámara (${modo}): ${d}`, { tipo: "general", pagina: "/camara" })
      throw e
    }
  }

  // Aplica un stream ya obtenido (preview + reemplazo del track en la conexión).
  const aplicarStream = async (s: MediaStream, incluirAudio: boolean) => {
    const nuevoVideo = s.getVideoTracks()[0] || null
    if (incluirAudio) {
      const a = s.getAudioTracks()[0]
      if (a) {
        audioTrackRef.current?.stop(); audioTrackRef.current = a
        if (audioSenderRef.current) await audioSenderRef.current.replaceTrack(a)
      }
    }
    videoTrackRef.current = nuevoVideo
    if (nuevoVideo) {
      // Con el sensor ya abierto, pedir su mejor resolución. Si no acepta el
      // cambio conservamos la resolución nativa que Android eligió.
      try { await nuevoVideo.applyConstraints(restriccionesVideo(calidadRef.current)) } catch {}
      let cfg = nuevoVideo.getSettings()
      // 4K a 19 FPS genera cuadros repetidos y latencia, no una señal más
      // profesional. Si el propio sensor anuncia menos de 24 FPS en UHD,
      // negociar 1080p a 30 FPS y conservar la orientación del móvil.
      if (calidadRef.current !== "4k" && (cfg.frameRate || 30) < 24 && (cfg.width || 0) * (cfg.height || 0) > 1920 * 1080) {
        const vertical = (cfg.height || 0) > (cfg.width || 0)
        try {
          await nuevoVideo.applyConstraints({
            width: { ideal: vertical ? 1080 : 1920 },
            height: { ideal: vertical ? 1920 : 1080 },
            frameRate: { ideal: 30 },
          })
          cfg = nuevoVideo.getSettings()
        } catch {}
      }
      setResolucion(`${cfg.width || "?"}×${cfg.height || "?"} · ${Math.round(cfg.frameRate || 0) || "?"} FPS`)
      nuevoVideo.contentHint = "motion"
    }
    if (videoSenderRef.current && nuevoVideo) {
      try { await videoSenderRef.current.replaceTrack(nuevoVideo) }
      catch (e) {
        if ((e as Error).name === "InvalidModificationError" && socketRef.current?.connected) {
          await iniciarWebRTC(socketRef.current)
        } else throw e
      }
    }
    ponerPreview(nuevoVideo)
    setEstado(pcRef.current?.connectionState === "connected" ? "conectado" : "listo"); setError("")
  }

  // Abre la cámara. incluirAudio SOLO la primera vez (al voltear no se re-pide
  // permiso ni se corta el audio). Devuelve true si quedó video listo.
  const abrirCamaraInterna = async (modo: "environment" | "user", incluirAudio: boolean, ciclo: number): Promise<boolean> => {
    const abrirSeguro = async (objetivo: "environment" | "user", audio: boolean) => {
      if (!montadoRef.current || ciclo !== cicloCapturaRef.current) throw new Error("captura-cancelada")
      const s = await capturaVigente(
        () => obtenerStreamCamara(objetivo, audio),
        () => montadoRef.current && ciclo === cicloCapturaRef.current,
      )
      try { await aplicarStream(s, audio) }
      catch (e) { s.getTracks().forEach(t => t.stop()); throw e }
      if (!montadoRef.current || ciclo !== cicloCapturaRef.current) {
        s.getTracks().forEach(t => t.stop())
        throw new Error("captura-cancelada")
      }
    }
    // VOLTEAR (ya hay una cámara abierta).
    if (!incluirAudio && videoTrackRef.current) {
      // Soltar del TODO la cámara actual (track + stream + preview) para que el
      // equipo la LIBERE. En Samsung/One UI la cámara física tarda ~1-2 s en
      // liberarse; si abrimos la otra de inmediato da NotReadableError ("ocupada").
      try { await videoSenderRef.current?.replaceTrack(null) } catch {}
      try { videoTrackRef.current.stop() } catch {}
      videoTrackRef.current = null
      try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
      if (videoRef.current) videoRef.current.srcObject = null
      streamRef.current = null
      // Reintentar con esperas CRECIENTES (NotReadableError suele ser transitorio).
      const esperas = [900, 1400]
      let reiniciarAudio = false
      for (const ms of esperas) {
        await new Promise(r => setTimeout(r, ms))
        if (!montadoRef.current || ciclo !== cicloCapturaRef.current) return false
        try {
          await abrirSeguro(modo, reiniciarAudio); facingRef.current = modo; setDiag(""); return true
        } catch {
          // Si Android sigue ocupado, liberar también la sesión de micrófono
          // original antes del segundo intento. El sender conserva su lugar.
          if (!reiniciarAudio && montadoRef.current && ciclo === cicloCapturaRef.current) {
            try { await audioSenderRef.current?.replaceTrack(null) } catch {}
            audioTrackRef.current?.stop(); audioTrackRef.current = null
            reiniciarAudio = true
          }
        }
      }
      // No se pudo: recuperar la cámara anterior para no quedar en negro.
      let recuperada = false
      try { await abrirSeguro(facingRef.current, reiniciarAudio); recuperada = true } catch {}
      setError(recuperada
        ? "No se pudo cambiar de cámara. Se restauró la anterior; puedes seguir usándola."
        : "No se pudo cambiar de cámara ni restaurar la anterior.")
      if (!recuperada) setEstado("error")
      return false
    }
    // Montaje o apertura con audio.
    try {
      videoTrackRef.current?.stop(); videoTrackRef.current = null
      if (incluirAudio) { audioTrackRef.current?.stop(); audioTrackRef.current = null }
      await abrirSeguro(modo, incluirAudio)
      facingRef.current = modo
      return true
    } catch {
      if (!montadoRef.current || ciclo !== cicloCapturaRef.current) return false
      setError(incluirAudio
        ? "No se pudo abrir la cámara. Da permiso de cámara y reintenta."
        : "No se pudo cambiar de cámara. Reintenta.")
      setEstado("error")
      return false
    }
  }

  const abrirCamara = async (modo: "environment" | "user", incluirAudio: boolean): Promise<boolean> => {
    const ciclo = cicloCapturaRef.current
    // Permisos, reconexión y doble toque nunca abren dos sensores en paralelo.
    while (aperturaRef.current) await aperturaRef.current
    if (!montadoRef.current || ciclo !== cicloCapturaRef.current) return false
    setCambiandoCamara(true)
    const apertura = abrirCamaraInterna(modo, incluirAudio, ciclo)
    aperturaRef.current = apertura
    try { return await apertura } finally {
      if (aperturaRef.current === apertura) aperturaRef.current = null
      if (montadoRef.current) setCambiandoCamara(false)
    }
  }

  useEffect(() => {
    montadoRef.current = true
    cicloCapturaRef.current++
    void abrirCamara("environment", true)
    return () => { montadoRef.current = false; cicloCapturaRef.current++ }
  }, [])

  const voltear = async () => {
    if (aperturaRef.current) return
    const nuevo = facingRef.current === "environment" ? "user" : "environment"
    if (await abrirCamara(nuevo, false)) setFacing(nuevo)
  }

  const cambiarCalidad = async (valor: CalidadCamara) => {
    if (aperturaRef.current) return
    calidadRef.current = valor; setCalidad(valor)
    if (await abrirCamara(facingRef.current, false)) {
      if (quiereConectadoRef.current && socketRef.current?.connected) await iniciarWebRTC(socketRef.current)
    }
  }

  const iniciarWebRTC = async (socket: Socket) => {
    try { pcRef.current?.close() } catch {}
    icePendienteRef.current = []
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })
    pcRef.current = pc
    videoSenderRef.current = null; audioSenderRef.current = null
    const salida = new MediaStream()
    if (videoTrackRef.current) salida.addTrack(videoTrackRef.current)
    if (audioTrackRef.current) salida.addTrack(audioTrackRef.current)
    for (const t of salida.getTracks()) {
      const snd = pc.addTrack(t, salida)
      if (t.kind === "audio") audioSenderRef.current = snd
      if (t.kind === "video") {
        videoSenderRef.current = snd
        const p: any = snd.getParameters()
        p.degradationPreference = "maintain-framerate"
        p.encodings = p.encodings?.length ? p.encodings : [{}]
        p.encodings[0].maxBitrate = calidadRef.current === "4k" ? 20_000_000 : 8_000_000
        p.encodings[0].maxFramerate = 30
        await snd.setParameters(p).catch(e => logConex(`No se pudo configurar calidad WebRTC: ${e?.message}`))
      }
    }
    pc.onicecandidate = e => { if (e.candidate) socket.emit("camara:senal", { codigo: codigoRef.current, para: hostIdRef.current, data: { tipo: "ice", candidate: e.candidate } }) }
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === "connected") { estableciendoRef.current = false; setEstado("conectado"); setError("") }
      else if (st === "failed" && quiereConectadoRef.current) { estableciendoRef.current = false; programarReconexion() }
      else if (st === "disconnected" && quiereConectadoRef.current) {
        // `disconnected` suele durar segundos durante cambios de WiFi/cámara.
        // Esperar evita cerrar y recrear enlaces sanos en un bucle.
        setTimeout(() => {
          if (pcRef.current === pc && pc.connectionState === "disconnected" && quiereConectadoRef.current) {
            estableciendoRef.current = false; programarReconexion()
          }
        }, 8000)
      }
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit("camara:senal", { codigo: codigoRef.current, para: hostIdRef.current, data: { tipo: "offer", sdp: pc.localDescription } })
  }

  // Vigila el track de video: si el equipo lo mata (típico al ir a 2º plano), reconecta.
  const vigilarTrack = () => {
    const t = videoTrackRef.current
    if (t) t.onended = () => { if (quiereConectadoRef.current) programarReconexion() }
  }

  // Programa un reintento (con guarda para no apilar varios).
  const programarReconexion = () => {
    if (!quiereConectadoRef.current || reconectandoRef.current || estableciendoRef.current) return
    reconectandoRef.current = true
    setEstado("conectando")
    clearTimeout(reintentoTimerRef.current)
    reintentoTimerRef.current = setTimeout(async () => {
      reconectandoRef.current = false
      if (quiereConectadoRef.current) await establecerConexion()
    }, 1500)
  }

  // Establece (o restablece) la conexión con el PC usando el código guardado.
  const establecerConexion = async () => {
    if (estableciendoRef.current) return
    if (aperturaRef.current) await aperturaRef.current
    if (estableciendoRef.current) return
    if (!montadoRef.current || !quiereConectadoRef.current) return
    estableciendoRef.current = true
    const cod = codigoRef.current.trim().toUpperCase()
    if (!cod) { estableciendoRef.current = false; setError("Escribe el código que muestra el PC."); return }
    try { pcRef.current?.close() } catch {}; pcRef.current = null
    try { socketRef.current?.removeAllListeners(); socketRef.current?.close() } catch {}; socketRef.current = null
    videoSenderRef.current = null
    audioSenderRef.current = null
    // Cámara viva: si el track murió o quedó congelado (2º plano), re-tomarla.
    const t = videoTrackRef.current
    const vivo = t && t.readyState === "live" && !t.muted
    if (!vivo) { if (!(await abrirCamara(facingRef.current, true))) { estableciendoRef.current = false; if (quiereConectadoRef.current) programarReconexion(); return } }
    vigilarTrack()
    setEstado("conectando")
    // En la APK (Capacitor) la página está empaquetada → window.location es
    // "localhost"; usamos el servidor configurado (IP del PC). En navegador
    // servido por el PC, usamos el host del propio URL.
    const esApp = typeof window !== "undefined" && !!(window as any).Capacitor
    const url = esApp ? getSocketUrl() : `http://${window.location.hostname}:4000`
    const socket = io(url, { transports: ["websocket", "polling"], forceNew: true, reconnection: false, timeout: 5000 })
    socketRef.current = socket

    socket.on("connect", () => {
      socket.emit("camara:unir", { codigo: cod }, (resp: any) => {
        if (!resp?.ok) {
          estableciendoRef.current = false
          if (resp?.error === "no-host") {
            // El PC aún no está esperando: reintentar en unos segundos.
            setError("Esperando a que el PC abra “Usar celular como cámara”…")
            logConex(`camara:unir sin host (código ${cod})`)
            if (quiereConectadoRef.current) programarReconexion()
          } else { setError("No se pudo unir a la sala."); setEstado("error"); logConex("camara:unir falló (sala)") }
          return
        }
        hostIdRef.current = resp.hostId || ""
        try { localStorage.setItem("selah-camara-codigo", cod) } catch {}
        setError(""); iniciarWebRTC(socket)
      })
    })
    socket.on("camara:senal", async ({ data }: any) => {
      const pc = pcRef.current; if (!pc || !data) return
      try {
        if (data.tipo === "answer") {
          await pc.setRemoteDescription(data.sdp)
          const pendientes = icePendienteRef.current.splice(0)
          for (const candidate of pendientes) await pc.addIceCandidate(candidate)
        } else if (data.tipo === "ice" && data.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate)
          else icePendienteRef.current.push(data.candidate)
        }
      } catch (e: any) {
        logConex(`WebRTC celular: señal ${data?.tipo || "desconocida"} falló: ${e?.message || e}`)
      }
    })
    // El PC cerró la cámara A PROPÓSITO → dejar de reintentar.
    socket.on("camara:par-fin", () => { quiereConectadoRef.current = false; setError("El PC cerró la cámara."); cerrar(false) })
    // Caídas de red / socket → reintentar mientras el usuario quiera estar conectado.
    socket.on("disconnect", () => { if (quiereConectadoRef.current) programarReconexion() })
    socket.on("connect_error", async (e: any) => {
      estableciendoRef.current = false
      logConex(`connect_error a ${url}: ${e?.message || e}`)
      if (!quiereConectadoRef.current) return

      // Una IP manual puede ser la del router/repetidor y no la del PC. Si no
      // responde, buscar una instalación real de Selah (/info) y corregirla.
      const ahora = Date.now()
      if (!descubriendoServidorRef.current && ahora - ultimoDescubrimientoRef.current > 60_000) {
        descubriendoServidorRef.current = true
        ultimoDescubrimientoRef.current = ahora
        setError("No responde esa IP. Buscando el PC con Selah en la red…")
        try {
          const ip = await buscarServidorEnRed()
          if (ip && quiereConectadoRef.current) {
            localStorage.setItem("servidor_ip", ip)
            setError(`PC encontrado en ${ip}. Reconectando…`)
            socket.removeAllListeners("disconnect")
            socket.removeAllListeners("connect_error")
            try { socket.close() } catch {}
            descubriendoServidorRef.current = false
            await establecerConexion()
            return
          }
          setError("No se encontró el PC. Revisa que Selah esté abierto y que el repetidor permita ver otros dispositivos.")
        } catch {}
        descubriendoServidorRef.current = false
      }
      if (quiereConectadoRef.current) programarReconexion()
    })
  }

  const conectar = async () => {
    const cod = codigoRef.current.trim().toUpperCase()
    if (!cod) { setError("Escribe el código que muestra el PC."); return }
    quiereConectadoRef.current = true
    await establecerConexion()
  }

  const cerrar = (avisar = true) => {
    quiereConectadoRef.current = false
    clearTimeout(reintentoTimerRef.current); reconectandoRef.current = false; estableciendoRef.current = false
    try { if (avisar) socketRef.current?.emit("camara:fin", { codigo: codigoRef.current }) } catch {}
    try { pcRef.current?.close() } catch {}; pcRef.current = null
    try { socketRef.current?.close() } catch {}; socketRef.current = null
    videoSenderRef.current = null
    audioSenderRef.current = null
    setEstado(videoTrackRef.current ? "listo" : "error")
  }

  const cambiarCodigo = () => {
    cerrar(true)
    setCodigo(""); codigoRef.current = ""
    setError(""); setEstado(videoTrackRef.current ? "listo" : "error")
    try { localStorage.removeItem("selah-camara-codigo") } catch {}
  }

  // Mantener la pantalla encendida y RECONECTAR al volver a primer plano.
  useEffect(() => {
    let wl: any
    const pedirWake = async () => { try { wl = await (navigator as any).wakeLock?.request("screen") } catch {} }
    pedirWake()
    const onVis = () => {
      if (document.visibilityState !== "visible") return
      pedirWake()
      if (!quiereConectadoRef.current) return
      // Al volver: si la cámara murió/congeló o la conexión no está sana, reconectar.
      const t = videoTrackRef.current
      const sano = t && t.readyState === "live" && !t.muted && pcRef.current?.connectionState === "connected"
      if (!sano) programarReconexion()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => { document.removeEventListener("visibilitychange", onVis); try { wl?.release() } catch {} }
  }, [])

  // Limpiar al salir.
  useEffect(() => () => {
    quiereConectadoRef.current = false
    clearTimeout(reintentoTimerRef.current)
    videoTrackRef.current?.stop()
    audioTrackRef.current?.stop()
    try { pcRef.current?.close() } catch {}
    try { socketRef.current?.close() } catch {}
  }, [])

  useEffect(() => {
    let activo = true
    let anterior: { id: string; bytes: number; frames: number; tiempo: number } | null = null
    const timer = setInterval(async () => {
      const pc = pcRef.current
      if (!pc || pc.connectionState !== "connected") { if (activo) setEnvioReal(""); anterior = null; return }
      try {
        const stats = await pc.getStats()
        if (!activo || pc !== pcRef.current) return
        stats.forEach(s => {
          if (s.type !== "outbound-rtp" || s.kind !== "video") return
          const segundos = anterior && anterior.id === s.id ? (s.timestamp - anterior.tiempo) / 1000 : 0
          if (segundos > 0 && anterior) {
            const fps = Math.max(0, (s.framesEncoded - anterior.frames) / segundos)
            const mbps = Math.max(0, (s.bytesSent - anterior.bytes) * 8 / segundos / 1e6)
            const razon = s.qualityLimitationReason === "cpu" ? " · limitado por el teléfono" : s.qualityLimitationReason === "bandwidth" ? " · limitado por la red" : ""
            setEnvioReal(`Enviado: ${s.frameWidth || "?"}×${s.frameHeight || "?"} · ${fps.toFixed(0)} FPS · ${mbps.toFixed(1)} Mbps${razon}`)
          }
          anterior = { id: s.id, tiempo: s.timestamp, bytes: s.bytesSent, frames: s.framesEncoded }
        })
      } catch { /* El enlace puede cerrarse mientras llega la muestra. */ }
    }, 3000)
    return () => { activo = false; clearInterval(timer) }
  }, [])

  const conectado = estado === "conectado"
  const chip = conectado ? { t: "● Transmitiendo al PC", c: "#22c55e" }
    : estado === "conectando" ? { t: "Conectando…", c: "#fbbf24" }
    : estado === "error" ? { t: "Sin conexión", c: "#f87171" }
    : { t: "Cámara lista", c: "#93c5fd" }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <video ref={videoRef} autoPlay muted playsInline
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }} />

      {/* Barra de estado arriba */}
      <div data-tour="camara-estado" style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
          <button onClick={() => { cerrar(true); navegarSPA(router, "/") }} aria-label="Volver al inicio" style={{ border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.35)", color: "white", borderRadius: 10, padding: "7px 10px", fontWeight: 800 }}>←</button>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: chip.c, boxShadow: conectado ? `0 0 8px ${chip.c}` : "none" }} />
          <span style={{ color: chip.c }}>{chip.t}</span>
        </div>
        <span style={{ fontSize: 12, opacity: 0.85, textAlign: "right" }}>Selah · Cámara<br />{resolucion}</span>
      </div>

      {/* Panel inferior */}
      <div data-tour="camara-controles" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 16px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12, background: "linear-gradient(0deg, rgba(0,0,0,0.72), rgba(0,0,0,0))" }}>
        <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
          Calidad
          <select value={calidad} disabled={cambiandoCamara || estado === "conectando"} onChange={e => void cambiarCalidad(e.target.value as CalidadCamara)} style={{ padding:8, borderRadius:8, background:"#182332", color:"white", flex:1 }}>
            <option value="auto">Automática · Full HD y fluidez</option>
            <option value="720">HD · menor consumo de red</option>
            <option value="1080">Full HD · 1080p</option>
            <option value="4k">4K · requiere mayor capacidad de equipo y red</option>
          </select>
        </label>
        {envioReal && <div style={{ fontSize:12, color:"#bfdbfe" }}>{envioReal}</div>}
        {error && <div style={{ background: "rgba(220,38,38,0.85)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>⚠️ {error}</div>}
        {diag && <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 10, padding: "8px 12px", fontSize: 11, fontFamily: "monospace", color: "#fca5a5", wordBreak: "break-word" }}>🔧 {diag}</div>}

        {!conectado && (
          <div style={{ display: "flex", gap: 8 }}>
            <input data-tour="camara-codigo" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="CÓDIGO"
              maxLength={8} autoCapitalize="characters"
              style={{ flex: 1, minWidth: 0, padding: "13px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: 3, textAlign: "center" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button data-tour="camara-voltear" onClick={voltear} disabled={cambiandoCamara || estado === "conectando"}
            style={{ flex: "0 0 auto", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, fontWeight: 700 }}>{cambiandoCamara ? "Abriendo…" : "🔄 Voltear"}</button>
          {conectado && <button onClick={cambiarCodigo} style={{ flex: 1, padding: "14px 10px", borderRadius: 14, border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 14, fontWeight: 800 }}>⌨ Cambiar código</button>}
          <button onClick={() => conectado ? cerrar(true) : conectar()} disabled={cambiandoCamara || estado === "conectando"}
            style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: estado === "conectando" ? "#555" : conectado ? "#dc2626" : "#2563eb", color: "#fff", fontSize: 16, fontWeight: 800 }}>
            {estado === "conectando" ? "Conectando…" : conectado ? "■ Desconectar" : "▶ Conectar al PC"}
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
          {conectado ? "Deja esta pantalla abierta. Apunta la cámara al frente." : "Escanea el QR del PC o escribe el código. Ambos en la misma red WiFi."}
        </div>
      </div>
      <OnboardingTour id="tour-camara-movil-v1" pasos={TOUR_CAMARA_MOVIL} nombrePagina="Cámara del celular" />
    </div>
  )
}
