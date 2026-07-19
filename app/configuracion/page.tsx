"use client"

import { CSSProperties, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { navegarSPA } from "@/lib/navegar"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"
import { buscarServidorEnRed } from "@/lib/servidor"
import { useConfirm } from "@/components/useConfirm"

// ── Estilos compartidos ──────────────────────────────────────────────────────
const cardStyle: CSSProperties = {
  background: "rgba(15,23,42,0.94)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "24px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.30)",
  padding: "20px 24px",
  marginBottom: 16
}

// ── Componente de log de errores ─────────────────────────────────────────────
function ErrorLog({ iglesiaId }: { iglesiaId: string }) {
  const { confirmar, ConfirmUI } = useConfirm()
  const [errores, setErrores] = useState<any[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState("")

  const cargar = async () => {
    setCargando(true)
    let q = supabase
      .from("errores_log")
      .select("id, tipo, mensaje, pagina, plataforma, version, creado_en, detalle")
      .eq("iglesia_id", iglesiaId)
      .order("creado_en", { ascending: false })
      .limit(50)
    if (filtroTipo) q = q.eq("tipo", filtroTipo)
    const { data } = await q
    setErrores(data || [])
    setCargando(false)
  }

  useEffect(() => { if (abierto) cargar() }, [abierto, filtroTipo])

  const borrarTodos = async () => {
    if (!(await confirmar("¿Borrar todos los errores registrados?", { textoOk: "Borrar", peligro: true }))) return
    await supabase.from("errores_log").delete().eq("iglesia_id", iglesiaId)
    setErrores([])
  }

  const colorTipo: Record<string, string> = {
    socket: "#f59e0b", supabase: "#ef4444", proyeccion: "#a855f7",
    biblia: "#3b82f6", imagen: "#14b8a6", ppt: "#f97316",
    audio: "#22c55e", autenticacion: "#ec4899", general: "rgba(255,255,255,0.3)"
  }

  return (
    <div style={cardStyle}>
      {ConfirmUI}
      <div onClick={() => setAbierto(v => !v)} style={{ cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: abierto ? 14 : 0 }}>
        <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>🪵 Log de errores</h2>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {errores.length > 0 && <span style={{ fontSize:11, background:"rgba(239,68,68,0.2)", color:"#fca5a5", padding:"2px 8px", borderRadius:6, fontWeight:700 }}>{errores.length}</span>}
          <span style={{ opacity:0.4, fontSize:14 }}>{abierto ? "▲" : "▼"}</span>
        </div>
      </div>

      {abierto && (
        <div>
          {/* Filtros */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            {["", "socket", "supabase", "proyeccion", "biblia", "imagen", "general"].map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)} style={{
                padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1px solid ${filtroTipo === t ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
                background: filtroTipo === t ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                color: t ? (colorTipo[t] || "white") : "white"
              }}>
                {t || "Todos"}
              </button>
            ))}
            <button onClick={borrarTodos} style={{ marginLeft:"auto", padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", color:"#fca5a5" }}>
              🗑 Borrar todo
            </button>
          </div>

          {cargando ? (
            <div style={{ opacity:0.4, fontSize:13, padding:"12px 0" }}>Cargando...</div>
          ) : errores.length === 0 ? (
            <div style={{ opacity:0.3, fontSize:13, padding:"12px 0", textAlign:"center" }}>✅ Sin errores registrados</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:400, overflowY:"auto" }}>
              {errores.map(e => (
                <div key={e.id} style={{ padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:`1px solid ${colorTipo[e.tipo] || "rgba(255,255,255,0.06)"}20` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:4, background:`${colorTipo[e.tipo] || "rgba(255,255,255,0.1)"}25`, color: colorTipo[e.tipo] || "rgba(255,255,255,0.5)" }}>
                      {e.tipo}
                    </span>
                    <span style={{ fontSize:10, opacity:0.35 }}>{e.pagina}</span>
                    <span style={{ fontSize:10, opacity:0.25, marginLeft:"auto" }}>
                      {new Date(e.creado_en).toLocaleString("es-CL", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                    </span>
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{e.mensaje}</div>
                  <div style={{ fontSize:10, opacity:0.3 }}>
                    {e.plataforma} {e.version && `· v${e.version}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConfiguracionPage() {
  const router = useRouter()
  const { confirmar, ConfirmUI } = useConfirm()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  const [iglesiaId, setIglesiaId] = useState("")
  const [nombre, setNombre] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoNombre, setLogoNombre] = useState("")

  const [flash, setFlash] = useState<{ msg: string; tipo: "ok" | "error" | "info" } | null>(null)

  // ── PIN de sala ──────────────────────────────────────────────────────────
  const [pinSala, setPinSala] = useState("")
  const [pinGuardado, setPinGuardado] = useState(false)

  // ── Invitaciones ──────────────────────────────────────────────────────────
  const [invitaciones, setInvitaciones] = useState<any[]>([])
  const [rolInvitacion, setRolInvitacion] = useState("musico")
  const [generandoInv, setGenerandoInv] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState("")

  // ── Miembros ──────────────────────────────────────────────────────────────
  const [miembros, setMiembros] = useState<any[]>([])
  const [cargandoMiembros, setCargandoMiembros] = useState(false)
  const [miUserId, setMiUserId] = useState<string | null>(null)
  const [guardandoMiembro, setGuardandoMiembro] = useState<string | null>(null)

  const cargarMiembros = async (igId: string) => {
    setCargandoMiembros(true)
    try {
      const { data, error } = await supabase.rpc("get_miembros_iglesia", { p_iglesia_id: igId })
      if (error) { mostrarFlash(`❌ ${error.message}`, "error"); return }
      // ✅ Resguardo defensivo: si por alguna razón queda una fila duplicada
      // en usuarios_iglesia (ya se agregó una restricción única en la BD
      // para que no vuelva a pasar), no romper la lista con keys repetidas.
      const vistos = new Set<string>()
      const unicos = (data || []).filter((m: any) => {
        if (vistos.has(m.user_id)) return false
        vistos.add(m.user_id)
        return true
      })
      setMiembros(unicos)
    } finally {
      setCargandoMiembros(false)
    }
  }

  const cambiarRolMiembro = async (userId: string, nuevoRol: string) => {
    if (!iglesiaId) return
    setGuardandoMiembro(userId)
    const { error } = await supabase.rpc("cambiar_rol_miembro", {
      p_iglesia_id: iglesiaId, p_user_id: userId, p_nuevo_rol: nuevoRol
    })
    if (error) { mostrarFlash(`❌ ${error.message}`, "error") }
    else {
      setMiembros(prev => prev.map(m => m.user_id === userId ? { ...m, rol: nuevoRol } : m))
      mostrarFlash("✅ Rol actualizado")
    }
    setGuardandoMiembro(null)
  }

  const quitarMiembro = async (userId: string, email: string) => {
    if (!iglesiaId) return
    if (!(await confirmar(`¿Quitar a "${email}" de esta iglesia? Perderá acceso de inmediato.`, { textoOk: "Quitar", peligro: true }))) return
    setGuardandoMiembro(userId)
    const { error } = await supabase.rpc("quitar_miembro_iglesia", {
      p_iglesia_id: iglesiaId, p_user_id: userId
    })
    if (error) { mostrarFlash(`❌ ${error.message}`, "error") }
    else {
      setMiembros(prev => prev.filter(m => m.user_id !== userId))
      mostrarFlash("✅ Miembro eliminado")
    }
    setGuardandoMiembro(null)
  }

  const cargarInvitaciones = async (igId: string) => {
    const { data } = await supabase.from("invitaciones").select("*")
      .eq("iglesia_id", igId).eq("activa", true).order("created_at", { ascending: false })
    setInvitaciones(data || [])
  }

  const generarInvitacion = async () => {
    setGenerandoInv(true)
    const codigo = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { data, error } = await supabase.from("invitaciones").insert({
      iglesia_id: iglesiaId, rol: rolInvitacion, codigo,
      usos_max: 20, expira_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }).select().single()
    if (!error && data) {
      setInvitaciones(prev => [data, ...prev])
      copiarLink(data.codigo)
    }
    setGenerandoInv(false)
  }

  const desactivarInvitacion = async (id: string) => {
    await supabase.from("invitaciones").update({ activa: false }).eq("id", id)
    setInvitaciones(prev => prev.filter(i => i.id !== id))
  }

  const copiarLink = (codigo: string) => {
    // ✅ Se comparte el CÓDIGO, no un link. window.location.origin dentro de
    // Electron/Capacitor es "localhost" (inútil en otro dispositivo), y no hay
    // garantía de una web pública. El invitado instala la app y entra el código
    // en "Unirse a una iglesia". Si además hay una web pública configurada
    // (NEXT_PUBLIC_SITE_URL, no localhost) se agrega el link como comodidad.
    const site = process.env.NEXT_PUBLIC_SITE_URL || ""
    const hayWebPublica = site && !/localhost|127\.0\.0\.1/.test(site)
    const texto = hayWebPublica
      ? `Te invito a Selah Live 🎵\n\nAbrí este link: ${site}/unirse?codigo=${codigo}\n\nO instalá la app e ingresá el código: ${codigo}`
      : `Te invito a Selah Live 🎵\n\nInstalá la app e ingresá este código en "Unirse a una iglesia":\n\n${codigo}`
    navigator.clipboard.writeText(texto).then(() => {
      setLinkCopiado(codigo)
      setTimeout(() => setLinkCopiado(""), 2500)
    })
  }

  const ROLES_INV: Record<string, { icon: string; label: string }> = {
    musico: { icon: "🎸", label: "Músico" },
    lider:  { icon: "🎛️", label: "Líder de alabanza" },
    admin:  { icon: "👑", label: "Administrador" },
  }

  // ── IP del servidor ───────────────────────────────────────────────────────
  // ✅ Arranca vacío (igual que en el servidor) y se sincroniza recién
  // después de montar -- este valor decide bloques enteros de JSX más abajo
  // (líneas ~1021, 1106), así que leerlo de localStorage directo en el
  // render también producía "Hydration failed" (error #418) en el APK.
  const [servidorIp, setServidorIp] = useState("")
  useEffect(() => {
    const guardada = localStorage.getItem("servidor_ip")
    if (guardada) setServidorIp(guardada)
  }, [])
  const [servidorPing, setServidorPing] = useState<"idle" | "testing" | "ok" | "error">("idle")
  const [servidorOk, setServidorOk] = useState(false)
  const [buscandoServidor, setBuscandoServidor] = useState(false)
  const [qrUrl, setQrUrl] = useState("")
  const [escaneandoQR, setEscaneandoQR] = useState(false)
  // ✅ Igual que en Navbar: arrancar SIEMPRE en false (como en el servidor,
  // donde no existe window) y recién sincronizar el valor real en un
  // useEffect que solo corre en el cliente después de montar. Calcularlo
  // directo en el render causaba "Hydration failed" (error #418) en el
  // APK -- el HTML estático se genera con isCapacitor=false, pero el APK
  // arranca con true desde el primer render, dejando un árbol de JSX
  // distinto (el bloque de auto-discovery/QR) entre servidor y cliente.
  const [isCapacitor, setIsCapacitor] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  useEffect(() => {
    setIsCapacitor(!!(window as any).Capacitor)
    setIsElectron(navigator.userAgent.includes("Electron"))
  }, [])
  const getLocalIPDisplay = () => servidorIp || "localhost"

  // Mostrar QR en Electron al cargar + obtener IP local
  useEffect(() => {
    if (!isElectron) return
    setQrUrl(`http://localhost:4000/qr?t=${Date.now()}`)
    // Obtener IP real del servidor para mostrarla al usuario
    fetch("http://localhost:4000/info")
      .then(r => r.json())
      .then(d => { if (d?.ip) setServidorIp(d.ip) })
      .catch(() => {})
  }, [isElectron])

  const testearServidor = async (ip?: string) => {
    const host = (ip ?? servidorIp).trim() || "localhost"
    setServidorPing("testing")
    setServidorOk(false)
    try {
      const r = await fetch(`http://${host}:4000/ping`, { signal: AbortSignal.timeout(3000) })
      const d = await r.json()
      const ok = d?.ok === true
      setServidorPing(ok ? "ok" : "error")
      setServidorOk(ok)
    } catch { setServidorPing("error") }
  }

  const guardarServidorIp = async () => {
    const ip = servidorIp.trim()
    if (ip) localStorage.setItem("servidor_ip", ip)
    else localStorage.removeItem("servidor_ip")
    mostrarFlash(ip ? `✅ IP guardada: ${ip}` : "IP eliminada", "ok")
    await testearServidor(ip)
  }

  // ✅ Auto-discovery: escanea la red local buscando el servidor Selah Live
  const buscarServidorAuto = async () => {
    setBuscandoServidor(true)
    mostrarFlash("🔍 Buscando servidor en la red...", "ok")
    try {
      const ipEncontrada = await buscarServidorEnRed()
      if (ipEncontrada) {
        setServidorIp(ipEncontrada)
        localStorage.setItem("servidor_ip", ipEncontrada)
        await testearServidor(ipEncontrada)
        mostrarFlash(`✅ Servidor encontrado en ${ipEncontrada}`, "ok")
        setBuscandoServidor(false)
        return
      }
      mostrarFlash("❌ No se encontró el servidor. ¿Está abierto Selah Live en el PC?", "error")
    } catch(e) {
      mostrarFlash("❌ Error buscando servidor", "error")
    }
    setBuscandoServidor(false)
  }

  // ✅ Escanear QR con cámara nativa (sin librería externa)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const escaneandoRef = useRef(false)  // ✅ ref en vez de state — siempre actual dentro del loop recursivo

  const escanearQR = async () => {
    escaneandoRef.current = true
    setEscaneandoQR(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      // El video se monta en el DOM después del render
      setTimeout(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        videoRef.current.play()

        // Usar BarcodeDetector si está disponible (Android Chrome)
        const BarcodeDetector = (window as any).BarcodeDetector
        if (BarcodeDetector) {
          const detector = new BarcodeDetector({ formats: ["qr_code"] })
          const scan = async () => {
            // ✅ ref siempre tiene el valor actual, no el del momento en que se creó la función
            if (!videoRef.current || !escaneandoRef.current) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              for (const b of barcodes) {
                const match = b.rawValue.match(/selah:\/\/([0-9.]+):(\d+)/)
                if (match) {
                  const ip = match[1]
                  streamRef.current?.getTracks().forEach(t => t.stop())
                  escaneandoRef.current = false
                  setEscaneandoQR(false)
                  setServidorIp(ip)
                  localStorage.setItem("servidor_ip", ip)
                  await testearServidor(ip)
                  mostrarFlash(`✅ Conectado a ${ip}`, "ok")
                  return
                }
              }
            } catch(e) {}
            requestAnimationFrame(scan)
          }
          scan()
        } else {
          mostrarFlash("Tu dispositivo no soporta escaneo QR. Usa 'Buscar automáticamente'.", "error")
          streamRef.current?.getTracks().forEach(t => t.stop())
          escaneandoRef.current = false
          setEscaneandoQR(false)
        }
      }, 300)
    } catch(e) {
      escaneandoRef.current = false
      setEscaneandoQR(false)
      mostrarFlash("❌ No se pudo acceder a la cámara", "error")
    }
  }

  const detenerEscaneo = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    escaneandoRef.current = false
    setEscaneandoQR(false)
  }

  // ── Cerrar sesión ─────────────────────────────────────────────────────────
  // ✅ Helper: corre una promesa con límite de tiempo — si no responde a
  // tiempo, seguimos igual. Ningún paso del logout puede colgar la app.
  const conTimeout = <T,>(promesa: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([
      promesa,
      new Promise<null>(resolve => setTimeout(() => resolve(null), ms))
    ])

  const cerrarSesion = async () => {
    const isElectron = typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")

    // ✅ Marcar que el cierre fue INTENCIONAL — evita el auto-reconectar
    localStorage.setItem("selah-logout-manual", "1")

    // Limpiar sesión de Supabase (máx 2s — si la red está lenta no bloqueamos)
    await conTimeout(supabase.auth.signOut(), 2000)

    // Limpiar storage local — síncrono, instantáneo
    localStorage.clear()
    sessionStorage.clear()

    // ✅ IndexedDB: NO usar deleteDatabase — se cuelga indefinidamente si
    // hay una conexión abierta (como la del caché de canciones en
    // AppContext), que es justo lo que causaba la demora de minutos.
    // Solo son títulos de canciones cacheados, no datos sensibles —
    // sobreescribir al próximo login es suficiente, no hace falta borrar.

    // En Electron: limpiar cookies del WebView (máx 2s)
    if (isElectron) {
      await conTimeout(
        (window as any).electron?.ipcRenderer?.invoke("clear-session") ?? Promise.resolve(),
        2000
      )
    }

    // Redirigir a la raíz (que siempre carga) -- Inicio ve que no hay sesión
    // y redirige por SPA a /login con estado limpio.
    window.location.href = "/"
  }

  // ── Fuentes del proyector ────────────────────────────────────────────────
  // ✅ Mismo motivo que servidorIp arriba: arrancar con el default seguro y
  // sincronizar recién en el cliente, para no volver a producir un mismatch
  // de hidratación (estos valores se comparan contra opciones fijas en el
  // JSX de abajo para resaltar la seleccionada).
  const [escalaFuente, setEscalaFuente] = useState(100)
  const [familiaFuente, setFamiliaFuente] = useState("system")
  useEffect(() => {
    const escalaGuardada = localStorage.getItem("proyector-escala-fuente")
    if (escalaGuardada) setEscalaFuente(Number(escalaGuardada))
    const familiaGuardada = localStorage.getItem("proyector-font-family")
    if (familiaGuardada) setFamiliaFuente(familiaGuardada)
  }, [])

  const mostrarFlash = (msg: string, tipo: "ok" | "error" | "info" = "ok") => {
    setFlash({ msg, tipo })
    setTimeout(() => setFlash(null), 3000)
  }

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      // ✅ getSession() no adquiere el auth lock (lee de memoria/localStorage)
      // getUser() sí lo adquiere y choca con proyectar/músicos/control
      const resultadoSesion = await conTimeout(supabase.auth.getSession(), 5000)
      if (!resultadoSesion) {
        // ✅ Ambiguo (pudo ser solo la red) -- no mandar a /login por las
        // dudas, eso desloguearía a alguien que sí tenía sesión.
        mostrarFlash("⚠️ Sin conexión — intenta de nuevo", "error")
        setCargando(false)
        return
      }
      const { data: sessionData } = resultadoSesion
      if (!sessionData.session?.user) { navegarSPA(router, "/login", { replace: true }); return }
      setMiUserId(sessionData.session.user.id)

      const id = await getIglesiaId()
      if (!id) { navegarSPA(router, "/crear-iglesia", { replace: true }); return }

      setIglesiaId(id)

      const { data: rows, error } = await supabase
        .from("iglesias")
        .select("nombre, localidad, logo_url, logo_nombre, pin_sala")
        .eq("id", id)
        .limit(1)

      const data = (rows as any[])?.[0]

      if (error) {
        mostrarFlash("No se pudo cargar la configuración", "error")
        setCargando(false)
        return
      }

      setNombre(data?.nombre || "")
      setLocalidad(data?.localidad || "")
      setLogoUrl(data?.logo_url || "")
      setLogoNombre(data?.logo_nombre || "")
      setPinSala(data?.pin_sala || "")
      cargarInvitaciones(id)
      cargarMiembros(id)
      setCargando(false)
    }

    cargar()
  }, [router])

  // ── Optimizador de logo: elimina fondo blanco con flood-fill ─────────────────
  //  ✅ FIX: esta función ahora sí se llama en subirArchivoLogo
  const optimizarLogoTransparente = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = () => { img.src = reader.result as string }
      reader.onerror = reject

      img.onload = () => {
        const maxSize = 1200
        const scale = Math.min(1, maxSize / img.width, maxSize / img.height)
        const newWidth = Math.round(img.width * scale)
        const newHeight = Math.round(img.height * scale)

        const canvas = document.createElement("canvas")
        canvas.width = newWidth
        canvas.height = newHeight

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) { reject(new Error("No se pudo crear canvas")); return }

        ctx.clearRect(0, 0, newWidth, newHeight)
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        const imageData = ctx.getImageData(0, 0, newWidth, newHeight)
        const data = imageData.data

        const esFondoClaro = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return false
          const idx = (y * newWidth + x) * 4
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3]
          if (a < 10) return true
          const max = Math.max(r, g, b)
          const diferencia = max - Math.min(r, g, b)
          return max > 215 && diferencia < 32
        }

        const visitado = new Uint8Array(newWidth * newHeight)
        const cola: Array<[number, number]> = []

        const agregar = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return
          const pos = y * newWidth + x
          if (visitado[pos] || !esFondoClaro(x, y)) return
          visitado[pos] = 1
          cola.push([x, y])
        }

        // Flood-fill desde los 4 bordes para no eliminar blancos internos
        for (let x = 0; x < newWidth; x++) { agregar(x, 0); agregar(x, newHeight - 1) }
        for (let y = 0; y < newHeight; y++) { agregar(0, y); agregar(newWidth - 1, y) }

        while (cola.length > 0) {
          const [x, y] = cola.shift()!
          const idx = (y * newWidth + x) * 4
          data[idx + 3] = 0
          agregar(x + 1, y); agregar(x - 1, y)
          agregar(x, y + 1); agregar(x, y - 1)
        }

        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("No se pudo generar WebP")); return }
            const nombreBase = file.name.replace(/\.[^/.]+$/, "")
            resolve(new File([blob], `${nombreBase}.webp`, { type: "image/webp" }))
          },
          "image/webp",
          0.92
        )
      }

      img.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ── Subir logo ───────────────────────────────────────────────────────────────
  const subirArchivoLogo = async (file: File) => {
    if (!iglesiaId) return

    try {
      setSubiendoLogo(true)
      mostrarFlash("Procesando imagen...", "info")

      // ✅ FIX: ahora sí se usa optimizarLogoTransparente
      let archivoFinal: File
      try {
        archivoFinal = await optimizarLogoTransparente(file)
      } catch {
        // Si falla la optimización, usamos el archivo original
        archivoFinal = file
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "")
      const nombreAmigable = baseName.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
      const extension = archivoFinal.name.split(".").pop()?.toLowerCase() || "webp"
      const nombreArchivo = `logos/${iglesiaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

      const { error: errorUpload } = await supabase.storage
        .from("imagenes-culto")
        .upload(nombreArchivo, archivoFinal, {
          cacheControl: "3600",
          upsert: false,
          contentType: archivoFinal.type
        })

      if (errorUpload) {
        mostrarFlash(`No se pudo subir el logo: ${errorUpload.message}`, "error")
        return
      }

      const { data } = supabase.storage.from("imagenes-culto").getPublicUrl(nombreArchivo)
      const nuevaUrl = data.publicUrl
      const nuevoNombre = nombreAmigable || "Logo de iglesia"

      const { error: errorUpdate } = await supabase
        .from("iglesias")
        .update({ logo_url: nuevaUrl, logo_nombre: nuevoNombre })
        .eq("id", iglesiaId)

      if (errorUpdate) {
        mostrarFlash("El logo se subió pero no se pudo guardar", "error")
        return
      }

      setLogoUrl(nuevaUrl)
      setLogoNombre(nuevoNombre)
      mostrarFlash("✅ Logo actualizado correctamente")
    } catch (error) {
      console.error("Error procesando logo:", error)
      mostrarFlash("No se pudo procesar el logo", "error")
    } finally {
      setSubiendoLogo(false)
    }
  }

  // ── Guardar datos ────────────────────────────────────────────────────────────
  const guardarDatos = async () => {
    if (!iglesiaId) return
    if (!nombre.trim()) { mostrarFlash("El nombre no puede quedar vacío", "error"); return }

    setGuardando(true)
    const { error } = await supabase
      .from("iglesias")
      .update({ nombre: nombre.trim(), localidad: localidad.trim() || null })
      .eq("id", iglesiaId)

    setGuardando(false)

    if (error) { mostrarFlash("No se pudo guardar la configuración", "error"); return }

    mostrarFlash("✅ Configuración guardada")
    router.refresh()
  }

  // ── Quitar logo ──────────────────────────────────────────────────────────────
  const quitarLogo = async () => {
    if (!iglesiaId) return

    const { error } = await supabase
      .from("iglesias")
      .update({ logo_url: null, logo_nombre: null })
      .eq("id", iglesiaId)

    if (error) { mostrarFlash("No se pudo quitar el logo", "error"); return }

    setLogoUrl("")
    setLogoNombre("")
    setConfirmarQuitar(false)
    mostrarFlash("Logo eliminado")
  }

  // ── Estilos ──────────────────────────────────────────────────────────────────
  const card: CSSProperties = {
    background: "rgba(15,23,42,0.94)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "24px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.30)"
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#020617",
    color: "white",
    outline: "none",
    fontSize: "16px", // ✅ evita zoom automático en iOS
    boxSizing: "border-box"
  }

  const labelStyle: CSSProperties = {
    fontSize: "12px",
    fontWeight: 800,
    opacity: 0.6,
    marginBottom: "8px",
    display: "block",
    letterSpacing: "0.07em",
    textTransform: "uppercase"
  }

  const btnPrincipal: CSSProperties = {
    border: "none",
    borderRadius: "14px",
    padding: "13px 18px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(37,99,235,0.22)",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px"
  }

  const btnSecundario: CSSProperties = {
    ...btnPrincipal,
    background: "rgba(30,41,59,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "none"
  }

  const btnRojo: CSSProperties = {
    ...btnSecundario,
    background: "rgba(220,38,38,0.15)",
    color: "#fca5a5",
    border: "1px solid rgba(239,68,68,0.25)"
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.08)",
          borderTopColor: "#3b82f6",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ opacity: 0.5, fontSize: 15 }}>Cargando configuración...</div>
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(34,197,94,0.14), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
      color: "white",
      padding: "14px 12px 40px",
      boxSizing: "border-box",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflowX: "hidden"
    }}>
      {ConfirmUI}

      {/* Flash mensaje */}
      {flash && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          background: flash.tipo === "ok" ? "rgba(34,197,94,0.15)"
            : flash.tipo === "error" ? "rgba(239,68,68,0.15)"
            : "rgba(59,130,246,0.15)",
          border: `1px solid ${flash.tipo === "ok" ? "rgba(34,197,94,0.35)"
            : flash.tipo === "error" ? "rgba(239,68,68,0.35)"
            : "rgba(59,130,246,0.35)"}`,
          color: "white", padding: "11px 24px", borderRadius: 12,
          fontSize: 14, fontWeight: 600, zIndex: 999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap"
        }}>
          {flash.msg}
        </div>
      )}

      <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* Header */}
        <div style={{ ...card, padding: "22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 900, opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Ajustes de iglesia
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 40px)", lineHeight: 1, fontWeight: 900 }}>
              ⚙️ Configuración
            </h1>
          </div>
          <button style={btnSecundario} onClick={() => navegarSPA(router, "/")}>
            ← Volver al inicio
          </button>
        </div>

        {/* Grid principal */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>

          {/* ── Datos generales ── */}
          <div style={{ ...card, padding: "24px" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              🏛️ Datos generales
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Nombre de la iglesia *</label>
                <input
                  style={inputStyle}
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: IEP La Ligua"
                />
              </div>

              <div>
                <label style={labelStyle}>Localidad / ciudad</label>
                <input
                  style={inputStyle}
                  value={localidad}
                  onChange={e => setLocalidad(e.target.value)}
                  placeholder="Ej: La Ligua, Renca, Santiago..."
                />
              </div>

              {/* Vista previa */}
              <div style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)"
              }}>
                <div style={{ fontSize: 11, opacity: 0.45, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                  Vista previa
                </div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{nombre || "Nombre de la iglesia"}</div>
                <div style={{ opacity: 0.45, fontSize: 13, marginTop: 3 }}>{localidad || "Sin localidad"}</div>
              </div>

              <button
                style={{ ...btnPrincipal, opacity: guardando ? 0.6 : 1, cursor: guardando ? "not-allowed" : "pointer" }}
                disabled={guardando}
                onClick={guardarDatos}
              >
                {guardando ? "⏳ Guardando..." : "💾 Guardar cambios"}
              </button>
            </div>
          </div>

          {/* ── Logo ── */}
          <div style={{ ...card, padding: "24px" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              🖼️ Logo de iglesia
            </h2>

            {/* Preview logo */}
            <div style={{
              padding: "18px",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "20px"
            }}>
              <div style={{
                width: 92, height: 92,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0
              }}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 38 }}>⛪</span>
                }
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {logoNombre || "Sin logo configurado"}
                </div>
                <div style={{ marginTop: 5, fontSize: 13, opacity: 0.55, lineHeight: 1.4 }}>
                  {logoUrl
                    ? "Logo activo — se elimina el fondo blanco automáticamente"
                    : "Sube una imagen PNG, JPG o SVG. Se optimiza automáticamente."}
                </div>
                {subiendoLogo && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>
                    ⏳ Procesando y subiendo...
                  </div>
                )}
              </div>
            </div>

            {/* Acciones logo */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <label style={{
                ...btnPrincipal,
                opacity: subiendoLogo ? 0.6 : 1,
                cursor: subiendoLogo ? "not-allowed" : "pointer"
              }}>
                {subiendoLogo ? "Subiendo..." : "📁 Subir / cambiar logo"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={subiendoLogo}
                  onChange={async e => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    await subirArchivoLogo(file)
                    ;(e.target as HTMLInputElement).value = ""
                  }}
                />
              </label>

              {logoUrl && !confirmarQuitar && (
                <button style={btnRojo} onClick={() => setConfirmarQuitar(true)}>
                  ❌ Quitar logo
                </button>
              )}

              {/* Confirmación inline en vez de confirm() */}
              {confirmarQuitar && (
                <div style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap"
                }}>
                  <span style={{ fontSize: 13, color: "#fca5a5", flex: 1 }}>
                    ¿Seguro que quieres quitar el logo?
                  </span>
                  <button onClick={quitarLogo} style={{ ...btnRojo, padding: "7px 14px", fontSize: 13 }}>
                    Sí, quitar
                  </button>
                  <button onClick={() => setConfirmarQuitar(false)} style={{ ...btnSecundario, padding: "7px 14px", fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.15)",
              fontSize: 12,
              opacity: 0.7,
              lineHeight: 1.5
            }}>
              ℹ️ El logo se muestra en el dashboard y puede usarse en pantallas de espera. El fondo blanco se elimina automáticamente al subir.
            </div>
          </div>
        </div>

        {/* Links rápidos */}
        <div style={{ ...card, padding: "20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>
            Accesos rápidos
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { href: "/control",   label: "🎛️ Control",   desc: "Operar el culto" },
              { href: "/canciones", label: "🎵 Canciones", desc: "Gestionar repertorio" },
              { href: "/",          label: "⌂ Dashboard",  desc: "Estadísticas" },
            ].map(({ href, label, desc }) => (
              <button key={href} onClick={() => navegarSPA(router, href)}
                style={{ ...btnSecundario, flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "12px 16px", minWidth: 130 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{label}</span>
                <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── SERVIDOR DE PROYECCIÓN ─────────────────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>🖥️ Computador del proyector</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>¿En qué equipo está corriendo el programa Selah?</div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Opción 1: mismo equipo */}
            <button
              onClick={() => { setServidorIp(""); localStorage.removeItem("servidor_ip"); setServidorPing("idle"); mostrarFlash("✅ Configurado: este mismo equipo", "ok") }}
              style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${!servidorIp ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                background: !servidorIp ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)", color: "white", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>💻</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Este mismo computador</div>
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>El proyector y el control están en el mismo equipo</div>
                </div>
                {!servidorIp && <div style={{ marginLeft: "auto", color: "#60a5fa", fontSize: 18 }}>✓</div>}
              </div>
            </button>

            {/* Opción 2: otro equipo */}
            <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${servidorIp ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
              background: servidorIp ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: servidorIp ? 12 : 0, cursor: !servidorIp ? "pointer" : "default" }}
                onClick={() => !servidorIp && setServidorIp(" ")}>
                <span style={{ fontSize: 24 }}>🔗</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Otro computador de la red</div>
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>El programa corre en un PC diferente al que usas para controlar</div>
                </div>
                {servidorIp && <div style={{ color: "#60a5fa", fontSize: 18 }}>✓</div>}
              </div>

              {servidorIp.trim() !== "" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.6, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                    📋 <b>¿Cómo encontrar la dirección?</b><br/>
                    En el computador del proyector, abre el programa y anota el número que aparece (Ej: <span style={{ fontFamily: "monospace", color: "#93c5fd" }}>192.168.1.5</span>).
                    O busca "CMD" y escribe <span style={{ fontFamily: "monospace", color: "#93c5fd" }}>ipconfig</span>.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={servidorIp.trim()}
                      onChange={e => { setServidorIp(e.target.value); setServidorPing("idle") }}
                      placeholder="Ej: 192.168.1.5"
                      style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
                      onKeyDown={e => e.key === "Enter" && guardarServidorIp()}
                    />
                    <button onClick={guardarServidorIp} style={{ ...btnPrincipal, flexShrink: 0 }}>Guardar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Test de conexión */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => testearServidor()} disabled={servidorPing === "testing"}
                style={{ ...btnSecundario, opacity: servidorPing === "testing" ? 0.5 : 1, flex: 1 }}>
                🔌 Verificar conexión
              </button>
              {servidorPing !== "idle" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, flexShrink: 0,
                  color: servidorPing === "ok" ? "#4ade80" : servidorPing === "testing" ? "#93c5fd" : "#fca5a5" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: servidorPing === "ok" ? "#22c55e" : servidorPing === "testing" ? "#3b82f6" : "#ef4444",
                    boxShadow: servidorPing === "ok" ? "0 0 6px rgba(34,197,94,0.7)" : "none" }} />
                  {servidorPing === "ok" ? "¡Conectado!" : servidorPing === "testing" ? "Probando..." : "No responde"}
                </div>
              )}
            </div>

            {/* ✅ Auto-discovery + QR scanner para APK */}
            {isCapacitor && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={buscarServidorAuto} disabled={buscandoServidor}
                  style={{ ...btnSecundario, flex: 1, opacity: buscandoServidor ? 0.6 : 1 }}>
                  {buscandoServidor ? "🔍 Buscando..." : "🔍 Buscar automáticamente"}
                </button>
                <button onClick={escanearQR}
                  style={{ ...btnSecundario, flexShrink: 0 }}>
                  📷 Escanear QR
                </button>
              </div>
            )}

            {/* ✅ QR Code en Electron para que el APK escanee */}
            {isElectron && (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>
                  Escanea este QR con el celular para conectar automáticamente
                </div>
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="QR Conexión"
                    style={{ width: 180, height: 180, borderRadius: 12, background: "white", padding: 8 }}
                    onError={async e => {
                      // ✅ Fallback: generar QR client-side si el servidor falla
                      const target = e.currentTarget
                      try {
                        const res = await fetch("http://localhost:4000/info")
                        const { ip } = await res.json()
                        const url = `selah://${ip}:4000`
                        // Usar una API pública de QR como último recurso
                        target.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`
                      } catch { target.style.display = "none" }
                    }}
                  />
                ) : (
                  <div style={{ width: 180, height: 180, margin: "0 auto", borderRadius: 12,
                    background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 12, opacity: 0.4 }}>
                    Cargando QR...
                  </div>
                )}
                {/* Siempre mostrar la URL/IP para que el usuario la pueda ingresar manualmente */}
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
                  IP: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#60a5fa" }}>
                    {servidorIp || "cargando..."}
                  </span>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`selah://${servidorIp}:4000`); mostrarFlash("✅ URL copiada", "ok") }}
                  style={{ marginTop: 6, fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                  📋 Copiar URL
                </button>
              </div>
            )}

            {/* Visor cámara QR */}
            {escaneandoQR && (
              <div style={{ borderRadius: 12, overflow: "hidden", position: "relative", background: "#000" }}>
                <video ref={videoRef} style={{ width: "100%", display: "block" }} playsInline muted />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: 200, height: 200, border: "3px solid #3b82f6", borderRadius: 12, opacity: 0.8 }} />
                </div>
                <button onClick={detenerEscaneo}
                  style={{ position: "absolute", top: 8, right: 8, padding: "4px 10px", borderRadius: 8,
                    background: "rgba(0,0,0,0.7)", color: "white", border: "none", cursor: "pointer", fontSize: 12 }}>
                  ✕ Cancelar
                </button>
                <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  Apunta al QR del PC
                </div>
              </div>
            )}

            {/* ✅ Botón ir al control cuando conecta OK */}
            {servidorOk && (
              <button onClick={() => navegarSPA(router, "/control")}
                style={{ ...btnPrincipal, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                🎛️ Ir al Control de Culto →
              </button>
            )}

          </div>
        </div>

        {/* ── PIN DE SALA ────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>🔐 PIN de sala</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>Protege el control del proyector en la red local</div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>
              Solo dispositivos con este PIN podrán controlar el proyector. Déjalo vacío para no usar PIN.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="number" placeholder="Ej: 1234" value={pinSala}
                onChange={e => { setPinSala(e.target.value.slice(0, 6)); setPinGuardado(false) }}
                style={{ ...inputStyle, flex: 1, fontSize: 18, fontWeight: 700, letterSpacing: 8 }}
              />
              <button onClick={async () => {
                  await supabase.from("iglesias").update({ pin_sala: pinSala || null }).eq("id", iglesiaId)
                  if (pinSala) localStorage.setItem("selah-sala-pin", pinSala)
                  else localStorage.removeItem("selah-sala-pin")
                  setPinGuardado(true)
                }}
                style={{ ...btnPrincipal, flexShrink: 0, background: pinGuardado ? "rgba(34,197,94,0.2)" : undefined, color: pinGuardado ? "#4ade80" : undefined }}>
                {pinGuardado ? "✓ Guardado" : "Guardar"}
              </button>
            </div>
            {pinSala && (
              <button onClick={async () => {
                  setPinSala(""); localStorage.removeItem("selah-sala-pin")
                  await supabase.from("iglesias").update({ pin_sala: null }).eq("id", iglesiaId)
                  setPinGuardado(false)
                }}
                style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontSize: 12, cursor: "pointer" }}>
                Quitar PIN
              </button>
            )}
          </div>
        </div>

        {/* ── FUENTES DEL PROYECTOR ──────────────────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>🔤 Fuentes del proyector</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>Se aplica en tiempo real al abrir el proyector</div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tamaño de letra</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min="60" max="160" value={escalaFuente}
                  onChange={e => { const v = Number(e.target.value); setEscalaFuente(v); localStorage.setItem("proyector-escala-fuente", String(v)) }}
                  style={{ flex: 1 }} />
                <span style={{ fontWeight: 800, fontSize: 16, minWidth: 48, textAlign: "right" }}>{escalaFuente}%</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {[80, 100, 120, 140].map(v => (
                  <button key={v} onClick={() => { setEscalaFuente(v); localStorage.setItem("proyector-escala-fuente", String(v)) }}
                    style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${escalaFuente === v ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                      background: escalaFuente === v ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                      color: escalaFuente === v ? "#93c5fd" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tipo de letra</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "system",  label: "Sistema",           css: "system-ui, sans-serif" },
                  { id: "serif",   label: "Serif (tradicional)", css: "Georgia, 'Times New Roman', serif" },
                  { id: "rounded", label: "Redondeada",        css: "'Trebuchet MS', Arial, sans-serif" },
                  { id: "mono",    label: "Monospace",         css: "'Courier New', monospace" },
                ].map(f => (
                  <button key={f.id} onClick={() => { setFamiliaFuente(f.id); localStorage.setItem("proyector-font-family", f.id) }}
                    style={{ padding: "12px 16px", borderRadius: 10, textAlign: "left",
                      border: `1px solid ${familiaFuente === f.id ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                      background: familiaFuente === f.id ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                      color: "white", cursor: "pointer" }}>
                    <span style={{ fontFamily: f.css, fontSize: 18 }}>Dios es amor</span>
                    <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 12 }}>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── INVITACIONES ──────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>👥 Invitar personas</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>Genera un link para que otros se unan a tu iglesia</div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Generar nueva invitación */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={rolInvitacion} onChange={e => setRolInvitacion(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none" }}>
                <option value="musico" style={{ background: "#1e293b" }}>🎸 Músico</option>
                <option value="lider"  style={{ background: "#1e293b" }}>🎛️ Líder de alabanza</option>
                <option value="admin"  style={{ background: "#1e293b" }}>👑 Administrador</option>
              </select>
              <button onClick={generarInvitacion} disabled={generandoInv}
                style={{ ...btnPrincipal, flexShrink: 0, opacity: generandoInv ? 0.6 : 1 }}>
                {generandoInv ? "Generando..." : "✉️ Generar link"}
              </button>
            </div>

            {/* Lista de invitaciones activas */}
            {invitaciones.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.45, letterSpacing: "0.06em", textTransform: "uppercase" }}>Códigos activos</div>
                {invitaciones.map(inv => {
                  const r = ROLES_INV[inv.rol] || ROLES_INV.musico
                  const expirado = inv.expira_at && new Date(inv.expira_at) < new Date()
                  return (
                    <div key={inv.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                        {/* ✅ El código bien visible: es lo que el invitado ingresa en la app */}
                        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.14em", fontFamily: "monospace", margin: "2px 0" }}>{inv.codigo}</div>
                        <div style={{ fontSize: 11, opacity: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inv.usos_actuales}/{inv.usos_max} usos · {expirado ? "Expirado" : `Expira ${new Date(inv.expira_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}
                        </div>
                      </div>
                      <button onClick={() => copiarLink(inv.codigo)}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: linkCopiado === inv.codigo ? "rgba(34,197,94,0.2)" : "rgba(37,99,235,0.2)", color: linkCopiado === inv.codigo ? "#4ade80" : "#93c5fd", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        {linkCopiado === inv.codigo ? "✓ Copiado" : "📋 Copiar"}
                      </button>
                      <button onClick={() => desactivarInvitacion(inv.id)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ fontSize: 12, opacity: 0.4, lineHeight: 1.6 }}>
              El código es válido por 7 días y hasta 20 usos. La persona instala Selah Live e ingresa el código en "Unirse a una iglesia". Compártelo por WhatsApp o correo.
            </div>
          </div>
        </div>

        {/* ── MIEMBROS ───────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>🧑‍🤝‍🧑 Miembros</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>Quiénes tienen acceso a esta iglesia y con qué rol</div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {cargandoMiembros ? (
              <div style={{ fontSize: 13, opacity: 0.5, textAlign: "center", padding: "12px 0" }}>Cargando...</div>
            ) : miembros.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.5, textAlign: "center", padding: "12px 0" }}>No se encontraron miembros.</div>
            ) : (
              miembros.map(m => {
                const soyYo = m.user_id === miUserId
                const guardando = guardandoMiembro === m.user_id
                return (
                  <div key={m.user_id} style={{
                    padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10,
                    opacity: guardando ? 0.6 : 1
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.email}{soyYo && <span style={{ opacity: 0.4, fontWeight: 500 }}> (tú)</span>}
                      </div>
                    </div>
                    <select
                      value={m.rol}
                      disabled={guardando}
                      onChange={e => cambiarRolMiembro(m.user_id, e.target.value)}
                      style={{
                        padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 12, outline: "none", flexShrink: 0
                      }}>
                      <option value="musico" style={{ background: "#1e293b" }}>🎸 Músico</option>
                      <option value="lider"  style={{ background: "#1e293b" }}>🎛️ Líder</option>
                      <option value="admin"  style={{ background: "#1e293b" }}>👑 Admin</option>
                    </select>
                    <button onClick={() => quitarMiembro(m.user_id, m.email)} disabled={guardando}
                      style={{ padding: "7px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                      ✕
                    </button>
                  </div>
                )
              })
            )}
            <div style={{ fontSize: 12, opacity: 0.4, lineHeight: 1.6, marginTop: 4 }}>
              No puedes quitar ni degradar al último administrador de la iglesia.
            </div>
          </div>
        </div>

        {/* ── TUTORIALES ─────────────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            🎓 Tutoriales
          </h2>
          <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 16, lineHeight: 1.6 }}>
            ¿Necesitas repasar cómo funciona alguna pantalla? Reinicia el tour guiado de cualquier sección.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { id: "tour-control",   label: "🎛️ Tour del Control de Culto",  desc: "Proyectar, navegar partes, auto-avance, lista de culto",  ruta: "/control"   },
              { id: "tour-canciones", label: "🎵 Tour del Cancionero",        desc: "Buscar, filtrar, agregar canciones e importar PPT",       ruta: "/canciones" },
            ].map(({ id, label, desc, ruta }) => {
              // visto calculado en onClick
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                    <div style={{ fontSize: 12, opacity: 0.4, marginTop: 2 }}>{desc}</div>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem(id)
                      sessionStorage.setItem(`${id}-forzar`, "1")
                      navegarSPA(router, ruta)
                    }}
                    style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(59,130,246,0.3)",
                      background: "rgba(59,130,246,0.1)", color: "#93c5fd",
                      fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {"▶ Ver tour"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── LOG DE ERRORES ─────────────────────────────────────────────── */}
        {iglesiaId && (
          <ErrorLog iglesiaId={iglesiaId} />
        )}

        {/* ── ACTUALIZACIONES ────────────────────────────────────────────── */}
        {typeof window !== "undefined" && !!(window as any).electron && (
          <div style={card}>
            <h2 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 800 }}>🔄 Actualizaciones</h2>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.5 }}>Verificar si hay una nueva versión disponible</div>
              <button
                onClick={() => (window as any).electron?.ipcRenderer?.send("check-for-updates")}
                style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(59,130,246,0.3)",
                  background: "rgba(59,130,246,0.1)", color: "#93c5fd",
                  fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                Buscar actualizaciones
              </button>
            </div>
          </div>
        )}

        {/* ── CERRAR SESIÓN ──────────────────────────────────────────────── */}
        <div style={{ ...card, padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Sesión activa</div>
            <div style={{ fontSize: 12, opacity: 0.45, marginTop: 2 }}>Cierra sesión en este dispositivo</div>
          </div>
          <button onClick={cerrarSesion}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            🚪 Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  )
}