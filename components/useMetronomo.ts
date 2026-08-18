"use client"

// Motor del metrónomo (WebAudio) a nivel de PÁGINA, no del panel: así sigue
// sonando aunque cierres la hoja de Ensayo. Usa un scheduler con "lookahead"
// para que el clic sea preciso (setInterval solo se desfasa).

import { useEffect, useRef, useState } from "react"

export type Metronomo = ReturnType<typeof useMetronomo>

export function useMetronomo() {
  const ctxRef = useRef<AudioContext | null>(null)
  const getCtx = (): AudioContext => {
    if (!ctxRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      ctxRef.current = new Ctx()
    }
    try { ctxRef.current!.resume?.() } catch {}
    return ctxRef.current!
  }

  const [sonando, setSonando] = useState(false)
  const [bpm, setBpm] = useState(90)
  const [compas, setCompas] = useState(4)
  const [beatVis, setBeatVis] = useState(-1)
  const bpmRef = useRef(90), compasRef = useRef(4), sonandoRef = useRef(false)
  const nextRef = useRef(0), beatRef = useRef(0), timerRef = useRef<any>(0)
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
    while (nextRef.current < ctx.currentTime + 0.12) {
      const idx = beatRef.current % compasRef.current
      clic(nextRef.current, idx === 0)
      const dt = Math.max(0, (nextRef.current - ctx.currentTime) * 1000)
      window.setTimeout(() => { if (sonandoRef.current) setBeatVis(idx) }, dt)
      nextRef.current += 60 / bpmRef.current
      beatRef.current++
    }
    timerRef.current = window.setTimeout(scheduler, 25)
  }

  const arrancar = () => {
    const ctx = getCtx()
    beatRef.current = 0
    nextRef.current = ctx.currentTime + 0.06
    sonandoRef.current = true; setSonando(true)
    scheduler()
  }
  const detener = () => {
    window.clearTimeout(timerRef.current)
    sonandoRef.current = false; setSonando(false); setBeatVis(-1)
  }
  const toggle = () => (sonandoRef.current ? detener() : arrancar())

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

  return { sonando, bpm, setBpm, compas, setCompas, beatVis, toggle, tap }
}
