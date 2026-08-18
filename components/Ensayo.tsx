"use client"

// ── Herramientas de ensayo: Metrónomo + Nota de partida ──────────────────────
// Ambas usan WebAudio (sin librerías). El metrónomo usa un scheduler con
// "lookahead" para que el clic sea preciso (setInterval solo no basta). La nota
// de partida saca la tónica del tono de la canción (reusa lib/improvisacion).

import { useEffect, useRef, useState } from "react"
import { improvisar } from "@/lib/improvisacion"

const AZUL = "#3b82f6"
const AMBAR = "#fbbf24"

export default function Ensayo({ tono, pasos = 0, americano = false }: { tono: string; pasos?: number; americano?: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null)
  const getCtx = (): AudioContext => {
    if (!ctxRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      ctxRef.current = new Ctx()
    }
    try { ctxRef.current!.resume?.() } catch {}
    return ctxRef.current!
  }

  // ── Metrónomo ──────────────────────────────────────────────────────────────
  const [sonando, setSonando] = useState(false)
  const [bpm, setBpm] = useState(90)
  const [compas, setCompas] = useState(4)
  const [beatVis, setBeatVis] = useState(-1)
  const bpmRef = useRef(90), compasRef = useRef(4), sonandoRef = useRef(false)
  const nextTimeRef = useRef(0), beatRef = useRef(0), timerRef = useRef<any>(0)
  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { compasRef.current = compas }, [compas])

  const clic = (t: number, acento: boolean) => {
    const ctx = getCtx()
    const osc = ctx.createOscillator(), g = ctx.createGain()
    osc.frequency.value = acento ? 1600 : 1000
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(acento ? 0.6 : 0.32, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    osc.connect(g); g.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.06)
  }

  const scheduler = () => {
    const ctx = getCtx()
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const idx = beatRef.current % compasRef.current
      clic(nextTimeRef.current, idx === 0)
      const dt = Math.max(0, (nextTimeRef.current - ctx.currentTime) * 1000)
      window.setTimeout(() => { if (sonandoRef.current) setBeatVis(idx) }, dt)
      nextTimeRef.current += 60 / bpmRef.current
      beatRef.current++
    }
    timerRef.current = window.setTimeout(scheduler, 25)
  }

  const arrancar = () => {
    const ctx = getCtx()
    beatRef.current = 0
    nextTimeRef.current = ctx.currentTime + 0.06
    sonandoRef.current = true; setSonando(true)
    scheduler()
  }
  const detener = () => {
    window.clearTimeout(timerRef.current)
    sonandoRef.current = false; setSonando(false); setBeatVis(-1)
  }
  const toggle = () => (sonando ? detener() : arrancar())

  // Tap tempo: promedio de los últimos toques (dentro de 2 s).
  const tapsRef = useRef<number[]>([])
  const tap = () => {
    const now = performance.now()
    const taps = [...tapsRef.current.filter(t => now - t < 2000), now]
    tapsRef.current = taps
    if (taps.length >= 2) {
      const difs = taps.slice(1).map((t, i) => t - taps[i])
      const prom = difs.reduce((a, b) => a + b, 0) / difs.length
      const n = Math.round(60000 / prom)
      if (n >= 40 && n <= 240) setBpm(n)
    }
  }

  useEffect(() => () => { window.clearTimeout(timerRef.current); try { ctxRef.current?.close() } catch {} }, [])

  // ── Nota de partida ──────────────────────────────────────────────────────────
  const [octava, setOctava] = useState(4)
  const imp = tono ? improvisar(tono, pasos, americano) : null   // root ya transpuesto
  const freqMidi = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
  const tocar = (midis: number[], dur = 1.6) => {
    const ctx = getCtx()
    const t0 = ctx.currentTime + 0.02
    midis.forEach(m => {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.type = "triangle"; osc.frequency.value = freqMidi(m)
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t0); osc.stop(t0 + dur + 0.1)
    })
  }
  const midiRoot = imp ? 12 * (octava + 1) + imp.root : null
  const tocarNota = () => { if (midiRoot != null) tocar([midiRoot]) }
  const tocarAcorde = () => {
    if (midiRoot == null || !imp) return
    tocar([midiRoot, midiRoot + (imp.esMenor ? 3 : 4), midiRoot + 7])
  }

  const btn = (activo: boolean, color: string): React.CSSProperties => ({
    padding: "7px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${activo ? color : "rgba(255,255,255,0.14)"}`,
    background: activo ? color + "26" : "rgba(255,255,255,0.06)",
    color: activo ? "#fff" : "rgba(255,255,255,0.75)",
  })

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── METRÓNOMO ─── */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: AZUL, marginBottom: 12 }}>🥁 Metrónomo</div>

        {/* Puntos del compás */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          {Array.from({ length: compas }).map((_, i) => (
            <span key={i} style={{
              width: i === 0 ? 15 : 12, height: i === 0 ? 15 : 12, borderRadius: 99,
              background: beatVis === i ? (i === 0 ? AMBAR : AZUL) : "rgba(255,255,255,0.16)",
              transform: beatVis === i ? "scale(1.25)" : "scale(1)", transition: "transform .06s, background .06s",
            }} />
          ))}
        </div>

        {/* BPM grande */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 46, fontWeight: 850, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{bpm}</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginLeft: 6 }}>BPM</span>
        </div>

        {/* Slider + −/+ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setBpm(b => Math.max(40, b - 1))} style={{ ...btn(false, AZUL), width: 40, textAlign: "center" }}>−</button>
          <input type="range" min={40} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{ flex: 1 }} aria-label="Tempo (BPM)" />
          <button onClick={() => setBpm(b => Math.min(240, b + 1))} style={{ ...btn(false, AZUL), width: 40, textAlign: "center" }}>+</button>
        </div>

        {/* Compás */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>Compás</span>
          {[2, 3, 4, 6].map(c => (
            <button key={c} onClick={() => setCompas(c)} style={{ ...btn(compas === c, AZUL), padding: "5px 12px" }}>{c}/4</button>
          ))}
        </div>

        {/* Play + Tap */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={toggle} style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none", cursor: "pointer",
            fontSize: 15, fontWeight: 800, color: "#fff",
            background: sonando ? "#ef4444" : "#22c55e",
          }}>{sonando ? "■ Detener" : "▶ Iniciar"}</button>
          <button onClick={tap} style={{ ...btn(false, AZUL), padding: "0 20px", fontSize: 14 }}>Tap</button>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ─── NOTA DE PARTIDA ─── */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: AMBAR, marginBottom: 12 }}>🎤 Nota de partida</div>

        {imp ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>Tono de la canción</div>
              <div style={{ fontSize: 26, fontWeight: 850, color: "#a5b4fc" }}>{imp.tonoNombre}</div>
            </div>

            {/* Octava */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>Octava</span>
              {[3, 4, 5].map(o => (
                <button key={o} onClick={() => setOctava(o)} style={{ ...btn(octava === o, AMBAR), padding: "5px 13px" }}>
                  {o === 3 ? "Grave" : o === 4 ? "Media" : "Aguda"}
                </button>
              ))}
            </div>

            {/* Botones sonar */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={tocarNota} style={{
                flex: 1, padding: "13px", borderRadius: 12, border: "none", cursor: "pointer",
                fontSize: 15, fontWeight: 800, color: "#111", background: AMBAR,
              }}>♪ Dar la nota</button>
              <button onClick={tocarAcorde} style={{ ...btn(false, AMBAR), padding: "0 18px", fontSize: 14, fontWeight: 800 }}>🎹 Acorde</button>
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 10 }}>
              Suena la tónica ({imp.tonoNombre.split(" ")[0]}) para arrancar afinados. “Acorde” toca el {imp.esMenor ? "menor" : "mayor"} completo.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "10px 0" }}>
            Esta canción no tiene tono definido, así que no puedo dar la nota de partida.
          </div>
        )}
      </section>
    </div>
  )
}
