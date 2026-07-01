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
  const MAX_PERIODO = Math.floor(sampleRate / 50)
  const MIN_PERIODO = Math.floor(sampleRate / 1000)
  let bestCorr = -1, bestPeriodo = -1

  for (let periodo = MIN_PERIODO; periodo < MAX_PERIODO; periodo++) {
    let corr = 0
    for (let i = 0; i < SIZE - periodo; i++) {
      corr += buffer[i] * buffer[i + periodo]
    }
    if (corr > bestCorr) { bestCorr = corr; bestPeriodo = periodo }
  }

  if (bestCorr < 0.01 * SIZE) return -1  // señal muy débil
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

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  const bufferRef   = useRef<Float32Array<ArrayBuffer>>(new Float32Array(2048) as Float32Array<ArrayBuffer>)

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx     = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source  = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.85
      source.connect(analyser)

      audioCtxRef.current = ctx
      analyserRef.current = analyser

      setActivo(true)

      const loop = () => {
        if (!analyserRef.current) return
        analyserRef.current.getFloatTimeDomainData(bufferRef.current)

        // Calcular volumen RMS
        const rms = Math.sqrt(bufferRef.current.reduce((s, v) => s + v * v, 0) / bufferRef.current.length)
        setVolumen(Math.min(100, Math.round(rms * 500)))

        if (rms > 0.015) {
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
      setError(e.name === "NotAllowedError" ? "Sin permiso para el micrófono" : e.message)
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
    </div>
  )
}
