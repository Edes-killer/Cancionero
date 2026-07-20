"use client"

import { useEffect, useRef, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"
import { getIglesiaId } from "../../lib/getIglesia"
import { getSocketUrl, buscarServidorEnRed } from "../../lib/servidor"
import { supabaseProbablementeCaido, marcarSupabaseCaido, marcarSupabaseOk } from "../../lib/cache"
import { ocultarGlobalesConCopia } from "@/context/AppContext"
import PitchDetector from "@/components/PitchDetector"

export default function MusicosPage() {
  const [partes, setPartes] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  // ✅ Conexión al servidor DESDE Músicos (un músico no puede entrar a
  // Configuración, así que necesita conectarse desde su propio módulo).
  const [panelConexion, setPanelConexion] = useState(false)
  const [buscandoServidor, setBuscandoServidor] = useState(false)
  const [ipManual, setIpManual] = useState("")
  const [msgConexion, setMsgConexion] = useState("")
  // ✅ Se incrementa para forzar que el socket se vuelva a crear con la IP nueva
  // (ver el useEffect del socket, que lo tiene en sus dependencias).
  const [versionConexion, setVersionConexion] = useState(0)
  const conectarConIp = (ip: string) => {
    const limpia = ip.trim()
    if (!limpia) return
    localStorage.setItem("servidor_ip", limpia)
    // ✅ Antes esto hacía window.location.reload() para reconectar. En el APK la
    // app es un export estático: a /musicos se llega por navegación SPA y NO
    // existe un archivo en esa ruta, así que una recarga dura caía al
    // index.html y la app arrancaba desde la raíz -> te mandaba al dashboard
    // justo después de conectar. Ahora se recrea solo el socket, sin recargar.
    setMsgConexion(`Conectando con ${limpia}...`)
    setVersionConexion(v => v + 1)
  }
  const buscarYConectar = async () => {
    setBuscandoServidor(true); setMsgConexion("Buscando el computador en la red...")
    try {
      const ip = await buscarServidorEnRed(m => setMsgConexion(m))
      if (ip) { conectarConIp(ip); return }
      setMsgConexion("No se encontró el computador. Escribe la IP a mano o revisa que Selah Live esté abierto en el PC.")
    } catch {
      setMsgConexion("No se pudo buscar. Escribe la IP a mano.")
    } finally {
      setBuscandoServidor(false)
    }
  }
  const [transposicion, setTransposicion] = useState(0)
  const [mostrarAcordes, setMostrarAcordes] = useState(true)
  const [usarAmericano, setUsarAmericano] = useState(false)
  const socketConectadoRef = useRef(false)

  // Cargar canciones al montar y forzar modo repertorio
  useEffect(() => {
    setModo("repertorio")  // ← forzar siempre, por si React reutiliza el componente
    getIglesiaId().then(igId => {
      if (igId) salaRef.current = igId
    }).catch(() => {}).finally(() => {
      cargarRepertorio()
    })
  }, [])
  const [esMovil, setEsMovil] = useState(false)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const salaRef = useRef<string | null>(null)

  // ── Push Notifications ───────────────────────────────────────────────────
  // ⚠️ Requiere Firebase configurado (google-services.json en android/app/)
  // Para activar:
  //   1. Crear proyecto en Firebase → Agregar app Android → Descargar google-services.json
  //   2. Pegar google-services.json en android/app/
  //   3. En server/.env agregar FIREBASE_SERVER_KEY=tu-key
  //   4. Descomentar este bloque y rebuild APK
  //
  // useEffect(() => {
  //   if (!(window as any).Capacitor) return
  //   import("@capacitor/push-notifications").then(({ PushNotifications }) => {
  //     PushNotifications.requestPermissions().then(perm => {
  //       if (perm.receive !== "granted") return
  //       PushNotifications.register()
  //       PushNotifications.addListener("registration", async ({ value: token }) => {
  //         const { data: { session } } = await supabase.auth.getSession()
  //         if (!session) return
  //         const igId = salaRef.current || await getIglesiaId()
  //         await supabase.from("tokens_push").upsert(
  //           { user_id: session.user.id, iglesia_id: igId, token, plataforma: "android", updated_at: new Date().toISOString() },
  //           { onConflict: "user_id,iglesia_id" }
  //         )
  //       })
  //       PushNotifications.addListener("pushNotificationReceived", notification => {
  //         if (notification.data?.tipo === "cancion") setAlertaVivo(true)
  //       })
  //     })
  //   }).catch(() => {})
  // }, [])

  // ── Modo: "repertorio" por defecto — funciona siempre sin servidor ────────
  const [modo, setModo] = useState<"vivo" | "repertorio">("repertorio")
  const [tunerAbierto, setTunerAbierto] = useState(false)
  const [cancionesRepo, setCancionesRepo] = useState<any[]>([])
  const [cargandoRepo, setCargandoRepo] = useState(false)
  const [busquedaRepo, setBusquedaRepo] = useState("")
  const [cancionRepo, setCancionRepo] = useState<any>(null)
  const [partesRepo, setPartesRepo] = useState<any[]>([])
  const [transposicionRepo, setTransposicionRepo] = useState(0)
  const [alertaVivo, setAlertaVivo] = useState(false)
  // ✅ Caché en memoria: evita re-fetchar partes al cambiar entre canciones
  const partesCacheRef = useRef<Map<string, any[]>>(new Map())  // nueva canción llegó mientras estaba en repertorio

  const cargarRepertorio = async () => {
    // ✅ Si el socket no conectó (músico fuera del WiFi de la iglesia),
    // obtener el iglesiaId directamente de Supabase / localStorage
    if (!salaRef.current) {
      try {
        const igId = await getIglesiaId()
        if (igId) salaRef.current = igId
      } catch {
        // Sin conexión a Supabase — intentar con el último iglesiaId guardado
        try {
          const guardado = localStorage.getItem("selah-ultima-iglesia")
          if (guardado) salaRef.current = guardado
        } catch { }
      }
    }
    // Guardar para uso offline futuro
    if (salaRef.current) {
      try { localStorage.setItem("selah-ultima-iglesia", salaRef.current) } catch { }
    }

    const igId = salaRef.current
    const CACHE_KEY_V2 = `selah-repo-canciones-v2-${igId || "global"}`

    // 1. Mostrar desde caché inmediatamente (funciona offline)
    try {
      const raw = localStorage.getItem(CACHE_KEY_V2)
      if (raw) {
        const cached = JSON.parse(raw)
        if (Array.isArray(cached) && cached.length > 0) {
          setCancionesRepo(ocultarGlobalesConCopia(cached))
          if (!navigator.onLine) return
        }
      }
    } catch { }

    // 2. Si hay conexión → refrescar desde Supabase
    if (!navigator.onLine) return
    // ✅ Si Supabase falló hace poco, no repetir el intento ahora — ya se
    // está mostrando el repertorio cacheado, no vale la pena martillar un
    // servicio que sabemos caído (solo ensucia la consola con timeouts).
    if (supabaseProbablementeCaido()) return
    setCargandoRepo(cancionesRepo.length === 0)
    try {
      const filtro = igId
        ? `iglesia_id.eq.${igId},iglesia_id.is.null`
        : `iglesia_id.is.null`

      // ✅ Paginación — Supabase corta en 1000 por defecto
      const PAGINA = 1000
      let todas: any[] = []
      let desde = 0
      let continuar = true
      while (continuar) {
        const { data, error } = await supabase
          .from("canciones")
          .select("id, titulo, tono, categoria, numero, iglesia_id")
          .or(filtro)
          .is("eliminado_en", null)
          .order("numero", { ascending: true, nullsFirst: false })
          .range(desde, desde + PAGINA - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        todas = todas.concat(data)
        continuar = data.length === PAGINA
        desde += PAGINA
      }

      marcarSupabaseOk()
      if (todas.length > 0) {
        // Invalidar caché viejo cambiando la clave
        const CACHE_KEY_V2 = `selah-repo-canciones-v2-${igId || "global"}`
        setCancionesRepo(ocultarGlobalesConCopia(todas))
        try { localStorage.setItem(CACHE_KEY_V2, JSON.stringify(todas)) } catch { }
      }
    } catch { marcarSupabaseCaido() }
    setCargandoRepo(false)
  }

  const verCancion = async (cancion: any) => {
    setCancionRepo(cancion)
    setTransposicionRepo(0)

    // ✅ 1. Caché en memoria (instantáneo dentro de la sesión)
    if (partesCacheRef.current.has(cancion.id)) {
      setPartesRepo(partesCacheRef.current.get(cancion.id)!)
      return
    }

    // ✅ 2. Caché en localStorage (funciona offline)
    const CACHE_KEY = `selah-repo-partes-${cancion.id}`
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        if (Array.isArray(cached) && cached.length > 0) {
          partesCacheRef.current.set(cancion.id, cached)
          setPartesRepo(cached)
          if (!navigator.onLine) return
        }
      }
    } catch { /* ignorar */ }

    // ✅ 3. Fetch desde Supabase y guardar en caché
    if (!navigator.onLine) { setPartesRepo([]); return }
    setPartesRepo([])
    try {
      const { data } = await supabase
        .from("partes_cancion")
        .select("tipo, texto, texto_letra, texto_acordes, tiene_acordes, orden")
        .eq("cancion_id", cancion.id)
        .order("orden")
      const partes = data || []
      partesCacheRef.current.set(cancion.id, partes)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(partes)) } catch { /* ignorar */ }
      setPartesRepo(partes)
    } catch { setPartesRepo([]) }
  }

  const abrirRepertorio = () => {
    setModo("repertorio")
    setAlertaVivo(false)
    cargarRepertorio()
  }

  const volverVivo = () => {
    setModo("vivo")
    setAlertaVivo(false)
    setCancionRepo(null)
    setPartesRepo([])
  }

  const notasLatinas = [
    "Do", "Do#", "Re", "Re#", "Mi", "Fa",
    "Fa#", "Sol", "Sol#", "La", "La#", "Si"
  ]

  // ── Detectar móvil ────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setEsMovil(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let activo = true
    // ✅ El socket vive acá afuera para poder cerrarlo en el cleanup REAL del
    // efecto. Antes el `return () => s.disconnect()` estaba dentro del .then(),
    // así que retornaba del callback de la promesa y no se ejecutaba jamás: el
    // socket quedaba abierto para siempre (y al recrearlo se acumulaban).
    let socketLocal: any = null
    const dev = process.env.NODE_ENV === "development"

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return
      const s = io(getSocketUrl(), {
        auth: { token: session?.access_token || "" }
      })
      socketLocal = s

      s.on("connect", async () => {
        try {
          socketConectadoRef.current = true
          // ✅ Confirmar y cerrar el panel: antes el "feedback" de que había
          // conectado era la recarga de la página. Sin recarga hay que avisar.
          setMsgConexion("✅ Conectado con el computador")
          setPanelConexion(false)
          if (!salaRef.current) salaRef.current = (await getIglesiaId()) || "global"
          if (!activo) return
          const sala = salaRef.current
          // ✅ Enviar el PIN de sala compartido (igual que Canciones/Control):
          // si la iglesia tiene PIN, un músico que no lo mandara quedaba
          // rechazado en silencio. Se lee del cache que escribe AppContext.
          const pin = (typeof window !== "undefined" && localStorage.getItem("selah-sala-pin")) || undefined
          // ✅ No cambiar a modo cargando — el repertorio ya está visible
          s.emit("unirse-sala", { sala, pantalla: "musicos", pin })
          s.emit("get-estado")
        } catch (err) {
          if (dev) console.error("❌ Error en connect músicos:", err)
        }
      })

      s.on("connect_error", () => {
        if (!activo) return
        setMsgConexion("No se pudo conectar. Revisa que Selah Live esté abierto en el PC y que estén en la misma red WiFi.")
      })

      // ✅ Rechazo por PIN visible (antes era silencioso en Músicos).
      s.on("pin-invalido", (data: { mensaje?: string }) => {
        if (!activo) return
        setMsgConexion("🔒 " + (data?.mensaje || "PIN de sala incorrecto. Pídele el PIN al encargado."))
      })

    s.on("estado-actual", (estado: any) => {
      socketConectadoRef.current = true
      if (estado?.tipo !== "cancion") return
      const data = estado.data || {}
      setPartes(data.partes || [])
      setIndex(data.index || 0)
      setTitulo(data.titulo || "")
      setTono(data.tono || "")
      // ✅ Notificar sin cambiar de modo — el músico decide si ver en vivo
      setAlertaVivo(true)
    })

    s.on("cargar-cancion", (data: any) => {
      socketConectadoRef.current = true
      setPartes(data.partes || [])
      setIndex(0)
      setTitulo(data.titulo || "")
      setTono(data.tono || "")
      setTransposicion(0)
      setAlertaVivo(true)
    })

    s.on("cambiar-parte", (i: number) => setIndex(i))
    })

    return () => { activo = false; socketLocal?.disconnect() }
  }, [versionConexion])

  // ── Supabase Realtime — para músicos fuera del WiFi de la iglesia ─────────
  // ✅ Antes esta suscripción apuntaba a una tabla que nunca se creó (nadie
  // la escribía) -- por eso nunca funcionó. Ahora control.tsx sí publica ahí
  // en cada cambio de canción/parte (ver control/page.tsx).
  useEffect(() => {
    let channel: any = null
    let activo = true

    const aplicarFila = (d: any) => {
      if (!d || d.tipo !== "cancion") return
      if (socketConectadoRef.current) return
      setPartes(d.partes || [])
      setIndex(d.index || 0)
      setTitulo(d.titulo || "")
      setTono(d.tono || "")
      setTransposicion(0)
      setAlertaVivo(true)
    }

    const suscribir = async () => {
      const igId = await getIglesiaId()
      if (!igId || !activo) return

      // ✅ Estado inicial: Realtime solo empuja CAMBIOS a partir de ahora --
      // si la canción ya estaba activa antes de abrir esta pantalla, sin esto
      // no se ve nada hasta el próximo cambio de parte.
      const { data } = await supabase.from("estado_culto").select("*").eq("iglesia_id", igId).maybeSingle()
      if (activo && data) aplicarFila(data)

      // ✅ Nombre único por sesión para evitar reusar canal ya suscrito
      const nombreCanal = `estado_culto_${igId}_${Date.now()}`

      channel = supabase
        .channel(nombreCanal)
        .on("postgres_changes", {
          event: "*", // ✅ INSERT (primera vez) y UPDATE (el resto)
          schema: "public",
          table: "estado_culto",
          filter: `iglesia_id=eq.${igId}`
        }, (payload: any) => { if (activo) aplicarFila(payload.new) })
        .subscribe((status: string, err: any) => {
          // ✅ Antes la suscripción fallaba en silencio: si Realtime rechazaba
          // (RLS, tabla no publicada, etc.) el músico no se enteraba de por qué
          // "no llega la letra en vivo". Ahora se registra.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("⚠️ Realtime estado_culto:", status, err?.message || "")
            import("@/lib/Errorlogger").then(({ logError }) =>
              logError(`Realtime estado_culto ${status}: ${err?.message || ""}`, { tipo: "supabase", pagina: "/musicos" })
            ).catch(() => {})
          }
        })
    }

    suscribir()
    return () => {
      activo = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  // ── Transposición ─────────────────────────────────────────────────────────
  const transponerAcorde = (acorde: string, pasos: number) => {
    const acordeLatino = convertirEscala(acorde, false)
    const match = acordeLatino.match(/^(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si)(.*)$/)
    if (!match) return acorde
    const base = match[1]
    const resto = match[2] || ""
    const idx = notasLatinas.indexOf(base)
    if (idx === -1) return acorde
    const nuevo = (idx + pasos + 12) % 12
    const resultado = notasLatinas[nuevo] + resto
    return usarAmericano ? convertirEscala(resultado, true) : resultado
  }

  const convertirEscala = (acorde: string, aAmericano: boolean): string => {
    const mapaLatinoAAmericano: Record<string, string> = {
      Do: "C", "Do#": "C#", Re: "D", "Re#": "D#",
      Mi: "E", Fa: "F", "Fa#": "F#", Sol: "G",
      "Sol#": "G#", La: "A", "La#": "A#", Si: "B"
    }
    const mapaAmericanoALatino: Record<string, string> = {
      C: "Do", "C#": "Do#", D: "Re", "D#": "Re#",
      E: "Mi", F: "Fa", "F#": "Fa#", G: "Sol",
      "G#": "Sol#", A: "La", "A#": "La#", B: "Si"
    }
    const mapa = aAmericano ? mapaLatinoAAmericano : mapaAmericanoALatino
    const match = acorde.match(/^(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|[A-G])(.*)$/)
    if (!match) return acorde
    const base = match[1]
    const resto = match[2] || ""
    return (mapa[base] || base) + resto
  }

  const limpiarTokenAcorde = (token: string) =>
    (token || "").trim().replace(/[.,;:]+$/g, "")

  const esAcorde = (token: string) => {
    const t = limpiarTokenAcorde(token)
    return /^((Do|Re|Mi|Fa|Sol|La|Si)|[A-G])(#|b)?(m|maj|min|sus|dim|aug|add|°|ø)?[0-9]*(maj7|m7|sus2|sus4|add9|dim7|m7b5)?(\/((Do|Re|Mi|Fa|Sol|La|Si)|[A-G])(#|b)?)?$/i.test(t)
  }

  const esAcordeOTextoDeAcordes = (linea: string) => {
    const tokens = (linea || "").replace(/\u00A0/g, " ").trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return false
    return tokens.every(token => esAcorde(limpiarTokenAcorde(token)))
  }

  const transponerLinea = (linea: string, pasos: number) =>
    linea.replace(/\S+/g, token => {
      const limpio = limpiarTokenAcorde(token)
      if (!esAcorde(limpio)) return token
      return token.replace(limpio, transponerAcorde(limpio, pasos))
    })

  // ── Parser de acordes ─────────────────────────────────────────────────────
  const detectarFormato = (texto: string) => {
    const lineas = texto.replace(/\r/g, "").split("\n").map(l => l.trimEnd())
    const resultado: any[] = []

    for (let i = 0; i < lineas.length; i++) {
      const actual = lineas[i] || ""
      const siguiente = lineas[i + 1] || ""
      if (!actual.trim()) continue

      if (actual.includes("[")) {
        const acordes: any[] = []
        const letra = actual.replace(/\[(.*?)\]/g, "")
        const regex = /\[(.*?)\]/g
        let match
        while ((match = regex.exec(actual)) !== null) {
          const antes = actual.slice(0, match.index).replace(/\[(.*?)\]/g, "")
          acordes.push({ acorde: match[1], pos: antes.length })
        }
        resultado.push({ tipo: "corchete", acordes, letra })
        continue
      }

      if (esAcordeOTextoDeAcordes(actual) && siguiente.trim() && !esAcordeOTextoDeAcordes(siguiente)) {
        resultado.push({ tipo: "linea", acordes: actual, letra: siguiente })
        i++
        continue
      }

      resultado.push({ tipo: "solo", letra: actual })
    }

    return resultado
  }

  // ── Parte actual ──────────────────────────────────────────────────────────
  const parteActual = partes[index] || null
  // ✅ Con acordes visibles: usar texto_acordes (la letra con los acordes
  // encima). Con acordes ocultos: usar la LETRA LIMPIA (texto_letra) en vez de
  // esconder los acordes del texto_acordes -- porque a veces los acordes están
  // mal o desalineados y la letra sacada de ahí sale distinta a la real.
  const textoActual = (mostrarAcordes && parteActual?.tiene_acordes && parteActual?.texto_acordes)
  ? parteActual.texto_acordes
  : parteActual?.texto_letra || parteActual?.texto || ""
  const tipoActual = parteActual?.tipo || ""
  const bloque = detectarFormato(textoActual)
  const totalLineasParte = bloque.length
  const hayAcordesVisibles = mostrarAcordes && bloque.some(
    l => l.tipo === "corchete" || l.tipo === "linea" ||
      (l.tipo === "solo" && esAcordeOTextoDeAcordes(l.letra))
  )

  // ── Tamaños de fuente adaptativos ─────────────────────────────────────────
  const calcFontSize = () => {
    if (esMovil) {
      if (totalLineasParte <= 2) return hayAcordesVisibles ? "28px" : "34px"
      if (totalLineasParte <= 4) return hayAcordesVisibles ? "22px" : "28px"
      if (totalLineasParte <= 6) return hayAcordesVisibles ? "18px" : "22px"
      return "15px"
    }
    if (totalLineasParte <= 2) return hayAcordesVisibles ? "clamp(28px,3.5vw,52px)" : "clamp(32px,4vw,62px)"
    if (totalLineasParte <= 4) return hayAcordesVisibles ? "clamp(22px,2.8vw,42px)" : "clamp(26px,3.2vw,50px)"
    if (totalLineasParte <= 6) return hayAcordesVisibles ? "clamp(18px,2.2vw,34px)" : "clamp(20px,2.5vw,38px)"
    return "clamp(14px,1.8vw,26px)"
  }

  const calcFontSizeAcordes = () => {
    if (esMovil) {
      return totalLineasParte <= 4 ? "14px" : "12px"
    }
    return totalLineasParte <= 4 ? "clamp(13px,1.1vw,18px)" : "clamp(11px,0.9vw,15px)"
  }

  const fontSizeLetra = calcFontSize()
  const fontSizeAcordes = calcFontSizeAcordes()

  // ── Etiqueta parte ────────────────────────────────────────────────────────
  const etiquetaParte = (() => {
    if (!tipoActual) return `${index + 1} / ${partes.length}`
    const contadores: Record<string, number> = {}
    let etiqueta = ""
    for (let i = 0; i <= index; i++) {
      const tipo = partes[i]?.tipo || ""
      contadores[tipo] = (contadores[tipo] || 0) + 1
      if (i === index) etiqueta = `${tipo} ${contadores[tipo]}`
    }
    return `${etiqueta} · ${index + 1}/${partes.length}`
  })()

  // ── Tono mostrado ─────────────────────────────────────────────────────────
  const tonoMostrado = (() => {
    if (!tono) return ""
    const tonoLatino = convertirEscala(tono, false)
    const tonoTranspuesto = transponerAcorde(tonoLatino, transposicion)
    return usarAmericano ? convertirEscala(tonoTranspuesto, true) : tonoTranspuesto
  })()

  // ── Render acordes ────────────────────────────────────────────────────────
  const renderAcordeChip = (acorde: string, key?: any, compacto = false, transposicionOverride?: number) => {
    const limpio = limpiarTokenAcorde(acorde)
    const pasos = transposicionOverride ?? transposicion
    const texto = convertirEscala(transponerAcorde(limpio, pasos), usarAmericano)
    return (
      <span key={key} style={{
        display: "inline-block",
        padding: compacto ? "2px 7px" : "3px 10px",
        borderRadius: "7px",
        background: "rgba(34,197,94,0.18)",
        border: "1px solid rgba(34,197,94,0.38)",
        color: "#86efac",
        fontWeight: 900,
        fontSize: fontSizeAcordes,
        fontFamily: "'Courier New', monospace",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        margin: "1px 2px"
      }}>
        {texto}
      </span>
    )
  }

  const renderLineaAcordesChips = (linea: string) => {
    const tokens = (linea || "").replace(/\u00A0/g, " ").trim().split(/\s+/).filter(Boolean)
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "6px", flexWrap: "wrap", marginBottom: "8px"
      }}>
        {tokens.map((token, i) => renderAcordeChip(token, i, totalLineasParte > 4))}
      </div>
    )
  }

  // ── GUARD SSR ─────────────────────────────────────────────────────────────
  // ✅ Esta página depende 100% del cliente (socket, localStorage, navigator).
  //    Renderizar solo tras montar elimina todos los hydration mismatch.
  if (!mounted) {
    return <div style={{ width: "100vw", height: "100dvh", background: "#03080f" }} />
  }

  // ── MODO REPERTORIO → ir directo, sin pasar por pantalla de espera ────────
  if (modo === "repertorio") {
    // (el JSX del repertorio está abajo, se llega por el return principal)
  }

  // ── PANTALLA DE ESPERA (solo en modo vivo sin canción) ────────────────────
  if (modo === "vivo" && !partes.length) {
    return (
      <div style={{
        width: "100vw", height: "100dvh",
        background: "radial-gradient(circle at 50% 30%, rgba(34,197,94,0.18), transparent 40%), linear-gradient(180deg, #020617 0%, #111827 100%)",
        color: "white", display: "flex", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        padding: "24px", boxSizing: "border-box",
        fontFamily: "'Segoe UI', system-ui, sans-serif"
      }}>
        <div>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎸</div>
          <div style={{ fontSize: "clamp(26px,4vw,52px)", fontWeight: 900, marginBottom: 10 }}>
            Pantalla de Músicos
          </div>
          <div style={{ fontSize: "clamp(14px,1.6vw,22px)", opacity: 0.55 }}>
            Esperando canción [v2]...
          </div>
        </div>
      </div>
    )
  }

  // ── PANTALLA PRINCIPAL ────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100vw", height: "100dvh",
      background: "#03080f",
      color: "white",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      boxSizing: "border-box",
      position: "relative"
    }}>
      <style>{`
        .scroll-musicos::-webkit-scrollbar { display: none }
        .ctrl-m { transition: all 0.12s }
        .ctrl-m:active { transform: scale(0.92) }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: esMovil ? "12px 14px 8px" : "14px 24px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", gap: 12
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 900,
            fontSize: esMovil ? "clamp(14px,3.5vw,20px)" : "clamp(20px,2.5vw,32px)",
            lineHeight: 1.15,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: "white", minWidth: 0
          }}>
            {modo === "repertorio"
              ? (cancionRepo ? cancionRepo.titulo : "Repertorio")
              : (titulo || "Sin título")}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
            {modo === "repertorio" ? (
              cancionRepo?.tono && (
                <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.28)", color: "#a5b4fc", fontSize: esMovil ? 11 : 13, fontWeight: 800 }}>
                  🎵 {cancionRepo.tono}
                </span>
              )
            ) : (<>
            {/* Etiqueta parte */}
            <span style={{
              padding: "3px 10px", borderRadius: 999,
              background: "rgba(34,197,94,0.14)",
              border: "1px solid rgba(34,197,94,0.28)",
              color: "#86efac", fontSize: esMovil ? 11 : 13, fontWeight: 800
            }}>
              {etiquetaParte}
            </span>

            {/* Tono */}
            {tonoMostrado && (
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: esMovil ? 11 : 13, fontWeight: 700, opacity: 0.85
              }}>
                🎵 {tonoMostrado}
                {transposicion !== 0 && (
                  <span style={{ color: "#fbbf24", marginLeft: 4 }}>
                    ({transposicion > 0 ? "+" : ""}{transposicion})
                  </span>
                )}
              </span>
            )}
            </>)}
          </div>
        </div>

        {/* Botón Repertorio */}
        <button
          className="ctrl-m"
          onClick={() => modo === "repertorio" ? volverVivo() : abrirRepertorio()}
          style={{
            padding: "0 14px", height: esMovil ? 44 : 52,
            borderRadius: 12, border: `1px solid ${modo === "repertorio" ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.12)"}`,
            background: modo === "repertorio" ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0, position: "relative"
          }}
        >
          {modo === "repertorio"
            ? (esMovil ? "← Vivo" : "← En vivo")
            : (esMovil ? "📚" : "📚 Repertorio")}
          {alertaVivo && modo === "repertorio" && (
            <div style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />
          )}
        </button>

        {/* ── Botón Afinador ── */}
        <button
          onClick={() => setTunerAbierto(v => !v)}
          title="Afinador en tiempo real"
          style={{
            width: esMovil ? 44 : 52, height: esMovil ? 44 : 52,
            borderRadius: 12, border: `1px solid ${tunerAbierto ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.12)"}`,
            background: tunerAbierto ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.07)",
            color: "white", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}
        >🎙️</button>

        {/* Botón abrir panel */}
        <button
          className="ctrl-m"
          onClick={() => setPanelAbierto(v => !v)}
          style={{
            width: esMovil ? 44 : 52, height: esMovil ? 44 : 52,
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
            background: panelAbierto ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
            color: "white", fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}
        >⚙️</button>
      </div>

      {/* ── MODAL AFINADOR ─────────────────────────────────────────────────── */}
      {tunerAbierto && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          padding: "0 0 20px"
        }} onClick={() => setTunerAbierto(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 420,
            background: "rgba(10,18,38,0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px 20px 16px 16px",
            padding: "6px 0 0",
            fontFamily: "'Segoe UI',system-ui,sans-serif"
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }}/>

            {/* Tono de la canción actual */}
            {(cancionRepo?.tono || tono) && (
              <div style={{ textAlign: "center", marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Canción en tono: <span style={{ color: "#a5b4fc", fontWeight: 800, fontSize: 15 }}>
                  {cancionRepo?.tono || tono}
                </span>
              </div>
            )}

            {/* PitchDetector */}
            <PitchDetector
              onDetectar={(nota) => {
                // Comparar con tono de la canción
                const tonoCancion = cancionRepo?.tono || tono
                if (tonoCancion && nota && tonoCancion.startsWith(nota)) {
                  // Están en el mismo tono — feedback visual manejado por el componente
                }
              }}
              style={{
                borderRadius: "0 0 16px 16px",
                border: "none",
                background: "transparent"
              }}
            />

            <div style={{ textAlign: "center", padding: "8px 16px 16px", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              Toca cualquier nota — la app detecta el tono en tiempo real
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL DE CONTROLES (overlay) ────────────────────────────────────── */}
      {panelAbierto && (
        <div
          onClick={() => setPanelAbierto(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute",
              top: esMovil ? 0 : 80,
              right: 0,
              width: esMovil ? "100%" : 320,
              height: esMovil ? "auto" : "auto",
              background: "rgba(10,20,40,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: esMovil ? "0 0 20px 20px" : "0 0 0 20px",
              padding: 20,
              display: "flex", flexDirection: "column", gap: 16
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>⚙️ Controles</div>

            {/* Transposición */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Transposición: {transposicion > 0 ? "+" : ""}{transposicion} semitonos
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ctrl-m"
                  onClick={() => setTransposicion(t => t - 1)}
                  style={btnPanelStyle}>
                  ▼ Bajar
                </button>
                <button className="ctrl-m"
                  onClick={() => setTransposicion(0)}
                  style={{ ...btnPanelStyle, background: "rgba(255,255,255,0.06)", flex: "none", padding: "11px 14px" }}>
                  Reset
                </button>
                <button className="ctrl-m"
                  onClick={() => setTransposicion(t => t + 1)}
                  style={btnPanelStyle}>
                  ▲ Subir
                </button>
              </div>
            </div>

            {/* Acordes ON/OFF */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Acordes
              </div>
              <button className="ctrl-m"
                onClick={() => setMostrarAcordes(v => !v)}
                style={{
                  ...btnPanelStyle,
                  width: "100%",
                  background: mostrarAcordes ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${mostrarAcordes ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.1)"}`,
                  color: mostrarAcordes ? "#86efac" : "rgba(255,255,255,0.6)"
                }}>
                {mostrarAcordes ? "🎸 Acordes visibles" : "🎸 Acordes ocultos"}
              </button>
            </div>

            {/* Escala */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Escala de acordes
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ctrl-m"
                  onClick={() => setUsarAmericano(false)}
                  style={{
                    ...btnPanelStyle, flex: 1,
                    background: !usarAmericano ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${!usarAmericano ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.1)"}`,
                    color: !usarAmericano ? "#93c5fd" : "rgba(255,255,255,0.6)"
                  }}>
                  Latina
                </button>
                <button className="ctrl-m"
                  onClick={() => setUsarAmericano(true)}
                  style={{
                    ...btnPanelStyle, flex: 1,
                    background: usarAmericano ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${usarAmericano ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.1)"}`,
                    color: usarAmericano ? "#93c5fd" : "rgba(255,255,255,0.6)"
                  }}>
                  Americana
                </button>
              </div>
            </div>

            <button className="ctrl-m"
              onClick={() => setPanelAbierto(false)}
              style={{ ...btnPanelStyle, background: "rgba(255,255,255,0.05)", marginTop: 4 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── PANEL REPERTORIO ────────────────────────────────────────────────── */}
      {modo === "repertorio" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#03080f" }}>

          {/* Alerta: nueva canción en vivo */}
          {mounted && alertaVivo && partes.length > 0 && (
            <button onClick={volverVivo} style={{ flexShrink: 0, padding: "12px 20px", background: "rgba(34,197,94,0.15)", border: "none", borderBottom: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.8)", flexShrink: 0 }} />
              Nueva canción en vivo: <b>{titulo}</b> — tap para verla
            </button>
          )}

          {/* ✅ Aviso sin conexión con instrucciones claras */}
          {mounted && !socketConectadoRef.current && (
            <div style={{ flexShrink: 0, background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.15)" }}>
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600, flex: 1 }}>
                  {!navigator.onLine
                    ? "Sin internet · Mostrando canciones guardadas"
                    : "Sin conexión al servidor"}
                </span>
                <button onClick={() => setPanelConexion(v => !v)} style={{
                  padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)",
                  background: "rgba(251,191,36,0.1)", color: "#fbbf24",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0
                }}>⚙️ Conectar</button>
              </div>
              {/* ✅ Panel de conexión inline (el músico no va a Configuración) */}
              {panelConexion && navigator.onLine && (
                <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={buscarYConectar} disabled={buscandoServidor} style={{
                    padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)",
                    background: "rgba(251,191,36,0.12)", color: "#fbbf24", fontSize: 12, fontWeight: 700,
                    cursor: buscandoServidor ? "default" : "pointer", opacity: buscandoServidor ? 0.6 : 1, textAlign: "left"
                  }}>{buscandoServidor ? "🔍 Buscando..." : "🔍 Buscar el computador automáticamente"}</button>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={ipManual} onChange={e => setIpManual(e.target.value)}
                      placeholder="o escribe la IP (ej: 192.168.1.50)"
                      onKeyDown={e => { if (e.key === "Enter") conectarConIp(ipManual) }}
                      style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "7px 10px", color: "white", fontSize: 12 }}
                      inputMode="decimal" />
                    <button onClick={() => conectarConIp(ipManual)} disabled={!ipManual.trim()} style={{
                      padding: "7px 12px", borderRadius: 8, border: "none", background: "#2563eb", color: "white",
                      fontSize: 12, fontWeight: 700, cursor: ipManual.trim() ? "pointer" : "default", opacity: ipManual.trim() ? 1 : 0.5
                    }}>Conectar</button>
                  </div>
                  {msgConexion && <div style={{ fontSize: 11, color: "rgba(251,191,36,0.75)", lineHeight: 1.5 }}>{msgConexion}</div>}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* ── Lista de canciones ── */}
            <div style={{ width: cancionRepo && !esMovil ? 340 : "100%", display: cancionRepo && esMovil ? "none" : "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", background: "#060d1a" }}>
              {/* Buscador */}
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "rgba(0,0,0,0.3)" }}>
                <input
                  value={busquedaRepo}
                  onChange={e => setBusquedaRepo(e.target.value)}
                  placeholder="🔍  Buscar por título, número, tono..."
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  autoComplete="off" autoCorrect="off" autoCapitalize="off"
                />
                {busquedaRepo.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    {(() => {
                      const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      const q = norm(busquedaRepo)
                      const esNumero = /^\d+$/.test(q)
                      const matchNum = q.match(/^(\d+)\s+(.+)$/)
                      return cancionesRepo.filter(c => {
                        const titulo = norm(c.titulo)
                        const numero = String(c.numero || "")
                        if (!q) return true
                        if (matchNum) return numero === matchNum[1] || titulo.includes(matchNum[2])
                        if (esNumero) return numero === q || numero.startsWith(q)
                        return titulo.includes(q) || norm(c.categoria || "").includes(q)
                      }).length
                    })()} resultados
                  </div>
                )}
              </div>

              {/* Lista */}
              <div className="scroll-musicos" style={{ flex: 1, overflowY: "auto" }}>
                {cargandoRepo ? (
                  <div style={{ padding: 40, textAlign: "center", opacity: 0.35, fontSize: 14 }}>Cargando repertorio...</div>
                ) : (() => {
                  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                  const q = norm(busquedaRepo)
                  const esNumero      = /^\d+$/.test(q)
                  const matchNumTexto = q.match(/^(\d+)\s+(.+)$/)
                  const numParte      = matchNumTexto?.[1] || ""
                  const textoParte    = matchNumTexto?.[2] || ""

                  const filtradas = cancionesRepo
                    .map(c => {
                      if (!q) return { c, score: 0, pass: true }
                      const titulo = norm(c.titulo)
                      const numero = String(c.numero || "")

                      if (matchNumTexto) {
                        const numOk    = numero === numParte || numero.startsWith(numParte)
                        const tituloOk = titulo.includes(textoParte)
                        if (numOk && tituloOk) return { c, score: 100, pass: true }
                        if (numOk)             return { c, score: 80,  pass: true }
                        if (tituloOk)          return { c, score: 60,  pass: true }
                        return { c, score: 0, pass: false }
                      }
                      if (esNumero) {
                        if (numero === q)          return { c, score: 100, pass: true }
                        if (numero.startsWith(q))  return { c, score: 80,  pass: true }
                        return { c, score: 0, pass: false }
                      }
                      if (titulo === q)            return { c, score: 100, pass: true }
                      if (titulo.startsWith(q))    return { c, score: 90,  pass: true }
                      if (titulo.includes(q))      return { c, score: 70,  pass: true }
                      if (norm(c.categoria || "").includes(q)) return { c, score: 30, pass: true }
                      return { c, score: 0, pass: false }
                    })
                    .filter(x => x.pass)
                    .sort((a, b) => q ? b.score - a.score || (a.c.numero ?? 999999) - (b.c.numero ?? 999999) : 0)
                    .map(x => x.c)
                  if (filtradas.length === 0) return (
                    <div style={{ padding: 40, textAlign: "center", opacity: 0.3, fontSize: 14 }}>Sin resultados</div>
                  )
                  return filtradas.map(c => {
                    const activa = cancionRepo?.id === c.id
                    return (
                      <button key={c.id} onClick={() => verCancion(c)} style={{ width: "100%", padding: "11px 16px", background: activa ? "rgba(37,99,235,0.18)" : "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: `3px solid ${activa ? "#3b82f6" : "transparent"}`, color: "white", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Número */}
                        {c.numero && (
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: activa ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: activa ? "#93c5fd" : "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                            {c.numero}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: activa ? "#e2e8f0" : "white" }}>
                            {c.titulo}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            {c.tono && (
                              <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 5, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", fontWeight: 700 }}>
                                {c.tono}
                              </span>
                            )}
                            {c.categoria && (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                                {c.categoria}
                              </span>
                            )}
                          </div>
                        </div>
                        {activa && <div style={{ color: "#3b82f6", fontSize: 18, flexShrink: 0 }}>›</div>}
                      </button>
                    )
                  })
                })()}
              </div>
            </div>

            {/* ── Detalle de canción ── */}
            {cancionRepo && (
              <div className="scroll-musicos" style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#060d1a" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                  {esMovil && (
                    <button onClick={() => setCancionRepo(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", padding: "2px 0 0", flexShrink: 0 }}>←</button>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: esMovil ? 20 : 24, lineHeight: 1.2 }}>{cancionRepo.titulo}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {cancionRepo.numero && (
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd", fontWeight: 700 }}>
                          #{cancionRepo.numero}
                        </span>
                      )}
                      {cancionRepo.tono && (
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", fontWeight: 700 }}>
                          Tono {cancionRepo.tono}
                        </span>
                      )}
                      {cancionRepo.categoria && (
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                          {cancionRepo.categoria}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transposición */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginRight: 4 }}>Transponer:</span>
                  {[-2,-1,0,1,2].map(v => (
                    <button key={v} onClick={() => setTransposicionRepo(v)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${transposicionRepo === v ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.1)"}`, background: transposicionRepo === v ? "rgba(37,99,235,0.2)" : "transparent", color: transposicionRepo === v ? "#93c5fd" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {v === 0 ? "0" : v > 0 ? `+${v}` : v}
                    </button>
                  ))}
                </div>

                {/* Partes */}
                {partesRepo.length === 0 ? (
                  <div style={{ textAlign: "center", opacity: 0.3, paddingTop: 40 }}>Cargando partes...</div>
                ) : partesRepo.map((parte: any, pi: number) => {
                  const textoRender = (mostrarAcordes && parte.tiene_acordes && parte.texto_acordes)
                    ? parte.texto_acordes : parte.texto_letra || parte.texto || ""
                  const bloqueRepo = detectarFormato(textoRender)
                  return (
                    <div key={pi} style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.4, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                        {parte.tipo}
                      </div>
                      {bloqueRepo.map((linea: any, li: number) => (
                        <div key={li} style={{ marginBottom: 8 }}>
                          {linea.tipo === "corchete" && (
                            <div style={{ position: "relative", minHeight: 24, marginBottom: 4 }}>
                              {linea.acordes.map((a: any, ai: number) => (
                                <span key={ai} style={{ position: "absolute", left: `${a.pos}ch` }}>
                                  {renderAcordeChip(a.acorde, ai, true, transposicionRepo)}
                                </span>
                              ))}
                            </div>
                          )}
                          {linea.tipo === "linea" && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                              {linea.acordes.split(/\s+/).filter(Boolean).map((a: string, ai: number) =>
                                renderAcordeChip(a, ai, true, transposicionRepo)
                              )}
                            </div>
                          )}
                          <div style={{ fontSize: 16, lineHeight: 1.7 }}>
                            {linea.tipo === "corchete" ? linea.letra : linea.tipo === "linea" ? linea.letra : linea.letra}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Estado vacío: ninguna canción seleccionada en desktop */}
            {!cancionRepo && !esMovil && cancionesRepo.length > 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.25, flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 48 }}>📖</div>
                <div style={{ fontSize: 16 }}>Selecciona una canción</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ─────────────────────────────────────────────── */}
      <div
        className="scroll-musicos"
        style={{
          flex: 1,
          overflowY: "auto", overflowX: "hidden",
          scrollbarWidth: "none",
          display: modo === "vivo" ? "flex" : "none",
          justifyContent: "center",
          alignItems: totalLineasParte <= 6 ? "center" : "flex-start",
          padding: esMovil ? "16px 14px 100px" : "24px 40px 110px",
          boxSizing: "border-box"
        }}
      >
        <div style={{
          width: "100%",
          maxWidth: hayAcordesVisibles ? 1200 : 1000,
          display: "flex", flexDirection: "column",
          alignItems: "center", textAlign: "center"
        }}>
          {bloque.map((linea, i) => (
            <div key={i} style={{
              marginBottom: totalLineasParte <= 4 ? 12 : 8,
              width: "100%",
              display: "flex", flexDirection: "column", alignItems: "center"
            }}>

              {/* Formato corchetes: acordes posicionados sobre la letra */}
              {linea.tipo === "corchete" && (
                <>
                  {mostrarAcordes && (
                    <div style={{
                      position: "relative",
                      minHeight: totalLineasParte <= 4 ? 30 : 24,
                      marginBottom: 4,
                      fontSize: fontSizeAcordes,
                      display: "inline-block",
                      minWidth: `${Math.max((linea.letra || "").length, 1)}ch`,
                      maxWidth: "100%",
                      textAlign: "left"
                    }}>
                      {linea.acordes.map((a: any, j: number) => (
                        <span key={j} style={{ position: "absolute", left: `${a.pos}ch`, top: 0, whiteSpace: "nowrap" }}>
                          {renderAcordeChip(a.acorde, j, totalLineasParte > 4)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{
                    fontSize: fontSizeLetra,
                    lineHeight: totalLineasParte <= 4 ? 1.1 : 1.2,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    textAlign: hayAcordesVisibles ? "left" : "center",
                    display: "inline-block", maxWidth: "100%",
                    fontWeight: 500
                  }}>
                    {linea.letra}
                  </div>
                </>
              )}

              {/* Formato línea: acordes en fila arriba */}
              {linea.tipo === "linea" && (
                <>
                  {mostrarAcordes && renderLineaAcordesChips(linea.acordes)}
                  <div style={{
                    fontSize: fontSizeLetra, lineHeight: totalLineasParte <= 4 ? 1.1 : 1.2,
                    whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "center",
                    fontWeight: 500
                  }}>
                    {linea.letra}
                  </div>
                </>
              )}

              {/* Formato solo: solo letra (o línea de acordes sueltos) */}
              {linea.tipo === "solo" && (
                esAcordeOTextoDeAcordes(linea.letra) && mostrarAcordes
                  ? renderLineaAcordesChips(linea.letra)
                  : (
                    <div style={{
                      fontSize: fontSizeLetra, lineHeight: totalLineasParte <= 4 ? 1.1 : 1.2,
                      whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "center",
                      fontWeight: 500
                    }}>
                      {linea.letra}
                    </div>
                  )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── BARRA INFERIOR FIJA ──────────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        padding: esMovil ? "10px 14px 14px" : "12px 24px 16px",
        background: "rgba(3,8,15,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        display: modo === "repertorio" ? "none" : "flex",
        alignItems: "center", justifyContent: "space-between",
        gap: 10
      }}>
        {/* Transposición rápida */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ctrl-m"
            onClick={() => setTransposicion(t => t - 1)}
            style={btnBarraStyle(esMovil)}>
            ▼
          </button>

          <div style={{
            minWidth: esMovil ? 40 : 56, textAlign: "center",
            fontSize: esMovil ? 14 : 16, fontWeight: 800,
            color: transposicion !== 0 ? "#fbbf24" : "rgba(255,255,255,0.5)"
          }}>
            {transposicion > 0 ? "+" : ""}{transposicion}
          </div>

          <button className="ctrl-m"
            onClick={() => setTransposicion(t => t + 1)}
            style={btnBarraStyle(esMovil)}>
            ▲
          </button>
        </div>

        {/* Info centro */}
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: esMovil ? 11 : 13, fontWeight: 700, opacity: 0.7 }}>
            {etiquetaParte}
          </div>
          {tonoMostrado && (
            <div style={{ fontSize: esMovil ? 10 : 12, opacity: 0.45, marginTop: 2 }}>
              🎵 {tonoMostrado}
            </div>
          )}
        </div>

        {/* Acordes toggle + escala */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ctrl-m"
            onClick={() => setMostrarAcordes(v => !v)}
            style={{
              ...btnBarraStyle(esMovil),
              background: mostrarAcordes ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${mostrarAcordes ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: mostrarAcordes ? "#86efac" : "rgba(255,255,255,0.5)",
              fontSize: esMovil ? 13 : 14,
              padding: esMovil ? "9px 10px" : "10px 14px"
            }}>
            🎸
          </button>

          {!esMovil && (
            <button className="ctrl-m"
              onClick={() => setUsarAmericano(v => !v)}
              style={{
                ...btnBarraStyle(false),
                background: usarAmericano ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)",
                color: usarAmericano ? "#93c5fd" : "rgba(255,255,255,0.6)"
              }}>
              {usarAmericano ? "A" : "L"}
            </button>
          )}

          {transposicion !== 0 && (
            <button className="ctrl-m"
              onClick={() => setTransposicion(0)}
              style={{
                ...btnBarraStyle(esMovil),
                background: "rgba(251,191,36,0.15)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: "#fbbf24", fontSize: 11
              }}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const btnBarraStyle = (esMovil: boolean): React.CSSProperties => ({
  padding: esMovil ? "9px 12px" : "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.07)",
  color: "white",
  fontWeight: 800,
  fontSize: esMovil ? 15 : 16,
  cursor: "pointer",
  flexShrink: 0
})

const btnPanelStyle: React.CSSProperties = {
  flex: 1,
  padding: "11px 14px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.07)",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer"
}
