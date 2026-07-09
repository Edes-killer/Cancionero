"use client"

import { useEffect, useRef, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "../../lib/getIglesia"
import { getSocketUrl } from "@/lib/servidor"

// ── Componente fondos animados con Canvas ────────────────────────────────────
function CanvasFondo({ animacion, oscuridad }: { animacion: string; oscuridad: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const dataRef   = useRef<any>({})

  useEffect(() => {
    dataRef.current = {}   // ← limpiar datos de la animación anterior
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let t = 0
    let lastFrame = 0
    const TARGET_FPS = 30
    const FRAME_MS = 1000 / TARGET_FPS
    const d = dataRef.current

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      d.init = false   // forzar reinicialización de partículas
    }
    resize()
    window.addEventListener("resize", resize)

    const animaciones: Record<string, () => void> = {

      // ── AURORA BOREAL: bandas de luz que ondean horizontalmente ──────────
      aurora: () => {
        const { width: W, height: H } = canvas
        ctx.fillStyle = "#000d1f"
        ctx.fillRect(0, 0, W, H)

        const bandas = [
          { y: 0.20, col: [0, 230, 160],  vel: 0.6, amp: 0.07 },
          { y: 0.35, col: [0, 180, 255],  vel: 0.4, amp: 0.09 },
          { y: 0.50, col: [120, 60, 255], vel: 0.7, amp: 0.06 },
          { y: 0.65, col: [0, 210, 200],  vel: 0.5, amp: 0.08 },
          { y: 0.78, col: [80, 130, 255], vel: 0.45, amp: 0.05 },
        ]
        bandas.forEach((b, i) => {
          const [r,g,bl] = b.col
          const yC  = H * b.y + Math.sin(t * b.vel + i * 1.5) * H * b.amp
          const espesor = H * (0.07 + 0.025 * Math.sin(t * 0.5 + i))
          const alfa  = 0.18 + 0.10 * Math.sin(t * b.vel * 0.7 + i * 2)

          // Banda principal
          const gBanda = ctx.createLinearGradient(0, yC - espesor, 0, yC + espesor)
          gBanda.addColorStop(0,   `rgba(${r},${g},${bl},0)`)
          gBanda.addColorStop(0.5, `rgba(${r},${g},${bl},${alfa})`)
          gBanda.addColorStop(1,   `rgba(${r},${g},${bl},0)`)
          ctx.fillStyle = gBanda
          ctx.fillRect(0, yC - espesor, W, espesor * 2)

          // Variación horizontal (más dinámico)
          for (let x = 0; x < W; x += W / 6) {
            const localY = yC + Math.sin(x * 0.005 + t * b.vel * 0.8 + i) * H * 0.03
            const gr = ctx.createRadialGradient(x, localY, 0, x, localY, W / 8)
            gr.addColorStop(0, `rgba(${r},${g},${bl},${alfa * 0.5})`)
            gr.addColorStop(1, `rgba(${r},${g},${bl},0)`)
            ctx.fillStyle = gr
            ctx.fillRect(Math.max(0, x - W/8), Math.max(0, localY - H*0.08), W/4, H * 0.16)
          }
        })
        // Estrellas
        if (!d.stars) d.stars = Array.from({length:180}, () => ({ x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*1.3, phase:Math.random()*Math.PI*2 }))
        d.stars.forEach((s:any) => {
          ctx.globalAlpha = (0.25 + 0.25 * Math.sin(t * 0.8 + s.phase))
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill()
        })
        ctx.globalAlpha = 1
      },

      // ── GALAXIA: campo estelar con drift + nebulosa pulsante ─────────────
      galaxia: () => {
        const { width: W, height: H } = canvas
        ctx.fillStyle = "#000003"; ctx.fillRect(0, 0, W, H)

        // Nebulosa que se mueve y pulsa
        const nebCenter = [
          { x: W*0.5 + Math.sin(t*0.08)*W*0.12, y: H*0.5 + Math.cos(t*0.06)*H*0.10, r: W*0.55, col: [80,0,160] },
          { x: W*0.25 + Math.sin(t*0.07+1)*W*0.08, y: H*0.3 + Math.cos(t*0.05+1)*H*0.08, r: W*0.3, col: [0,40,120] },
          { x: W*0.8 + Math.sin(t*0.09+2)*W*0.06, y: H*0.7 + Math.cos(t*0.07+2)*H*0.06, r: W*0.25, col: [60,0,100] },
        ]
        nebCenter.forEach(n => {
          const alfa = 0.12 + 0.04 * Math.sin(t * 0.3)
          const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
          gr.addColorStop(0, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},${alfa})`)
          gr.addColorStop(0.5, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},${alfa*0.4})`)
          gr.addColorStop(1, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},0)`)
          ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
        })

        // Estrellas con drift lento
        if (!d.stars) d.stars = Array.from({length:400}, () => ({
          x: Math.random()*W, y: Math.random()*H,
          r: Math.random()*1.6 + 0.2,
          vx: (Math.random()-0.5)*0.08, vy: (Math.random()-0.5)*0.06,
          phase: Math.random()*Math.PI*2, speed: Math.random()*0.5+0.2
        }))
        d.stars.forEach((s:any) => {
          s.x += s.vx; s.y += s.vy
          if (s.x < 0) s.x = W; if (s.x > W) s.x = 0
          if (s.y < 0) s.y = H; if (s.y > H) s.y = 0
          const br = 0.4 + 0.6 * Math.sin(t * s.speed + s.phase)
          ctx.globalAlpha = br * 0.85
          ctx.fillStyle = "#fff"
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill()
        })
        ctx.globalAlpha = 1
      },

      // ── AMANECER: glow desde abajo que pulsa, rayos que se expanden ──────
      amanecer: () => {
        const { width: W, height: H } = canvas
        const pulso = 0.5 + 0.5 * Math.sin(t * 0.3)

        // Cielo oscuro que aclara lentamente
        const sky = ctx.createLinearGradient(0, 0, 0, H)
        sky.addColorStop(0,    "#05030f")
        sky.addColorStop(0.4,  "#150828")
        sky.addColorStop(0.65, `rgba(${80+Math.floor(20*pulso)},${20},${40+Math.floor(15*pulso)},1)`)
        sky.addColorStop(0.82, `rgba(${170+Math.floor(30*pulso)},${50+Math.floor(20*pulso)},10,1)`)
        sky.addColorStop(1,    `rgba(${200+Math.floor(40*pulso)},${80+Math.floor(20*pulso)},0,1)`)
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

        // Glow solar pulsante
        const sunY = H * 0.75
        const gR = W * (0.45 + 0.05 * pulso)
        const sunG = ctx.createRadialGradient(W/2, sunY, 0, W/2, sunY, gR)
        sunG.addColorStop(0,   `rgba(255,${180+Math.floor(40*pulso)},40,${0.35+0.1*pulso})`)
        sunG.addColorStop(0.3, `rgba(255,${100+Math.floor(30*pulso)},0,${0.20+0.07*pulso})`)
        sunG.addColorStop(0.65, "rgba(180,30,0,0.08)")
        sunG.addColorStop(1,   "rgba(0,0,0,0)")
        ctx.fillStyle = sunG; ctx.fillRect(0, 0, W, H)

        // Rayos que se abren y pulsan
        for (let i = 0; i < 12; i++) {
          const ang = -Math.PI/2 + (-0.8 + i*0.145) + Math.sin(t*0.06+i*0.5)*0.04
          const alfaRayo = (0.03 + 0.025*Math.sin(t*0.2+i)) * (1 + 0.3*pulso)
          ctx.save(); ctx.globalAlpha = alfaRayo
          ctx.fillStyle = `rgb(255,${160+i*4},20)`
          ctx.beginPath(); ctx.moveTo(W/2, sunY)
          ctx.lineTo(W/2+Math.cos(ang-0.04)*W*1.3, sunY+Math.sin(ang-0.04)*H*1.3)
          ctx.lineTo(W/2+Math.cos(ang+0.04)*W*1.3, sunY+Math.sin(ang+0.04)*H*1.3)
          ctx.closePath(); ctx.fill(); ctx.restore()
        }

        // Estrellas que se apagan con el amanecer
        if (!d.stars) d.stars = Array.from({length:100}, () => ({ x:Math.random()*W, y:Math.random()*H*0.5, r:Math.random()*0.9, phase:Math.random()*Math.PI*2 }))
        d.stars.forEach((s:any) => {
          ctx.globalAlpha = (0.3-0.1*pulso) * (0.5+0.5*Math.sin(t*0.3+s.phase))
          ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill()
        }); ctx.globalAlpha=1
      },

      // ── OCÉANO: ondas nítidas que se mueven claramente ───────────────────
      oceano: () => {
        const { width: W, height: H } = canvas
        const bg = ctx.createLinearGradient(0, 0, 0, H)
        bg.addColorStop(0, "#000c1a"); bg.addColorStop(0.5, "#002244"); bg.addColorStop(1, "#003d66")
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

        // 7 capas de onda con velocidades distintas — claramente visibles
        const capas = [
          { y:0.22, vel:0.6,  amp:18, espes:25, col:[0,140,200],  alfa:0.12 },
          { y:0.35, vel:0.45, amp:22, espes:28, col:[0,160,220],  alfa:0.14 },
          { y:0.47, vel:0.7,  amp:16, espes:22, col:[20,180,230], alfa:0.12 },
          { y:0.58, vel:0.38, amp:24, espes:30, col:[0,170,210],  alfa:0.16 },
          { y:0.68, vel:0.55, amp:20, espes:26, col:[30,190,240], alfa:0.14 },
          { y:0.78, vel:0.65, amp:15, espes:20, col:[50,200,250], alfa:0.18 },
          { y:0.88, vel:0.42, amp:18, espes:35, col:[80,210,255], alfa:0.20 },
        ]
        capas.forEach(c => {
          const yBase = H * c.y
          const gr = ctx.createLinearGradient(0, yBase-c.espes, 0, yBase+c.espes*2)
          gr.addColorStop(0, `rgba(${c.col[0]},${c.col[1]},${c.col[2]},0)`)
          gr.addColorStop(0.4, `rgba(${c.col[0]},${c.col[1]},${c.col[2]},${c.alfa})`)
          gr.addColorStop(1, `rgba(${c.col[0]},${c.col[1]},${c.col[2]},0)`)
          ctx.fillStyle = gr
          ctx.beginPath(); ctx.moveTo(0, yBase)
          for (let x = 0; x <= W; x += 3) {
            const y = yBase + Math.sin(x*0.007 + t*c.vel) * c.amp
                            + Math.sin(x*0.013 - t*c.vel*0.7) * (c.amp*0.4)
            ctx.lineTo(x, y)
          }
          ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill()
        })

        // Brillo superficial móvil
        const bx = W*(0.3+0.4*Math.sin(t*0.12)), by = H*0.18
        const sg = ctx.createRadialGradient(bx, by, 0, bx, by, W*0.4)
        sg.addColorStop(0, "rgba(100,220,255,0.07)"); sg.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H)
      },

      // ── PAZ: luz blanca suave que asciende, como velas o palomas ─────────
      paz: () => {
        const { width: W, height: H } = canvas
        ctx.fillStyle = "#01020c"; ctx.fillRect(0, 0, W, H)

        // Halo central suave pulsante
        const halo = ctx.createRadialGradient(W/2, H*0.6, 0, W/2, H*0.6, W*0.6)
        halo.addColorStop(0, `rgba(200,190,255,${0.08+0.04*Math.sin(t*0.25)})`)
        halo.addColorStop(0.4, `rgba(120,110,220,${0.04+0.02*Math.sin(t*0.2)})`)
        halo.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H)

        if (!d.particles) d.particles = Array.from({length: 90}, () => ({
          x: W*0.1 + Math.random()*W*0.8,
          y: H + Math.random()*H*0.5,
          vy: -(Math.random()*1.0 + 0.5),
          vx: (Math.random()-0.5)*0.4,
          size: Math.random()*4 + 1.5,
          alfa: Math.random()*0.5 + 0.3,
          phase: Math.random()*Math.PI*2,
          color: Math.random() > 0.4 ? "220,210,255" : "255,250,230"
        }))
        d.particles.forEach((p:any) => {
          p.y += p.vy; p.x += p.vx + Math.sin(t*0.15+p.phase)*0.6
          if (p.y < -20) {
            p.y = H + 20; p.x = W*0.1 + Math.random()*W*0.8
          }
          const fadeY = Math.max(0, Math.min(1, (H - p.y) / (H * 0.7)))
          ctx.globalAlpha = p.alfa * fadeY * (0.6 + 0.4*Math.sin(t*0.4+p.phase))
          ctx.fillStyle = `rgba(${p.color},1)`
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill()
          // Halo suave de cada partícula
          const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size*3)
          pg.addColorStop(0, `rgba(${p.color},0.15)`); pg.addColorStop(1, `rgba(${p.color},0)`)
          ctx.globalAlpha = fadeY * 0.5
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(p.x, p.y, p.size*3, 0, Math.PI*2); ctx.fill()
        })
        ctx.globalAlpha = 1
      },

      // ── LLUVIA DE LUZ: partículas doradas cayendo — claramente visibles ──
      lluvialuz: () => {
        const { width: W, height: H } = canvas
        ctx.fillStyle = "#020310"; ctx.fillRect(0, 0, W, H)

        // Resplandor central suave
        const gr = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W*0.5)
        gr.addColorStop(0, "rgba(80,60,160,0.12)"); gr.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)

        if (!d.particles) d.particles = Array.from({length: 160}, () => ({
          x: Math.random()*W,
          y: Math.random()*H,
          vy: Math.random()*2.0 + 1.0,       // ← velocidad visible
          vx: (Math.random()-0.5)*0.5,
          size: Math.random()*2.5 + 0.8,
          alfa: Math.random()*0.7 + 0.3,
          phase: Math.random()*Math.PI*2,
          color: Math.random() > 0.5 ? [255,210,60] : [180,150,255],
          tail: Math.random()*8 + 4
        }))
        d.particles.forEach((p:any) => {
          p.y += p.vy; p.x += p.vx + Math.sin(t*0.05+p.phase)*0.4
          if (p.y > H + 10) { p.y = -10; p.x = Math.random()*W }

          const [r,g,b] = p.color
          const puls = 0.6 + 0.4*Math.sin(t*0.6+p.phase)
          ctx.globalAlpha = p.alfa * puls
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill()

          // Estela hacia arriba
          const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y - p.tail)
          grad.addColorStop(0, `rgba(${r},${g},${b},${p.alfa*puls*0.6})`)
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.strokeStyle = grad; ctx.lineWidth = p.size * 0.8
          ctx.globalAlpha = p.alfa * puls
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - p.tail); ctx.stroke()
        })
        ctx.globalAlpha = 1
      },
    }

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw)
      if (now - lastFrame < FRAME_MS) return
      lastFrame = now
      t += 0.016 * (60 / TARGET_FPS)  // compensar velocidad animación
      const fn = animaciones[animacion] || animaciones.aurora
      fn()
      ctx.globalAlpha = oscuridad / 100
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize) }
  }, [animacion, oscuridad])

  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:0, width:"100%", height:"100%" }} />
}


// ── Componente principal ──────────────────────────────────────────────────────
export default function ProyectarPage() {
  const [socket, setSocket] = useState<any>(null)
  const [escalaFuente, setEscalaFuente] = useState<number>(() => {
    if (typeof window === "undefined") return 100
    return Number(localStorage.getItem("proyector-escala-fuente") || "100")
  })
  const [familiaFuente, setFamiliaFuente] = useState<string>(() => {
    if (typeof window === "undefined") return "system"
    return localStorage.getItem("proyector-font-family") || "system"
  })
  const [modoLimpio, setModoLimpio] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("proyector-modo-limpio") === "1"
  })

  // ✅ Tamaño de ventana en estado: el cálculo de tamaño de letra usa
  // window.innerWidth/innerHeight, pero sin un listener de resize esos
  // valores quedaban "congelados" desde el primer render — si la ventana
  // del proyector se movía a una segunda pantalla con otra resolución (o
  // se maximizaba/cambiaba de tamaño después), el texto se calculaba para
  // el tamaño viejo y se desbordaba en el nuevo.
  const [winSize, setWinSize] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1920,
    h: typeof window !== "undefined" ? window.innerHeight : 1080,
  }))
  useEffect(() => {
    const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const FUENTES: Record<string, string> = {
    "system":    "system-ui, -apple-system, sans-serif",
    "arial":     "Arial, Helvetica, sans-serif",
    "serif":     "Georgia, 'Times New Roman', serif",
    "rounded":   "'Trebuchet MS', Arial, sans-serif",
    "mono":      "'Courier New', monospace",
    "cinzel":    "'Cinzel', serif",
    "playfair":  "'Playfair Display', serif",
    "raleway":   "'Raleway', sans-serif",
    "lato":      "'Lato', sans-serif",
    "oswald":    "'Oswald', sans-serif",
    "merriw":    "'Merriweather', serif",
    "ptserif":   "'PT Serif', serif",
    "ubuntu":    "'Ubuntu', sans-serif",
  }

  // Cargar Google Fonts dinámicamente
  useEffect(() => {
    if (typeof window === "undefined") return
    const gFonts = ["Cinzel", "Playfair+Display", "Raleway", "Lato", "Oswald", "Merriweather", "PT+Serif", "Ubuntu"]
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = `https://fonts.googleapis.com/css2?${gFonts.map(f=>`family=${f}:wght@400;700;900`).join("&")}&display=swap`
    document.head.appendChild(link)
  }, [])

  const computeFontNum = (minPx: number, vwPct: number, maxPx: number, scale = 1): number => {
    const base = Math.min(maxPx, Math.max(minPx, (vwPct / 100) * winSize.w))
    return Math.round(base * scale)
  }

  const escalaRef = useRef(escalaFuente)
  const cambiarEscalaFuente = (valor: number) => {
    const v = Math.min(200, Math.max(50, valor))
    escalaRef.current = v
    setEscalaFuente(v)
    localStorage.setItem("proyector-escala-fuente", String(v))
  }

  useEffect(() => {
    const handle = () => {
      setEscalaFuente(Number(localStorage.getItem("proyector-escala-fuente") || "100"))
      setFamiliaFuente(localStorage.getItem("proyector-font-family") || "system")
    }
    window.addEventListener("storage", handle)
    return () => window.removeEventListener("storage", handle)
  }, [])

  // Escuchar modo limpio desde control
  useEffect(() => {
    const handle = () => setModoLimpio(localStorage.getItem("proyector-modo-limpio") === "1")
    window.addEventListener("storage", handle)
    return () => window.removeEventListener("storage", handle)
  }, [])

  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [biblia, setBiblia] = useState<any>(null)
  const [imagen, setImagen] = useState<string | null>(null)
  const [tono, setTono] = useState("")
  const [paginaBiblia, setPaginaBiblia] = useState(0)
  const [iglesia, setIglesia] = useState("")
  const [estadoEspecial, setEstadoEspecial] = useState<any>(null)
  const [logoMarcaUrl, setLogoMarcaUrl] = useState("")
  // ✅ Tick de la cuenta regresiva -- el tiempo restante se recalcula solo
  // (segundo a segundo) contra estadoEspecial.hasta, no llega nada nuevo
  // por socket cada segundo. Este estado solo existe para forzar el
  // re-render cada 1s mientras esa pantalla está activa.
  const [tickCuentaRegresiva, setTickCuentaRegresiva] = useState(0)
  useEffect(() => {
    if (estadoEspecial?.tipo !== "cuenta-regresiva") return
    const id = setInterval(() => setTickCuentaRegresiva(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [estadoEspecial?.tipo])
  // ✅ Banner de urgencia: independiente de estadoEspecial/partes/biblia —
  // se dibuja encima de lo que sea que esté en pantalla, sin reemplazarlo.
  const [bannerUrgente, setBannerUrgente] = useState<string | null>(null)

  // ✅ Fondo per-iglesia: la key incluye el iglesiaId una vez que se conoce.
  // Evita que distintas iglesias en el mismo dispositivo compartan el fondo.
  const fondoKeyRef = useRef("proyector-fondo-activo")
  const [fondoCancion, setFondoCancion] = useState<any>(() => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem("proyector-fondo-activo")
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const [cargandoProyector, setCargandoProyector] = useState(true)
  const timeoutCargaProyectorRef = useRef<any>(null)
  const [estadoInicialRevisado, setEstadoInicialRevisado] = useState(false)
  const parteActual = partes[index]
  const [imagenesPrecargadas, setImagenesPrecargadas] = useState<string[]>([])
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayFadingOut, setOverlayFadingOut] = useState(false)
  const overlayTimeoutRef = useRef<any>(null)
  const salaRef = useRef<string | null>(null)

  // ✅ Estado de reconexión degradada
  const [reconectando, setReconectando] = useState(false)

  // ✅ Guardar fondo per-iglesia en localStorage
  useEffect(() => {
    if (fondoCancion) {
      try { localStorage.setItem(fondoKeyRef.current, JSON.stringify(fondoCancion)) } catch {}
    }
  }, [fondoCancion])

  useEffect(() => {
    const entrarFullscreen = () => {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen()
    }
    document.addEventListener("click", entrarFullscreen)
    return () => document.removeEventListener("click", entrarFullscreen)
  }, [])

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyMargin = document.body.style.margin
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    document.body.style.margin = "0"
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.margin = prevBodyMargin
    }
  }, [])

  const ejecutarConTransicion = (accion: () => void) => {
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)
    setOverlayVisible(true)
    setOverlayFadingOut(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        accion()
        overlayTimeoutRef.current = setTimeout(() => {
          setOverlayFadingOut(true)
          overlayTimeoutRef.current = setTimeout(() => {
            setOverlayVisible(false)
            setOverlayFadingOut(false)
          }, 220)
        }, 40)
      })
    })
  }

  // ── Keyboard: un solo handler unificado ──────────────────────────────────
  // FIX: había DOS useEffect de teclado → las flechas emitían socket 2 veces.
  // Unificamos todo aquí. ESC/+/-/0 no dependen del socket, las flechas sí.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case "Escape": window.close(); break
        case " ":
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault(); socket?.emit("control-siguiente"); break
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault(); socket?.emit("control-anterior"); break
        case "+": case "=": cambiarEscalaFuente(escalaFuente + 5); socketRef.current?.emit("zoom-info", { actual: Math.min(280, escalaFuente + 5) }); break
        case "-":            cambiarEscalaFuente(escalaFuente - 5); socketRef.current?.emit("zoom-info", { actual: Math.max(40,  escalaFuente - 5) }); break
        case "0":            cambiarEscalaFuente(100);               socketRef.current?.emit("zoom-info", { actual: 100 }); break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [socket, escalaFuente])

  useEffect(() => {
    let activo = true
    const dev = process.env.NODE_ENV === "development"

    // ✅ Socket se crea inmediatamente — sin esperar getSession
    // El auth token se puede pasar en unirse-sala si se necesita en el futuro
    const s = io(getSocketUrl(), {
      reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000
    })

    s.on("connect", async () => {
      try {
        if (!salaRef.current) {
          salaRef.current = (await getIglesiaId()) || "global"
          const key = `proyector-fondo-activo-${salaRef.current}`
          if (!localStorage.getItem(key) && localStorage.getItem("proyector-fondo-activo")) {
            localStorage.setItem(key, localStorage.getItem("proyector-fondo-activo")!)
          }
          fondoKeyRef.current = key
        }
        if (!activo) return
        const sala = salaRef.current
        if (dev) console.log("🖥️ PROYECTOR conectado:", sala)
        setCargandoProyector(true)
        setEstadoInicialRevisado(false)
        s.emit("unirse-sala", { sala, pantalla: "proyectar" })
        setTimeout(() => s.emit("get-estado"), 150)
        if (timeoutCargaProyectorRef.current) clearTimeout(timeoutCargaProyectorRef.current)
        timeoutCargaProyectorRef.current = setTimeout(() => {
          if (!activo) return
          setEstadoInicialRevisado(true)
          setCargandoProyector(false)
        }, 1800)
      } catch (err) {
        if (dev) console.error("❌ Error en connect proyector:", err)
      }
    })

    s.on("estado-actual", (estado: any) => {
      setEstadoInicialRevisado(true)
      setCargandoProyector(false)
      if (timeoutCargaProyectorRef.current) clearTimeout(timeoutCargaProyectorRef.current)

      if (estado.tipo === "cancion") {
        const d = estado.data || {}
        setEstadoEspecial(null); setBiblia(null); setImagen(null)
        if (d.fondo?.url) precargarImagen(d.fondo.url)
        if (d.fondo) setFondoCancion(d.fondo)
        setPartes(d.partes || []); setIndex(d.index || 0)
        setTitulo(d.titulo || ""); setTono(d.tono || "")
        setIglesia(d.iglesia || ""); setLogoMarcaUrl(d.logo_marca_url || "")
        setPaginaBiblia(0); return
      }
      if (estado.tipo === "imagen") {
        const d = estado.data || {}
        limpiarPantalla(true) // preservar fondo
        if (d?.url) precargarImagen(d.url)
        setImagen(d.url); setIglesia(d.iglesia || ""); return
      }
      if (estado.tipo === "biblia") {
        const d = estado.data || {}
        limpiarPantalla(true) // preservar fondo
        if (d.fondo) setFondoCancion(d.fondo)
        setBiblia(d); setIglesia(d.iglesia || ""); setPaginaBiblia(d.pagina || 0)
        setLogoMarcaUrl(d.logo_marca_url || ""); return
      }
      if (estado.tipo === "estado") {
        // ✅ mantenerFondo=true: preservar fondoCancion al restaurar estado especial
        limpiarPantalla(true)
        const d = estado.data || {}
        if (d.fondo !== undefined) setFondoCancion(d.fondo || null)
        setEstadoEspecial(d); return
      }
    })

    s.on("cargar-cancion", (data: any) => {
      setEstadoInicialRevisado(true)
      setCargandoProyector(false)
      ejecutarConTransicion(() => {
        setEstadoEspecial(null); setBiblia(null); setImagen(null)
        if (data.fondo?.url) precargarImagen(data.fondo.url)
        if (data.fondo) setFondoCancion(data.fondo)
        setPartes(data.partes || []); setIndex(data.index || 0)
        setTitulo(data.titulo || ""); setTono(data.tono || "")
        setIglesia(data.iglesia || ""); setLogoMarcaUrl(data.logo_marca_url || "")
        setPaginaBiblia(0)
      })
    })

    s.on("mostrar-imagen", (data: any) => {
      setEstadoInicialRevisado(true)
      setCargandoProyector(false)
      ejecutarConTransicion(() => {
        // Preservar fondo: solo limpiar partes/titulo/biblia
        setEstadoEspecial(null); setBiblia(null)
        setPartes([]); setTitulo(""); setTono(""); setIndex(0); setPaginaBiblia(0)
        if (data?.url) precargarImagen(data.url)
        setImagen(data.url); setIglesia(data.iglesia || "")
      })
    })

    s.on("mostrar-biblia", (data: any) => {
      setEstadoInicialRevisado(true)
      setCargandoProyector(false)
      ejecutarConTransicion(() => {
        // ✅ Preservar fondo: no llamar limpiarPantalla() que lo borra
        setEstadoEspecial(null); setImagen(null)
        setPartes([]); setTitulo(""); setTono(""); setIndex(0); setPaginaBiblia(0)
        // Si el control envió fondo, usarlo (y guardarlo en localStorage)
        if (data.fondo) setFondoCancion(data.fondo)
        setBiblia(data); setIglesia(data.iglesia || "")
        setLogoMarcaUrl(data.logo_marca_url || ""); setPaginaBiblia(data.pagina || 0)
      })
    })

    s.on("cambiar-parte", (i: number) => {
      ejecutarConTransicion(() => { setEstadoEspecial(null); setIndex(i) })
    })
    s.on("cambiar-pagina-biblia", (pagina: number) => {
      ejecutarConTransicion(() => { setEstadoEspecial(null); setPaginaBiblia(pagina) })
    })
    s.on("precargar-imagenes", (urls: string[]) => {
      ;(urls || []).forEach(url => { if (url) precargarImagen(url) })
    })

    // ✅ Reconexión degradada: mostrar indicador + re-pedir estado al reconectar
    s.on("disconnect", () => { if (activo) setReconectando(true) })
    s.on("connect_error", () => { if (activo) setReconectando(true) })
    s.on("reconnect", () => {
      if (!activo) return
      setReconectando(false)
      setTimeout(() => s.emit("get-estado"), 200)
    })

    // ✅ Fondo en tiempo real — sin necesidad de reproyectar la canción
    s.on("cambiar-fondo", (fondo: any) => {
      if (activo) setFondoCancion(fondo || null)
    })

    // ✅ Zoom remoto desde el control
    s.on("ajustar-zoom", ({ valor }: { valor: number }) => {
      console.log("🔍 ZOOM recibido:", valor)
      if (!activo) return
      const v = Math.min(200, Math.max(50, valor))
      escalaRef.current = v
      setEscalaFuente(v)
      localStorage.setItem("proyector-escala-fuente", String(v))
    })

    s.on("mostrar-banner-urgente", (texto: string) => setBannerUrgente(texto))
    s.on("ocultar-banner-urgente", () => setBannerUrgente(null))
    // ✅ Modo limpio por socket -- funciona aunque Control y Proyector estén
    // en dispositivos distintos (antes solo dependía de localStorage local).
    s.on("modo-limpio", (activo: boolean) => setModoLimpio(!!activo))

    s.on("mostrar-estado", (data: any) => {
      setEstadoInicialRevisado(true)
      setCargandoProyector(false)
      ejecutarConTransicion(() => {
        if (data?.tipo === "descanso") {
          // Descanso: preservar partes/biblia no; sí el fondo y el estado
          setEstadoEspecial(data); setPartes([]); setBiblia(null); setImagen(null)
          if (data.fondo !== undefined) setFondoCancion(data.fondo || null)
        } else {
          // Espera / mensaje / logo / negro:
          // ✅ mantenerFondo=true para no borrar el fondo mientras actualizamos
          limpiarPantalla(true)
          setEstadoEspecial(data)
          // ✅ Actualizar fondoCancion con el fondo que envió el control
          if (data.fondo !== undefined) setFondoCancion(data.fondo || null)
        }
      })
    })

    setSocket(s)
    socketRef.current = s

    return () => {
      activo = false
      if (timeoutCargaProyectorRef.current) clearTimeout(timeoutCargaProyectorRef.current)
      s.disconnect()
    }
  }, [])

  const limpiarPantalla = (mantenerFondo = false) => {
    setEstadoEspecial(null); setBiblia(null); setImagen(null)
    if (!mantenerFondo) setFondoCancion(null)
    setPartes([]); setTitulo(""); setTono(""); setIglesia("")
    setIndex(0); setPaginaBiblia(0)
  }

  const esAcordeProyeccion = (token: string) =>
    /^(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)(#|b)?(m|maj|min|sus|dim|aug)?\d*(\/(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)(#|b)?)?$/i.test(token.trim())

  const detectarFormatoProyeccion = (texto: string) => {
    const lineas = (texto || "").split(/\r?\n/)
    const resultado: { tipo: "solo"|"linea"|"corchete"; letra: string }[] = []
    for (let i = 0; i < lineas.length; i++) {
      const actual = lineas[i], siguiente = lineas[i + 1]
      if (actual.includes("[")) { resultado.push({ tipo:"corchete", letra:actual.replace(/\[(.*?)\]/g,"").trim() }); continue }
      if (actual.trim() && actual.trim().split(/\s+/).every(esAcordeProyeccion) && siguiente) {
        resultado.push({ tipo:"linea", letra:siguiente.trim() }); i++; continue
      }
      resultado.push({ tipo:"solo", letra:actual.trim() })
    }
    return resultado
  }

  const limpiarHTML = (texto: string) =>
    (texto||"").replace(/<font[^>]*>\s*Por:[\s\S]*?<\/font>/gi,"").replace(/<font[^>]*>\s*Autor:[\s\S]*?<\/font>/gi,"")
      .replace(/<font[^>]*>\s*Iglesia:[\s\S]*?<\/font>/gi,"").replace(/<[^>]+>/g,"")
      .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
      .replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")

  const limpiarCancionParaProyector = (texto: string) =>
    detectarFormatoProyeccion(limpiarHTML(texto))
      .map(b => limpiarHTML(b.letra||"").replace(/\/n/g," ").replace(/\\n/g," ").replace(/\s+/g," ").trim())
      .filter(Boolean).join("\n")

  const limpiarTextoProyeccion = (texto: string) =>
    limpiarHTML(texto).replace(/\[(.*?)\]/g,"").replace(/\/n/g," ").replace(/\\n/g," ")
      .replace(/\r?\n|\r/g," ").replace(/\s+/g," ").trim()

  const textoBibliaActual = limpiarTextoProyeccion(biblia?.paginas?.[paginaBiblia] || biblia?.texto || "")
  const palabrasBiblia = textoBibliaActual.split(/\s+/).filter(Boolean)
  const largoBiblia = textoBibliaActual.length
  const totalPalabrasBiblia = palabrasBiblia.length

  const escala = Math.min(3.0, Math.max(0.4, escalaFuente / 100))

  // ── Font size BIBLIA ──────────────────────────────────────────────────────
  const tierBiblia =
    largoBiblia > 1800 || totalPalabrasBiblia > 300 ? computeFontNum(13,1.4,22,escala)
    : largoBiblia > 1300 || totalPalabrasBiblia > 220 ? computeFontNum(15,1.7,26,escala)
    : largoBiblia > 900  || totalPalabrasBiblia > 150 ? computeFontNum(18,2.0,32,escala)
    : largoBiblia > 550  || totalPalabrasBiblia > 90  ? computeFontNum(20,2.4,38,escala)
    : largoBiblia > 260  || totalPalabrasBiblia > 45  ? computeFontNum(24,2.8,44,escala)
    : computeFontNum(28,3.2,52,escala)

  const lhBiblia =
    largoBiblia > 1300 || totalPalabrasBiblia > 220 ? 1.22
    : largoBiblia > 700 || totalPalabrasBiblia > 120 ? 1.28 : 1.34

  const altB  = winSize.h * 0.66
  const ancB  = winSize.w * 0.88
  const capB  = largoBiblia > 0 ? Math.floor(Math.sqrt(altB * ancB / (lhBiblia * 0.58 * largoBiblia))) : tierBiblia
  const fsBiblia = `${Math.min(tierBiblia, Math.max(12, capB))}px`

  // ── Font size CANCIÓN ─────────────────────────────────────────────────────
  const textoCancion = limpiarCancionParaProyector(parteActual?.texto_letra || parteActual?.texto || "")
  const lineasCancion = textoCancion.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  const CHARS_VIS = 30
  const lineasVis = lineasCancion.reduce((t, l) => t + Math.max(1, Math.ceil(l.length / CHARS_VIS)), 0)
  const lhCancion = lineasVis >= 12 ? 1.0 : lineasVis >= 9 ? 1.04 : lineasVis >= 6 ? 1.08 : 1.12

  const tierCancion =
    lineasVis >= 16 ? computeFontNum(12,1.3,20,escala)
    : lineasVis >= 14 ? computeFontNum(14,1.5,24,escala)
    : lineasVis >= 12 ? computeFontNum(16,1.7,27,escala)
    : lineasVis >= 10 ? computeFontNum(18,2.0,32,escala)
    : lineasVis >= 8  ? computeFontNum(22,2.5,38,escala)
    : lineasVis >= 6  ? computeFontNum(28,3.2,50,escala)
    : lineasVis >= 4  ? computeFontNum(34,4.0,64,escala)
    :                   computeFontNum(42,5.0,80,escala)

  const altC   = winSize.h * (modoLimpio ? 0.94 : 0.66)
  const screenW = winSize.w * 0.88

  // ✅ Binary search: máximo font que cabe verticalmente considerando wrap real
  // Monotónico: a mayor zoom, el resultado solo puede subir o quedarse igual
  const capParaFs = (fs: number): number => {
    const cpp        = Math.max(1, Math.floor(screenW / (fs * 0.58)))
    const totalLines = lineasCancion.reduce((s, l) => s + Math.max(1, Math.ceil(l.length / cpp)), 0)
    const lh         = totalLines >= 12 ? 1.0 : totalLines >= 9 ? 1.04 : totalLines >= 6 ? 1.08 : 1.12
    return Math.floor(altC / (totalLines * lh))
  }

  let lo = 10, hi = Math.min(tierCancion, 280)
  while (hi > lo + 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (mid <= capParaFs(mid)) lo = mid
    else hi = mid
  }
  const fsCancion = `${lo}px`

  const zoomMaxParte = lineasVis >= 16 ? 60 : lineasVis >= 12 ? 80 : lineasVis >= 8 ? 100 : lineasVis >= 6 ? 130 : lineasVis >= 4 ? 160 : 200
  const socketRef = useRef<any>(null)

  const etiquetaParte = (() => {
    if (!parteActual?.tipo) return ""
    if (parteActual.tipo === "Verso") {
      let n = 0; for (let i = 0; i <= index; i++) if (partes[i]?.tipo === "Verso") n++
      return `Verso ${n}`
    }
    return parteActual.tipo === "Coro" ? "Coro" : parteActual.tipo === "Puente" ? "Puente" : parteActual.tipo
  })()

  const precargarImagen = (url: string) => {
    if (!url || imagenesPrecargadas.includes(url)) return
    if (imagenesPrecargadas.length >= 50) return  // ✅ evita crecimiento ilimitado
    const img = new Image(); img.src = url
    img.onload = () => setImagenesPrecargadas(p =>
      p.includes(url) ? p : p.length >= 50 ? p : [...p, url]
    )
  }

  const hayContenido = !!estadoEspecial || !!imagen || !!biblia || partes.length > 0 || !!titulo

  // ── Pantalla de carga ─────────────────────────────────────────────────────
  if (cargandoProyector) return (
    <div style={{ width:"100vw",height:"100vh",background:"linear-gradient(180deg,#020617 0%,#0f172a 100%)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",position:"fixed",inset:0 }}>
      <div style={{ textAlign:"center",padding:"32px",borderRadius:"24px",background:"rgba(15,23,42,0.82)",border:"1px solid rgba(255,255,255,0.10)",minWidth:"320px" }}>
        <div style={{ width:"64px",height:"64px",borderRadius:"999px",border:"4px solid rgba(255,255,255,0.15)",borderTopColor:"#38bdf8",margin:"0 auto 20px auto",animation:"spin .9s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize:"clamp(28px,3vw,48px)",fontWeight:800,marginBottom:10 }}>Proyector</div>
        <div style={{ fontSize:"clamp(16px,1.6vw,24px)",opacity:.72 }}>Preparando proyección...</div>
      </div>
    </div>
  )

  // ── Sin contenido ─────────────────────────────────────────────────────────
  if (estadoInicialRevisado && !hayContenido) return (
    <div style={{ width:"100vw",height:"100vh",background:"radial-gradient(circle at 50% 25%,rgba(37,99,235,.28),transparent 35%),linear-gradient(180deg,#020617 0%,#0f172a 100%)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",position:"fixed",inset:0,textAlign:"center",padding:"5vw",boxSizing:"border-box" }}>
      <div>
        <div style={{ fontSize:"clamp(34px,5vw,82px)",fontWeight:900,marginBottom:14 }}>Cancionero Cristiano</div>
        <div style={{ fontSize:"clamp(18px,2vw,32px)",opacity:.72 }}>Esperando proyección...</div>
      </div>
    </div>
  )

  // ── Render principal ──────────────────────────────────────────────────────
  // Estructura original de v4: un div raíz 100vh con fondos fixed y contenido en flujo normal
  const fondoCss = fondoCancion?.tipo === "preset"
  const fondoImg = fondoCancion && fondoCancion.tipo !== "preset" && fondoCancion.tipo !== "animated" && fondoCancion.tipo !== "video" && fondoCancion.url
  const fondoAnimado = fondoCancion?.tipo === "animated"
  const fondoVideo = fondoCancion?.tipo === "video"

  // ✅ Fondo compartido para las pantallas especiales (negro/descanso, espera,
  // mensaje, logo) — antes cada bloque duplicaba a mano fondoCss/fondoImg y
  // se olvidaba de fondoAnimado (Canvas) y fondoVideo, por lo que un fondo
  // animado o de video elegido en Herramientas nunca se veía en esas pantallas.
  const renderFondoEspecial = (fallback: string) => (<>
    {fondoCss && (<>
      <div style={{ position:"fixed",inset:0,backgroundImage:fondoCancion.fondoCss,backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",zIndex:0 }} />
      <div style={{ position:"fixed",inset:0,backgroundColor:`rgba(0,0,0,${(fondoCancion.oscuridad??55)/100})`,zIndex:1 }} />
    </>)}
    {fondoImg && (<>
      <div style={{ position:"fixed",inset:0,backgroundImage:`url(${fondoCancion.url})`,backgroundSize:fondoCancion.ajuste||"cover",backgroundPosition:"center",backgroundColor:"#000",zIndex:0 }} />
      <div style={{ position:"fixed",inset:0,backgroundColor:`rgba(0,0,0,${(fondoCancion.oscuridad??55)/100})`,zIndex:1 }} />
    </>)}
    {fondoAnimado && fondoCancion.animacion && (
      <CanvasFondo animacion={fondoCancion.animacion} oscuridad={fondoCancion.oscuridad ?? 30} />
    )}
    {fondoVideo && fondoCancion.url && (<>
      <video autoPlay loop muted playsInline style={{ position:"fixed",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0 }} src={fondoCancion.url} />
      <div style={{ position:"fixed",inset:0,backgroundColor:`rgba(0,0,0,${(fondoCancion.oscuridad??50)/100})`,zIndex:1 }} />
    </>)}
    {!fondoCancion && <div style={{ position:"fixed",inset:0,background:fallback,zIndex:0 }} />}
  </>)

  return (
    <div style={{ width:"100vw",height:"100vh",overflow:"hidden",background:"#000",color:"white",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"fixed",inset:0,padding:0,margin:0 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} @keyframes fmov{0%{transform:scale(1.04) translate3d(0,0,0)}50%{transform:scale(1.12) translate3d(-1.8%,-1.2%,0)}100%{transform:scale(1.04) translate3d(0,0,0)}}`}</style>

      {/* ✅ Indicador de reconexión degradada */}
      {reconectando && (
        <div style={{ position:"fixed", top:12, left:"50%", transform:"translateX(-50%)", zIndex:999, background:"rgba(239,68,68,0.9)", color:"white", padding:"6px 16px", borderRadius:20, fontSize:13, fontWeight:700, backdropFilter:"blur(8px)", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"white", animation:"pulse .8s ease-in-out infinite" }} />
          Reconectando al servidor...
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
        </div>
      )}

      {/* ── Fondos ────────────────────────────────────────────── */}
      {!estadoEspecial && fondoCss && (<>
        <div style={{ position:"fixed",inset:0,backgroundImage:fondoCancion.fondoCss,backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",zIndex:0 }} />
        <div style={{ position:"fixed",inset:0,backgroundColor:`rgba(0,0,0,${(fondoCancion.oscuridad??55)/100})`,zIndex:1 }} />
      </>)}
      {!estadoEspecial && fondoImg && (<>
        <div style={{ position:"fixed",inset:0,backgroundImage:`url(${fondoCancion.url})`,backgroundSize:fondoCancion.ajuste||"cover",backgroundPosition:"center",backgroundColor:"#000",transform:fondoCancion.tipo==="movimiento"?"scale(1.04)":"none",animation:fondoCancion.tipo==="movimiento"?"fmov 45s ease-in-out infinite":"none",zIndex:0 }} />
        <div style={{ position:"fixed",inset:0,backgroundColor:`rgba(0,0,0,${(fondoCancion.oscuridad??55)/100})`,zIndex:1 }} />
      </>)}
      {/* ✅ Fondo animado Canvas — alta calidad */}
      {!estadoEspecial && fondoAnimado && fondoCancion.animacion && (
        <CanvasFondo animacion={fondoCancion.animacion} oscuridad={fondoCancion.oscuridad ?? 30} />
      )}
      {/* ✅ Fondo video */}
      {!estadoEspecial && fondoVideo && fondoCancion.url && (<>
        <video autoPlay loop muted playsInline style={{ position:"fixed",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0 }} src={fondoCancion.url} />
        <div style={{ position:"fixed",inset:0,backgroundColor:`rgba(0,0,0,${(fondoCancion.oscuridad??50)/100})`,zIndex:1 }} />
      </>)}

      {/* ── Negro ─────────────────────────────────────────────── */}
      {/* ── NEGRO: solo muestra el fondo sin contenido ─────────── */}
      {/* No necesita render propio — estadoEspecial !== null oculta el texto */}
      {/* y el fondoCss (background) se ve naturalmente */}

      {/* ── Descanso ──────────────────────────────────────────── */}
      {estadoEspecial?.tipo === "descanso" && (<>
        {renderFondoEspecial("radial-gradient(circle at 50% 30%,rgba(10,20,50,.9),#000)")}
        {estadoEspecial.logo_marca_url && (
          <div style={{ position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,flexDirection:"column",gap:24 }}>
            <img src={estadoEspecial.logo_marca_url} alt="" style={{ maxWidth:"30vw",maxHeight:"30vh",objectFit:"contain",opacity:.7 }} />
            {estadoEspecial.iglesia && <div style={{ fontSize:"clamp(16px,2vw,28px)",opacity:.4,fontWeight:600 }}>{estadoEspecial.iglesia}</div>}
          </div>
        )}
      </>)}

      {/* ── Espera ────────────────────────────────────────────── */}
      {estadoEspecial?.tipo === "espera" && (<>
        {renderFondoEspecial("radial-gradient(circle at 50% 30%,rgba(37,99,235,.22),transparent 38%),linear-gradient(180deg,#020617 0%,#000 100%)")}
        <div style={{ width:"100vw",height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"5vh 6vw",boxSizing:"border-box",gap:18,position:"relative",zIndex:2 }}>
          <div style={{ fontSize:(estadoEspecial.titulo||"").length>70?"clamp(34px,4vw,64px)":"clamp(48px,6vw,104px)",fontWeight:900,lineHeight:1.05,maxWidth:"90vw" }}>{estadoEspecial.titulo||"Espere un momento"}</div>
          {!!estadoEspecial.subtitulo && <div style={{ fontSize:"clamp(18px,2vw,32px)",opacity:.68,fontWeight:600,maxWidth:"80vw" }}>{estadoEspecial.subtitulo}</div>}
        </div>
      </>)}

      {/* ── Imagen ────────────────────────────────────────────── */}
      {!estadoEspecial && imagen && (
        <div style={{ width:"100vw",height:"100vh",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:2 }}>
          <img src={imagen} alt="" style={{ width:"100vw",height:"100vh",objectFit:"contain",display:"block" }} />
        </div>
      )}

      {/* ── BIBLIA ────────────────────────────────────────────── */}
      {!estadoEspecial && !imagen && biblia && (
        <div style={{ width:"100vw",height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",position:"relative",zIndex:2 }}>

          {/* Cabecera: referencia bíblica */}
          <div style={{ padding:"3vh 5vw 1vh",textAlign:"center" }}>
            <div style={{ fontSize:"clamp(16px,1.8vw,30px)",fontWeight:800,opacity:.85,letterSpacing:".08em",textTransform:"uppercase" }} title={biblia.referencia}>
              {biblia.referencia}
            </div>
          </div>

          {/* Texto central */}
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5vw",textAlign:"center" }}>
            <div style={{ maxWidth:"88vw",fontSize:fsBiblia,lineHeight:lhBiblia,wordBreak:"break-word",overflowWrap:"anywhere" }}>
              {textoBibliaActual}
            </div>
          </div>

          {/* Pie de página: nombre iglesia */}
          {iglesia && (
            <div style={{ padding:"1vh 5vw 3vh",textAlign:"center" }}>
              <div style={{ fontSize:"clamp(12px,1.3vw,20px)",opacity:.55,fontWeight:600 }}>{iglesia}</div>
            </div>
          )}
        </div>
      )}

      {/* ── CANCIÓN ───────────────────────────────────────────── */}
      {!estadoEspecial && !imagen && !biblia && (
        <div style={{ width:"100vw",height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap: modoLimpio ? 0 : "2vh",padding: modoLimpio ? "1vh 2vw" : "3vh 4vw",boxSizing:"border-box",textAlign:"center",position:"relative",zIndex:2 }}>
          {/* ✅ En modo limpio no reservar espacio para el título/píldoras
              aunque estén ocultos -- antes minHeight:78 seguía "robando"
              esa franja aunque no hubiera nada dentro, y el cálculo de
              tamaño de letra (altC) asumía que tenía toda esa altura
              disponible, cortando el texto abajo. */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,minHeight: modoLimpio ? 0 : 78,paddingTop:".5vh",maxWidth:"92vw" }}>
            {titulo && !modoLimpio && <div style={{ fontSize:"clamp(18px,2.2vw,36px)",opacity:.92,fontWeight:800,letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap",maxWidth:"92vw",overflow:"hidden",textOverflow:"ellipsis" }} title={titulo}>{titulo}</div>}

            {/* Indicador de partes — reemplaza el badge "Verso X" en el header.
                La píldora activa muestra el nombre; los inactivos son puntos sutiles. */}
            {partes.length > 0 && !modoLimpio && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"clamp(4px,0.5vw,8px)" }}>
                {partes.map((p, i) => {
                  const activo = i === index
                  // Calcular nombre de la parte activa (mismo criterio que etiquetaParte)
                  let label = ""
                  if (activo) {
                    if (p?.tipo === "Verso") {
                      let n = 0
                      for (let j = 0; j <= i; j++) if (partes[j]?.tipo === "Verso") n++
                      label = `Verso ${n}`
                    } else {
                      label = p?.tipo || `Parte ${i + 1}`
                    }
                  }
                  return (
                    <div
                      key={i}
                      style={{
                        height: "clamp(10px,1.2vw,20px)",
                        minWidth: activo ? "auto" : "clamp(10px,1.2vw,20px)",
                        padding: activo ? "clamp(4px,0.5vw,8px) clamp(14px,1.6vw,26px)" : "0",
                        borderRadius: "999px",
                        background: activo ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.18)",
                        border: activo ? "1px solid rgba(255,255,255,0.2)" : "none",
                        transition: "all 0.38s cubic-bezier(.4,0,.2,1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {activo && label && (
                        <span style={{
                          fontSize: "clamp(13px,1.3vw,20px)",
                          fontWeight: 700,
                          color: "white",
                          opacity: 0.75,
                          letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                        }}>{label}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ flex:1,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",padding:"0 2vw" }}>
            <div style={{ maxWidth:"92vw", maxHeight: modoLimpio ? "96vh" : "68vh", overflow:"hidden", fontFamily:FUENTES[familiaFuente]||FUENTES["system"], fontSize:fsCancion, lineHeight:lhCancion, wordBreak:"break-word", overflowWrap:"anywhere", whiteSpace:"pre-line", textAlign:"center" }}>
              {textoCancion}
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,minHeight: modoLimpio ? 0 : 42,justifyContent:"center" }}>
            {tono    && !modoLimpio && <div style={{ fontSize:"clamp(13px,1.25vw,20px)",opacity:.48,fontWeight:600 }}>Tono: {tono}</div>}
            {iglesia && !modoLimpio && <div style={{ fontSize:"clamp(12px,1.1vw,18px)",opacity:.38 }}>{iglesia}</div>}
          </div>
        </div>
      )}

      {/* ── Mensaje ───────────────────────────────────────────── */}
      {estadoEspecial?.tipo === "mensaje" && (<>
        {renderFondoEspecial("radial-gradient(circle at 50% 35%,rgba(34,197,94,.18),transparent 38%),linear-gradient(180deg,#020617 0%,#000 100%)")}
        <div style={{ width:"100vw",height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"5vh 6vw",boxSizing:"border-box",gap:20,position:"relative",zIndex:2 }}>
          <div style={{ fontSize:(estadoEspecial.titulo||"").length>220?"clamp(18px,2vw,32px)":(estadoEspecial.titulo||"").length>140?"clamp(28px,3.2vw,52px)":(estadoEspecial.titulo||"").length>70?"clamp(38px,4.5vw,74px)":"clamp(54px,6.5vw,112px)",fontWeight:900,lineHeight:1.08,wordBreak:"break-word",whiteSpace:"pre-line",maxWidth:"90vw" }}>
            {estadoEspecial.titulo}
          </div>
          {!!estadoEspecial.subtitulo && <div style={{ fontSize:"clamp(17px,1.8vw,30px)",opacity:.62,fontWeight:600,maxWidth:"80vw" }}>{estadoEspecial.subtitulo}</div>}
        </div>
      </>)}

      {/* ── Logo ──────────────────────────────────────────────── */}
      {estadoEspecial?.tipo === "logo" && (<>
        {renderFondoEspecial("radial-gradient(circle at 50% 35%,rgba(255,255,255,.08),transparent 36%),linear-gradient(180deg,#020617 0%,#000 100%)")}
        <div style={{ width:"100vw",height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"5vh 6vw",boxSizing:"border-box",gap:28,position:"relative",zIndex:2 }}>
          <img src={estadoEspecial.url} alt="" style={{ 
            maxWidth:"45vw", maxHeight:"45vh",
            objectFit:"contain",
            filter:"drop-shadow(0 12px 40px rgba(0,0,0,.7))"
          }} />
          {!!estadoEspecial.titulo && <div style={{ fontSize:"clamp(28px,3.2vw,56px)",fontWeight:900,lineHeight:1.08,maxWidth:"90vw" }}>{estadoEspecial.titulo}</div>}
          {!!estadoEspecial.subtitulo && <div style={{ fontSize:"clamp(18px,2vw,32px)",opacity:.65,fontWeight:600 }}>{estadoEspecial.subtitulo}</div>}
        </div>
      </>)}

      {/* ── Cuenta regresiva ──────────────────────────────────── */}
      {estadoEspecial?.tipo === "cuenta-regresiva" && (<>
        {renderFondoEspecial("radial-gradient(circle at 50% 30%,rgba(99,102,241,.22),transparent 38%),linear-gradient(180deg,#020617 0%,#000 100%)")}
        <div style={{ width:"100vw",height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"5vh 6vw",boxSizing:"border-box",gap:20,position:"relative",zIndex:2 }}>
          {(() => {
            const restanteMs = Math.max(0, new Date(estadoEspecial.hasta).getTime() - Date.now())
            const totalSeg = Math.floor(restanteMs / 1000)
            const h = Math.floor(totalSeg / 3600)
            const m = Math.floor((totalSeg % 3600) / 60)
            const s = totalSeg % 60
            const pad = (n: number) => String(n).padStart(2, "0")
            const texto = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
            return (
              <div style={{
                fontSize: totalSeg > 0 ? "clamp(80px,16vw,260px)" : "clamp(40px,7vw,110px)",
                fontWeight:900,lineHeight:1,fontVariantNumeric:"tabular-nums",
                maxWidth:"88vw",overflowWrap:"break-word"
              }}>
                {totalSeg > 0 ? texto : "¡Comenzamos!"}
              </div>
            )
          })()}
          {!!estadoEspecial.mensaje && <div style={{ fontSize:"clamp(20px,2.4vw,38px)",opacity:.75,fontWeight:600,maxWidth:"85vw" }}>{estadoEspecial.mensaje}</div>}
        </div>
      </>)}

      {/* ── Logo marca agua ───────────────────────────────────── */}
      {logoMarcaUrl && !estadoEspecial && !imagen && !modoLimpio && (
        <div style={{ position:"fixed",bottom:18,right:18,width:68,height:68,borderRadius:999,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",zIndex:30 }}>
          <img src={logoMarcaUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",borderRadius:999 }} />
        </div>
      )}

      {/* ── Botón cerrar ──────────────────────────────────────── */}
      <div onClick={() => window.close()} title="ESC" style={{ position:"fixed",top:12,right:12,width:36,height:36,borderRadius:8,zIndex:9998,background:"rgba(239,68,68,0)",color:"rgba(255,255,255,0)",border:"1px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,fontWeight:800,transition:"all .25s" }}
        onMouseEnter={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.background="rgba(239,68,68,.85)"; el.style.color="white" }}
        onMouseLeave={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.background="rgba(239,68,68,0)"; el.style.color="rgba(255,255,255,0)" }}
      >✕</div>

      {/* ── Overlay transición ────────────────────────────────── */}
      {overlayVisible && <div style={{ position:"fixed",inset:0,background:"#000",pointerEvents:"none",opacity:overlayFadingOut?0:1,transition:overlayFadingOut?"opacity 220ms ease-in-out":"none",zIndex:9999 }} />}

      {/* ── Banner de urgencia — encima de todo, sin tapar lo demás ────── */}
      {bannerUrgente && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          zIndex: 10000, pointerEvents: "none",
          display: "flex", justifyContent: "center",
          padding: "0 0 3vh 0"
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "rgba(185,28,28,0.95)", color: "white",
            padding: "16px 32px", borderRadius: 14,
            boxShadow: "0 10px 40px rgba(0,0,0,.5)",
            maxWidth: "88vw", fontWeight: 800,
            fontSize: "clamp(16px,2.2vw,30px)",
            animation: "pulseBannerUrgente 1.4s ease-in-out infinite"
          }}>
            <span style={{ fontSize: "1.3em", flexShrink: 0 }}>🚨</span>
            <span style={{ wordBreak: "break-word" }}>{bannerUrgente}</span>
          </div>
          <style>{`@keyframes pulseBannerUrgente { 0%,100% { transform: scale(1) } 50% { transform: scale(1.03) } }`}</style>
        </div>
      )}
    </div>
  )
}
