"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { logCatch } from "@/lib/Errorlogger"

interface Props {
  leerMedicion: () => { entradaDb:number; salidaDb:number; reduccionDb:number; saturado:boolean }
  monitor: boolean
  cambiarMonitor: () => void
  retardoMs: number
  cambiarRetardo: (valor: number) => void
  crearStream: () => MediaStream | null
  bloqueado: boolean
  micNombre: string
  enEspera: boolean
}

export default function PanelAudioProfesional(p: Props) {
  const [medicion, setMedicion] = useState({ entradaDb:-96, salidaDb:-96, reduccionDb:0, saturado:false })
  const leerRef = useRef(p.leerMedicion)
  leerRef.current = p.leerMedicion
  useEffect(() => { const id = setInterval(() => setMedicion(leerRef.current()), 250); return () => clearInterval(id) }, [])
  const [grabando, setGrabando] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const [segundos, setSegundos] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const urlRef = useRef("")
  const montadoRef = useRef(false)

  const limpiarCaptura = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    // Solo el track de canvas pertenece a esta prueba. El audio se comparte con el motor.
    streamRef.current?.getVideoTracks().forEach(t => t.stop())
    streamRef.current = null
    recRef.current = null
  }, [])
  const cancelar = useCallback(() => {
    const rec = recRef.current
    if (rec) { rec.onstop = null; rec.ondataavailable = null; rec.onerror = null; if (rec.state !== "inactive") rec.stop() }
    limpiarCaptura()
  }, [limpiarCaptura])
  useEffect(() => {
    montadoRef.current = true
    return () => { montadoRef.current = false; cancelar(); if (urlRef.current) URL.revokeObjectURL(urlRef.current) }
  }, [cancelar])
  useEffect(() => {
    cancelar(); setGrabando(false); setError("")
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ""; setUrl("")
  }, [p.micNombre, p.bloqueado, cancelar])

  const grabar = () => {
    if (recRef.current || p.bloqueado || p.enEspera) return
    setError("")
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ""; setUrl("")
    try {
      const stream = p.crearStream()
      streamRef.current = stream
      if (!stream?.getVideoTracks().length || !stream.getAudioTracks().length) throw new Error("Selecciona una cámara y un micrófono antes de calibrar.")
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 3_000_000 })
      recRef.current = rec
      const chunks: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => {
        limpiarCaptura()
        if (!montadoRef.current) return
        setGrabando(false)
        if (!chunks.length) { setError("La prueba no produjo video. Revisa la fuente de cámara."); return }
        const nueva = URL.createObjectURL(new Blob(chunks, { type:rec.mimeType }))
        urlRef.current = nueva; setUrl(nueva)
      }
      rec.onerror = () => {
        cancelar(); setGrabando(false); setError("Falló la grabación de prueba. Revisa el registro de errores.")
        logCatch(new Error("MediaRecorder falló durante calibración"), "Calibración de audio", { tipo:"audio", pagina:"/en-vivo" })
      }
      rec.start(500); setGrabando(true); setSegundos(8)
      const fin = Date.now() + 8000
      timerRef.current = setInterval(() => {
        setSegundos(Math.max(0, Math.ceil((fin - Date.now()) / 1000)))
        if (Date.now() >= fin) { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; if (rec.state !== "inactive") rec.stop() }
      }, 200)
    } catch (e) {
      cancelar(); setGrabando(false)
      setError(e instanceof Error ? e.message : "No se pudo grabar la prueba.")
      logCatch(e, "Calibración de audio", { tipo:"audio", pagina:"/en-vivo" })
    }
  }
  const db = (valor: number) => valor <= -95 ? "Silencio" : `${valor.toFixed(1)} dBFS`
  const boton = { padding:"8px 11px", borderRadius:8, border:"1px solid #40506a", background:"#18263b", color:"#eaf0fb", cursor:"pointer", fontSize:12 } as const
  return <div style={{ marginTop:12, borderTop:"1px solid #334155", paddingTop:10, fontSize:12 }}>
    <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontVariantNumeric:"tabular-nums" }}>
      <span>Entrada: {db(medicion.entradaDb)}</span><span>Al aire: {db(medicion.salidaDb)}</span>
      <span>Protección de picos: {medicion.reduccionDb < -0.5 ? `${Math.abs(medicion.reduccionDb).toFixed(1)} dB de reducción` : "activa"}</span>
    </div>
    {medicion.saturado && <p role="status" style={{ color:"#fca5a5" }}>El micrófono llega cerca de saturación. Baja la ganancia en la consola o en el dispositivo; el volumen de Selah no repara una entrada distorsionada.</p>}
    <button type="button" style={{ ...boton, marginTop:10 }} aria-pressed={p.monitor} onClick={p.cambiarMonitor}>{p.monitor ? "■ Dejar de escuchar" : "🎧 Escuchar con audífonos"}</button>
    <div style={{ fontSize:11, opacity:.65, marginTop:5 }}>Escucha la salida de Selah en el dispositivo de sonido del PC. Usa audífonos para evitar acoples. Empieza apagado en cada sesión.</div>
    <details style={{ marginTop:12 }}>
      <summary style={{ cursor:"pointer", fontWeight:750 }}>Calibrar sincronización de audio y video</summary>
      <p>Micrófono: {p.micNombre}. Graba 8 segundos y da tres palmadas frente a la cámara. Luego escucha el video con audífonos y comprueba cuándo se juntan las manos.</p>
      <button type="button" style={boton} disabled={p.bloqueado || p.enEspera || grabando} onClick={grabar}>{grabando ? `Grabando prueba · ${segundos} s` : "Grabar prueba de 8 segundos"}</button>
      {p.bloqueado && <p>Detén la emisión y la grabación del culto antes de calibrar.</p>}
      {p.enEspera && <p>Cambia a una escena con cámara; Espera silencia el audio.</p>}
      {error && <p role="alert" style={{ color:"#fca5a5" }}>{error}</p>}
      {url && <video controls playsInline src={url} onPlay={() => { if (p.monitor) p.cambiarMonitor() }} style={{ display:"block", width:"100%", maxHeight:260, marginTop:10, background:"#000", borderRadius:8 }} />}
      <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:12 }}>Retrasar audio
        <input type="range" min={0} max={2000} step={20} value={p.retardoMs} disabled={p.bloqueado || grabando} onChange={e => p.cambiarRetardo(Number(e.target.value))} style={{ flex:1, minWidth:50 }} />
        <span>{p.retardoMs} ms</span>
      </label>
      <p style={{ opacity:.7 }}>Si escuchas la palmada antes de ver el contacto, aumenta el retraso y repite la prueba. Si el audio llega después, vuelve a 0. Este ajuste no puede adelantar el audio.</p>
      <button type="button" style={boton} disabled={p.bloqueado || grabando} onClick={() => p.cambiarRetardo(0)}>Restablecer a 0 ms</button>
    </details>
  </div>
}
