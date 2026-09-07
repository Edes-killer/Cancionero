"use client"
import { useEffect, useRef, useState, useCallback } from "react"

// Frecuencias de referencia (La4 = 440Hz, sistema temperado igual)
const NOTAS_LATINAS = ["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"]
const NOTAS_INGLESAS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

const frecANota = (freq: number): { nota: string; octava: number; cents: number } | null => {
  if (!freq || freq < 50 || freq > 2000) return null
  const semitono = 12 * Math.log2(freq / 440) + 69
  const semitonoRedondeado = Math.round(semitono)
  const cents = Math.round((semitono - semitonoRedondeado) * 100)
  const indice = ((semitonoRedondeado % 12) + 12) % 12
  const octava = Math.floor(semitonoRedondeado / 12) - 1
  return { nota: NOTAS_LATINAS[indice], octava, cents }
}

// Autocorelación para detectar tono fundamental
const detectarTono = (buffer: Float32Array<ArrayBuffer>, sampleRate: number): number => {
  const SIZE = buffer.length
  const MAX_PERIODO = Math.min(Math.floor(sampleRate / 55), SIZE - 2)
  const MIN_PERIODO = Math.max(2, Math.floor(sampleRate / 1200))
  let media = 0
  for (let i = 0; i < SIZE; i++) media += buffer[i]
  media /= SIZE
  let bestCorr = 0, bestPeriodo = -1

  for (let periodo = MIN_PERIODO; periodo < MAX_PERIODO; periodo++) {
    let corr = 0, energiaA = 0, energiaB = 0
    for (let i = 0; i < SIZE - periodo; i++) {
      const a = buffer[i] - media, b = buffer[i + periodo] - media
      corr += a * b; energiaA += a * a; energiaB += b * b
    }
    const normalizada = corr / Math.sqrt(Math.max(energiaA * energiaB, 1e-12))
    if (normalizada > bestCorr) { bestCorr = normalizada; bestPeriodo = periodo }
  }

  if (bestCorr < 0.62 || bestPeriodo < 0) return -1
  return sampleRate / bestPeriodo
}

interface Props {
  onDetectar?: (nota: string, octava: number) => void
  style?: React.CSSProperties
}

export default function PitchDetector({ onDetectar, style }: Props) {
  const [activo,    setActivo]    = useState(false)
  const [notaActual, setNotaActual] = useState<{ nota: string; octava: number; cents: number } | null>(null)
  const [frecActual, setFrecActual] = useState<number | null>(null)
  const [error,     setError]     = useState("")
  const [volumen,   setVolumen]   = useState(0)
  const [microfonos, setMicrofonos] = useState<MediaDeviceInfo[]>([])
  const [microId, setMicroId] = useState("")

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  const bufferRef   = useRef<Float32Array<ArrayBuffer>>(new Float32Array(4096) as Float32Array<ArrayBuffer>)
  const ultimaMedicionRef = useRef(0)

  const detener = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current   = null
    setActivo(false)
    setNotaActual(null)
    setFrecActual(null)
    setVolumen(0)
  }, [])

  const iniciar = async () => {
    setError("")
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este dispositivo no permite usar el micrófono desde esta pantalla")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(microId ? { deviceId: { exact: microId } } : {}),
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
          channelCount: 1
        }, video: false
      })
      streamRef.current = stream

      const ctx     = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (ctx.state === "suspended") await ctx.resume()
      const source  = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)

      audioCtxRef.current = ctx
      analyserRef.current = analyser

      setActivo(true)
      try {
        const dispositivos = await navigator.mediaDevices.enumerateDevices()
        setMicrofonos(dispositivos.filter(d => d.kind === "audioinput"))
      } catch {}

      const loop = () => {
        if (!analyserRef.current) return
        analyserRef.current.getFloatTimeDomainData(bufferRef.current)

        // Calcular volumen RMS
        const rms = Math.sqrt(bufferRef.current.reduce((s, v) => s + v * v, 0) / bufferRef.current.length)
        setVolumen(Math.min(100, Math.round(rms * 500)))

        const ahora = performance.now()
        if (rms > 0.008 && ahora - ultimaMedicionRef.current >= 80) {
          ultimaMedicionRef.current = ahora
          const freq = detectarTono(bufferRef.current, ctx.sampleRate)
          if (freq > 0) {
            const info = frecANota(freq)
            if (info) {
              setNotaActual(info)
              setFrecActual(Math.round(freq))
              onDetectar?.(info.nota, info.octava)
            }
          }
        }

        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (e: any) {
      const mensajes: Record<string,string> = {
        NotAllowedError: "Selah no tiene permiso para usar el micrófono. Habilítalo en los permisos del sistema.",
        NotFoundError: "No se encontró ningún micrófono disponible.",
        NotReadableError: "El micrófono está siendo usado por otra aplicación. Ciérrala e intenta nuevamente.",
        OverconstrainedError: "El micrófono seleccionado ya no está disponible. Elige otro dispositivo."
      }
      setError(mensajes[e?.name] || e?.message || "No se pudo iniciar el afinador")
    }
  }

  useEffect(() => () => detener(), [detener])

  // Color según precisión (cents)
  const colorCents = (cents: number) => {
    const abs = Math.abs(cents)
    if (abs <= 5)  return "#22c55e"  // verde → afinado
    if (abs <= 15) return "#f59e0b"  // amarillo → cerca
    return "#ef4444"                 // rojo → desafinado
  }

  return (
    <div style={{
      borderRadius: 16, padding: 20, background: "rgba(17,27,46,0.97)",
      border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Segoe UI',system-ui,sans-serif",
      color: "white", ...style
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>🎙️ Detector de tono</div>
        <button
          onClick={activo ? detener : iniciar}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13,
            background: activo ? "rgba(239,68,68,0.15)" : "rgba(37,99,235,0.15)",
            color: activo ? "#fca5a5" : "#93c5fd",
          }}
        >
          {activo ? "⏹ Detener" : "▶ Iniciar"}
        </button>
      </div>

      {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {microfonos.length > 1 && (
        <label style={{ display:"block", marginBottom:12, fontSize:11, color:"rgba(255,255,255,.55)" }}>
          Micrófono
          <select value={microId} disabled={activo} onChange={e => setMicroId(e.target.value)} style={{ display:"block", width:"100%", marginTop:5, padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,.12)", background:"#0a1525", color:"white", fontSize:12 }}>
            <option value="">Predeterminado del sistema</option>
            {microfonos.map((m, i) => <option key={m.deviceId} value={m.deviceId}>{m.label || `Micrófono ${i + 1}`}</option>)}
          </select>
          {activo && <span style={{ display:"block", marginTop:4, opacity:.65 }}>Detén el afinador para cambiar de entrada.</span>}
        </label>
      )}

      {/* Nota principal */}
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        {notaActual ? (
          <>
            <div style={{
              fontSize: 72, fontWeight: 900, lineHeight: 1,
              color: colorCents(notaActual.cents)
            }}>
              {notaActual.nota}
            </div>
            <div style={{ fontSize: 18, opacity: 0.5, marginTop: 4 }}>
              Octava {notaActual.octava}
            </div>
            {frecActual && (
              <div style={{ fontSize: 13, opacity: 0.4, marginTop: 4 }}>
                {frecActual} Hz
              </div>
            )}
            {/* Indicador de afinación */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, opacity: 0.4, width: 32, textAlign: "right" }}>♭</span>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, position: "relative" }}>
                <div style={{
                  position: "absolute", width: 12, height: 12, borderRadius: "50%",
                  background: colorCents(notaActual.cents), top: -3,
                  left: `calc(50% + ${notaActual.cents}%)`,
                  transform: "translateX(-50%)",
                  boxShadow: `0 0 8px ${colorCents(notaActual.cents)}`,
                  transition: "left 0.1s, background 0.1s"
                }}/>
                <div style={{ position: "absolute", left: "50%", top: -2, width: 2, height: 10, background: "rgba(255,255,255,0.3)", borderRadius: 1, transform: "translateX(-50%)" }}/>
              </div>
              <span style={{ fontSize: 11, opacity: 0.4, width: 32 }}>♯</span>
            </div>
            <div style={{ fontSize: 11, color: colorCents(notaActual.cents), marginTop: 8, fontWeight: 700 }}>
              {Math.abs(notaActual.cents) <= 5 ? "✓ Afinado" :
               notaActual.cents < 0 ? `${Math.abs(notaActual.cents)}¢ bajo` :
               `${notaActual.cents}¢ alto`}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 36, opacity: 0.15, padding: "10px 0" }}>
            {activo ? "🎤" : "🎙️"}
          </div>
        )}
      </div>

      {/* Barra de volumen */}
      {activo && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, opacity: 0.4 }}>Vol</span>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{
              height: "100%", borderRadius: 2, transition: "width 0.05s",
              width: `${volumen}%`,
              background: volumen > 70 ? "#ef4444" : volumen > 30 ? "#22c55e" : "#3b82f6"
            }}/>
          </div>
        </div>
      )}
      {activo && volumen < 4 && !notaActual && (
        <div style={{ marginTop:10, textAlign:"center", fontSize:11.5, color:"rgba(251,191,36,.75)" }}>No entra suficiente señal. Acerca el instrumento al micrófono o elige otra entrada.</div>
      )}
    </div>
  )
}
