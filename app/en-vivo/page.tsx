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
  const [microId, setMicroId] = useState<string>("")
  const [permiso, setPermiso] = useState<"pidiendo" | "ok" | "denegado">("pidiendo")
  const [errorCam, setErrorCam] = useState<string | null>(null)
  const [mostrarLetra, setMostrarLetra] = useState(true)
  const [reintento, setReintento] = useState(0)

  // Contenido que se está proyectando (espejo por socket)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [partes, setPartes] = useState<any[]>([]) // cada parte es un objeto { texto_letra|texto, tipo }
  const [index, setIndex] = useState(0)
  const [logoUrl, setLogoUrl] = useState("")
  const [conectadoSala, setConectadoSala] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number>(0)

  // Refs con el contenido para que el loop de dibujo (que no se re-crea) siempre
  // lea lo último sin re-suscribirse en cada cambio de parte.
  const contenidoRef = useRef({ titulo: "", tono: "", partes: [] as any[], index: 0, mostrar: true })
  useEffect(() => {
    contenidoRef.current = { titulo, tono, partes, index, mostrar: mostrarLetra }
  }, [titulo, tono, partes, index, mostrarLetra])

  // ── Cargar el logo de la iglesia (para la marca de agua) ────────────────────
  useEffect(() => {
    if (!logoUrl) { logoImgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = "anonymous" // necesario para no "manchar" el lienzo al transmitir
    img.onload = () => { logoImgRef.current = img }
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
        } else if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
          setPermiso("denegado")
          setErrorCam("No se encontró la cámara seleccionada. Conecta una cámara y reintenta.")
        } else {
          setPermiso("denegado")
          setErrorCam("No se pudo abrir la cámara. " + (e?.message || ""))
        }
      }
    }

    iniciar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaraId, microId, reintento])

  // Detener la cámara al salir de la pantalla
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  // ── Espejo del contenido proyectado (mismo socket que /proyectar) ───────────
  useEffect(() => {
    let activo = true
    const s = io(getSocketUrl(), { reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 })

    const aplicarCancion = (d: any) => {
      setPartes(d.partes || []); setIndex(d.index || 0)
      setTitulo(d.titulo || ""); setTono(d.tono || "")
      setLogoUrl(d.logo_marca_url || "")
    }
    const limpiar = () => { setPartes([]); setTitulo(""); setTono(""); setIndex(0) }

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
      else limpiar() // imagen / biblia / estado especial: sin letra por ahora
    })
    s.on("cargar-cancion", (d: any) => { if (activo) aplicarCancion(d || {}) })
    s.on("cambiar-parte", (i: number) => { if (activo) setIndex(i) })
    s.on("mostrar-imagen", () => { if (activo) limpiar() })
    s.on("mostrar-biblia", () => { if (activo) limpiar() })
    s.on("mostrar-estado", () => { if (activo) limpiar() })

    return () => { activo = false; s.disconnect() }
  }, [])

  // ── Bucle de composición: cámara + letra + logo → lienzo ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dibujar = () => {
      // Blindado: un error acá NO debe matar el bucle (antes lo mataba y se
      // congelaba todo). Pase lo que pase, re-agendamos el siguiente fotograma.
      try {
        const v = videoRef.current
        // Fondo negro
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, ANCHO, ALTO)

        // Cámara con recorte "cover"
        if (v && v.videoWidth > 0) {
          const escala = Math.max(ANCHO / v.videoWidth, ALTO / v.videoHeight)
          const w = v.videoWidth * escala, h = v.videoHeight * escala
          ctx.drawImage(v, (ANCHO - w) / 2, (ALTO - h) / 2, w, h)
        }

        const cont = contenidoRef.current

        // Marca de agua: logo arriba a la derecha
        const logo = logoImgRef.current
        if (logo) {
          const lw = 118, lh = logo.height * (lw / logo.width)
          ctx.globalAlpha = 0.9
          ctx.drawImage(logo, ANCHO - lw - 34, 30, lw, lh)
          ctx.globalAlpha = 1
        }

        // Rótulo inferior con la letra que se está proyectando
        const parte = cont.mostrar ? limpiarLetra(cont.partes[cont.index]) : ""
        if (parte.trim()) {
          dibujarRotuloInferior(ctx, parte, cont.titulo, cont.tono)
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
          <canvas ref={canvasRef} width={ANCHO} height={ALTO} style={{ width: "100%", height: "100%", display: "block" }} />
          {/* etiqueta */}
          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: 99, fontSize: 11.5, fontWeight: 800, background: "rgba(0,0,0,.55)", color: "#fff", backdropFilter: "blur(4px)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: "#4ade80" }} />
            VISTA PREVIA
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

        {/* Controles */}
        <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 20, marginTop: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ fontSize: 12.5, color: C.tenue }}>
              🎥 Cámara
              <select value={camaraId} onChange={e => setCamaraId(e.target.value)} style={selectEstilo}>
                {camaras.length === 0 && <option value="">(sin cámaras)</option>}
                {camaras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: C.tenue }}>
              🎙️ Micrófono / entrada de audio
              <select value={microId} onChange={e => setMicroId(e.target.value)} style={selectEstilo}>
                {micros.length === 0 && <option value="">(sin micrófonos)</option>}
                {micros.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Mostrar la letra sobre la cámara</div>
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>
                {conectadoSala
                  ? (titulo ? `Proyectando: ${titulo}${tono ? ` · Tono ${tono}` : ""}` : "Esperando a que proyectes una canción…")
                  : "Conectando con la proyección…"}
              </div>
            </div>
            <button onClick={() => setMostrarLetra(v => !v)} aria-label="Mostrar/ocultar letra"
              style={{ position: "relative", width: 50, height: 28, borderRadius: 99, border: "none", cursor: "pointer", background: mostrarLetra ? C.verde : "rgba(255,255,255,0.14)", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: mostrarLetra ? 25 : 3, width: 22, height: 22, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
            </button>
          </div>
        </div>

        {/* Nota del próximo incremento */}
        <div style={{ marginTop: 18, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: C.suave }}>
          <strong style={{ color: C.texto }}>Próximo paso:</strong> el botón <strong style={{ color: C.texto }}>“Salir en vivo”</strong> para transmitir esta vista a tu Página de Facebook o YouTube. Por ahora puedes probar la cámara, elegir la entrada de audio y ver cómo se ve la letra sobre la imagen.
        </div>
      </div>
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

// ── Dibujo del rótulo inferior con la letra ────────────────────────────────────
function dibujarRotuloInferior(ctx: CanvasRenderingContext2D, texto: string, titulo: string, tono: string) {
  // Preparar las líneas (respetando saltos del texto + ajuste por ancho)
  const maxAncho = ANCHO - 160
  const tamano = 44
  ctx.font = `700 ${tamano}px 'Segoe UI', system-ui, sans-serif`
  const lineas: string[] = []
  for (const bruto of texto.split("\n")) {
    const linea = bruto.trim()
    if (!linea) continue
    lineas.push(...ajustarLinea(ctx, linea, maxAncho))
  }
  const mostradas = lineas.slice(0, 4) // no saturar la pantalla
  const alturaLinea = tamano * 1.28
  const padY = 34
  const altoBloque = mostradas.length * alturaLinea + padY * 2

  // Degradado inferior para legibilidad
  const grad = ctx.createLinearGradient(0, ALTO - altoBloque - 60, 0, ALTO)
  grad.addColorStop(0, "rgba(0,0,0,0)")
  grad.addColorStop(1, "rgba(0,0,0,0.78)")
  ctx.fillStyle = grad
  ctx.fillRect(0, ALTO - altoBloque - 60, ANCHO, altoBloque + 60)

  // Título + tono (arriba del rótulo)
  if (titulo) {
    ctx.font = "600 24px 'Segoe UI', system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.72)"
    ctx.textAlign = "center"
    const etiqueta = tono ? `${titulo.toUpperCase()}  ·  ${tono}` : titulo.toUpperCase()
    ctx.fillText(etiqueta, ANCHO / 2, ALTO - altoBloque - 6)
  }

  // Letra
  ctx.font = `700 ${tamano}px 'Segoe UI', system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.shadowColor = "rgba(0,0,0,0.85)"
  ctx.shadowBlur = 8
  let y = ALTO - altoBloque + padY + tamano
  for (const l of mostradas) {
    ctx.fillStyle = "#ffffff"
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

function botonBase(extra: React.CSSProperties): React.CSSProperties {
  return { padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, ...extra }
}

const selectEstilo: React.CSSProperties = {
  width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)", background: "#0a1525",
  color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
}
