"use client"

// ── Cámara desde el celular (Fase 2) ─────────────────────────────────────────
// Página que abre el CELULAR (servida por el PC en la LAN). Captura la cámara,
// se une a la sala por código y envía el video al PC por WebRTC. La señalización
// (oferta/respuesta/ICE) viaja por el Socket.IO del PC; el video va directo.

import { useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"
import { getSocketUrl } from "@/lib/servidor"
import { logError } from "@/lib/Errorlogger"

type Estado = "abriendo" | "listo" | "conectando" | "conectado" | "error"

// Audio en ALTA FIDELIDAD (música): sin procesamiento de voz (echo/ruido/AGC), que
// arruina cantos e instrumentos. Estéreo y 48 kHz si el equipo los da.
const AUDIO_HIFI: MediaTrackConstraints = {
  echoCancellation: false, noiseSuppression: false, autoGainControl: false,
  sampleRate: { ideal: 48000 }, channelCount: { ideal: 2 },
}

export default function CamaraMovil() {
  const [estado, setEstado] = useState<Estado>("abriendo")
  const [error, setError] = useState("")
  const [diag, setDiag] = useState("")   // diagnóstico si falla el cambio de cámara
  const [codigo, setCodigo] = useState("")
  const [facing, setFacing] = useState<"environment" | "user">("environment")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)     // preview local (solo video)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const videoSenderRef = useRef<RTCRtpSender | null>(null)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const audioTrackRef = useRef<MediaStreamTrack | null>(null) // mic del celular (se obtiene 1 vez)
  const codigoRef = useRef("")
  useEffect(() => { codigoRef.current = codigo }, [codigo])

  // Reconexión automática: recordamos que el usuario QUIERE estar conectado, para
  // volver a enlazar solo al regresar a la app o tras un corte, sin re-escribir el
  // código. reconectandoRef evita apilar reintentos; reintentoTimerRef los agenda.
  const quiereConectadoRef = useRef(false)
  const reconectandoRef = useRef(false)
  const reintentoTimerRef = useRef<any>(0)
  const ultimoLogConexRef = useRef(0)   // throttle del log de errores de conexión
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
    const vBase = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
    const gUM = (video: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video, audio })
    const errs: string[] = []
    try { return await gUM({ facingMode: { exact: modo } as any, ...vBase }) } catch (e: any) { errs.push("exact=" + (e?.name || "?")) }
    try { return await gUM({ facingMode: modo as any, ...vBase }) } catch (e: any) { errs.push("suave=" + (e?.name || "?")) }
    // Fallback definitivo: elegir por deviceId.
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput")
    const frontal = modo === "user"
    const reFront = /front|frontal|face|self|user/i
    const reBack = /back|rear|tras|environment|world|main/i
    let elegida = cams.find(d => (frontal ? reFront : reBack).test(d.label))
    // Sin etiquetas útiles: heurística — la trasera suele ser la 1ª, la frontal la última.
    if (!elegida && cams.length > 1) elegida = frontal ? cams[cams.length - 1] : cams[0]
    if (!elegida) elegida = cams[0]
    const lista = cams.map(c => c.label || "(sin nombre)").join(" | ")
    if (!elegida) { setDiag(`0 cámaras · ${errs.join(" ")}`); throw new Error("sin-camaras") }
    try { return await gUM({ deviceId: { exact: elegida.deviceId }, ...vBase }) }
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
    if (incluirAudio) { const a = s.getAudioTracks()[0]; if (a) audioTrackRef.current = a }
    if (videoSenderRef.current && nuevoVideo) { try { await videoSenderRef.current.replaceTrack(nuevoVideo) } catch {} }
    videoTrackRef.current = nuevoVideo
    ponerPreview(nuevoVideo)
    setEstado(prev => (prev === "conectado" ? "conectado" : "listo")); setError("")
  }

  // Abre la cámara. incluirAudio SOLO la primera vez (al voltear no se re-pide
  // permiso ni se corta el audio). Devuelve true si quedó video listo.
  const abrirCamara = async (modo: "environment" | "user", incluirAudio: boolean): Promise<boolean> => {
    // VOLTEAR (ya hay una cámara abierta): varias estrategias, en orden.
    if (!incluirAudio && videoTrackRef.current) {
      // A) Abrir la nueva SIN soltar la actual (muchos equipos permiten ambas un
      //    instante). Si funciona, recién ahí soltamos la vieja.
      try {
        const s = await obtenerStreamCamara(modo, false)
        try { videoTrackRef.current?.stop() } catch {}
        await aplicarStream(s, false); facingRef.current = modo; setDiag(""); return true
      } catch {}
      // B) Soltar la actual, ESPERAR a que el equipo libere la cámara, reintentar.
      try {
        videoTrackRef.current?.stop(); videoTrackRef.current = null
        await new Promise(r => setTimeout(r, 350))
        const s = await obtenerStreamCamara(modo, false)
        await aplicarStream(s, false); facingRef.current = modo; setDiag(""); return true
      } catch {}
      // C) No se pudo: recuperar la cámara anterior para no quedar en negro.
      try { await aplicarStream(await obtenerStreamCamara(facingRef.current, false), false) } catch {}
      setError("No se pudo abrir la cámara frontal (puede estar en uso o no disponible).")
      setEstado("error")
      return false
    }
    // Montaje o apertura con audio.
    try {
      videoTrackRef.current?.stop(); videoTrackRef.current = null
      await aplicarStream(await obtenerStreamCamara(modo, incluirAudio), incluirAudio)
      facingRef.current = modo
      return true
    } catch {
      setError(incluirAudio
        ? "No se pudo abrir la cámara. Da permiso de cámara y reintenta."
        : "No se pudo cambiar de cámara. Reintenta.")
      setEstado("error")
      return false
    }
  }

  useEffect(() => { abrirCamara("environment", true) }, []) // al montar

  const voltear = async () => {
    const nuevo = facing === "environment" ? "user" : "environment"
    if (await abrirCamara(nuevo, false)) setFacing(nuevo)
  }

  const iniciarWebRTC = async (socket: Socket) => {
    try { pcRef.current?.close() } catch {}
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })
    pcRef.current = pc
    const salida = new MediaStream()
    if (videoTrackRef.current) salida.addTrack(videoTrackRef.current)
    if (audioTrackRef.current) salida.addTrack(audioTrackRef.current)
    for (const t of salida.getTracks()) { const snd = pc.addTrack(t, salida); if (t.kind === "video") videoSenderRef.current = snd }
    pc.onicecandidate = e => { if (e.candidate) socket.emit("camara:senal", { codigo: codigoRef.current, data: { tipo: "ice", candidate: e.candidate } }) }
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === "connected") { setEstado("conectado"); setError("") }
      else if ((st === "failed" || st === "disconnected") && quiereConectadoRef.current) programarReconexion()
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit("camara:senal", { codigo: codigoRef.current, data: { tipo: "offer", sdp: pc.localDescription } })
  }

  // Vigila el track de video: si el equipo lo mata (típico al ir a 2º plano), reconecta.
  const vigilarTrack = () => {
    const t = videoTrackRef.current
    if (t) t.onended = () => { if (quiereConectadoRef.current) programarReconexion() }
  }

  // Programa un reintento (con guarda para no apilar varios).
  const programarReconexion = () => {
    if (!quiereConectadoRef.current || reconectandoRef.current) return
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
    const cod = codigoRef.current.trim().toUpperCase()
    if (!cod) { setError("Escribe el código que muestra el PC."); return }
    try { pcRef.current?.close() } catch {}; pcRef.current = null
    try { socketRef.current?.close() } catch {}; socketRef.current = null
    videoSenderRef.current = null
    // Cámara viva: si el track murió o quedó congelado (2º plano), re-tomarla.
    const t = videoTrackRef.current
    const vivo = t && t.readyState === "live" && !t.muted
    if (!vivo) { if (!(await abrirCamara(facingRef.current, true))) { if (quiereConectadoRef.current) programarReconexion(); return } }
    vigilarTrack()
    setEstado("conectando")
    // En la APK (Capacitor) la página está empaquetada → window.location es
    // "localhost"; usamos el servidor configurado (IP del PC). En navegador
    // servido por el PC, usamos el host del propio URL.
    const esApp = typeof window !== "undefined" && !!(window as any).Capacitor
    const url = esApp ? getSocketUrl() : `http://${window.location.hostname}:4000`
    const socket = io(url, { transports: ["websocket", "polling"], forceNew: true, reconnection: false })
    socketRef.current = socket

    socket.on("connect", () => {
      socket.emit("camara:unir", { codigo: cod }, (resp: any) => {
        if (!resp?.ok) {
          if (resp?.error === "no-host") {
            // El PC aún no está esperando: reintentar en unos segundos.
            setError("Esperando a que el PC abra “Usar celular como cámara”…")
            logConex(`camara:unir sin host (código ${cod})`)
            if (quiereConectadoRef.current) programarReconexion()
          } else { setError("No se pudo unir a la sala."); setEstado("error"); logConex("camara:unir falló (sala)") }
          return
        }
        try { localStorage.setItem("selah-camara-codigo", cod) } catch {}
        setError(""); iniciarWebRTC(socket)
      })
    })
    socket.on("camara:senal", async ({ data }: any) => {
      const pc = pcRef.current; if (!pc || !data) return
      try {
        if (data.tipo === "answer") await pc.setRemoteDescription(data.sdp)
        else if (data.tipo === "ice" && data.candidate) await pc.addIceCandidate(data.candidate)
      } catch {}
    })
    // El PC cerró la cámara A PROPÓSITO → dejar de reintentar.
    socket.on("camara:par-fin", () => { quiereConectadoRef.current = false; setError("El PC cerró la cámara."); cerrar(false) })
    // Caídas de red / socket → reintentar mientras el usuario quiera estar conectado.
    socket.on("disconnect", () => { if (quiereConectadoRef.current) programarReconexion() })
    socket.on("connect_error", (e: any) => { logConex(`connect_error a ${url}: ${e?.message || e}`); if (quiereConectadoRef.current) programarReconexion() })
  }

  const conectar = async () => {
    const cod = codigoRef.current.trim().toUpperCase()
    if (!cod) { setError("Escribe el código que muestra el PC."); return }
    quiereConectadoRef.current = true
    await establecerConexion()
  }

  const cerrar = (avisar = true) => {
    quiereConectadoRef.current = false
    clearTimeout(reintentoTimerRef.current); reconectandoRef.current = false
    try { if (avisar) socketRef.current?.emit("camara:fin", { codigo: codigoRef.current }) } catch {}
    try { pcRef.current?.close() } catch {}; pcRef.current = null
    try { socketRef.current?.close() } catch {}; socketRef.current = null
    videoSenderRef.current = null
    setEstado(videoTrackRef.current ? "listo" : "error")
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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: chip.c, boxShadow: conectado ? `0 0 8px ${chip.c}` : "none" }} />
          <span style={{ color: chip.c }}>{chip.t}</span>
        </div>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Selah · Cámara</span>
      </div>

      {/* Panel inferior */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 16px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12, background: "linear-gradient(0deg, rgba(0,0,0,0.72), rgba(0,0,0,0))" }}>
        {error && <div style={{ background: "rgba(220,38,38,0.85)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>⚠️ {error}</div>}
        {diag && <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 10, padding: "8px 12px", fontSize: 11, fontFamily: "monospace", color: "#fca5a5", wordBreak: "break-word" }}>🔧 {diag}</div>}

        {!conectado && (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="CÓDIGO"
              maxLength={8} autoCapitalize="characters"
              style={{ flex: 1, minWidth: 0, padding: "13px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: 3, textAlign: "center" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={voltear}
            style={{ flex: "0 0 auto", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, fontWeight: 700 }}>🔄 Voltear</button>
          {conectado
            ? <button onClick={() => cerrar(true)} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 800 }}>■ Detener</button>
            : <button onClick={conectar} disabled={estado === "conectando"} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: estado === "conectando" ? "#555" : "#2563eb", color: "#fff", fontSize: 16, fontWeight: 800 }}>
                {estado === "conectando" ? "Conectando…" : "▶ Conectar al PC"}
              </button>}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
          {conectado ? "Deja esta pantalla abierta. Apunta la cámara al frente." : "Escanea el QR del PC o escribe el código. Ambos en la misma red WiFi."}
        </div>
      </div>
    </div>
  )
}
