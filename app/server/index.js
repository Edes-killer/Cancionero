require("dotenv").config()
const http  = require("http")
const { Server } = require("socket.io")
const fs    = require("fs")
const path  = require("path")

const dev = process.env.NODE_ENV !== "production"
const log = (...args) => { if (dev) console.log(...args) }

// ── Auth via Supabase client ───────────────────────────────────────────────────
// Más robusto que verificar JWT manualmente: funciona con ECC (P-256) y HS256,
// y se actualiza solo si Supabase rota las claves.
// Requiere en .env: SUPABASE_URL y SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY)
let supabaseAdmin = null
try {
  const { createClient } = require("@supabase/supabase-js")
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)) {
    supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
    )
    log("🔐 Auth via Supabase client activo")
  }
} catch { log("⚠️  @supabase/supabase-js no disponible en server") }

// ── Persistencia de estado ────────────────────────────────────────────────────
const ESTADO_FILE = path.join(process.cwd(), "estado.json")
let estadosPorSala = {}

try {
  const raw = fs.readFileSync(ESTADO_FILE, "utf-8")
  const p = JSON.parse(raw)
  estadosPorSala = (p?.tipo && p?.data) ? { global: p } : (p || {})
  log("♻️  estados restaurados:", Object.keys(estadosPorSala))
} catch { log("⚠️  sin estado previo") }

// ✅ Escritura síncrona: garantiza que el estado se persiste antes de cualquier crash
const guardarEstados = () => {
  try { fs.writeFileSync(ESTADO_FILE, JSON.stringify(estadosPorSala, null, 2)) }
  catch (e) { console.error("❌ Error guardando estados:", e) }
}

const salaDe = (s) => s.data?.sala || "global"
const guardarEstadoSala = (sala, estado) => {
  estadosPorSala[sala] = estado
  guardarEstados()
}

// ── Firebase Cloud Messaging (opcional) ──────────────────────────────────────
// Configurar en .env: FIREBASE_SERVER_KEY=AAAAxxx... (Firebase Console > Project Settings > Cloud Messaging)
const FCM_KEY = process.env.FIREBASE_SERVER_KEY
const enviarPush = async (sala, titulo, tono) => {
  if (!FCM_KEY || !supabaseAdmin) return
  try {
    const { data: tokens } = await supabaseAdmin
      .from("tokens_push").select("token").eq("iglesia_id", sala)
    if (!tokens?.length) return
    const body = { titulo: titulo || "Nueva canción", tono: tono || "" }
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { "Authorization": `key=${FCM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_ids: tokens.map(t => t.token),
        notification: { title: body.titulo, body: body.tono ? `Tono ${body.tono}` : "En vivo ahora" },
        data: { tipo: "cancion", titulo: body.titulo, tono: body.tono }
      })
    })
  } catch (e) { log("❌ Error FCM:", e.message) }
}
const LIBROS = {
  genesis:"genesis",gen:"genesis",exodo:"exodo","éxodo":"exodo",ex:"exodo",
  levitico:"levitico","levítico":"levitico",lev:"levitico",numeros:"numeros",
  "números":"numeros",num:"numeros",deuteronomio:"deuteronomio",deut:"deuteronomio",
  dt:"deuteronomio",josue:"josue","josué":"josue",jos:"josue",jueces:"jueces",
  rut:"rut","1 samuel":"1_samuel","2 samuel":"2_samuel","1 reyes":"1_reyes",
  "2 reyes":"2_reyes","1 cronicas":"1_cronicas","1 crónicas":"1_cronicas",
  "2 cronicas":"2_cronicas","2 crónicas":"2_cronicas",esdras:"esdras",
  nehemias:"nehemias","nehemías":"nehemias",ester:"ester",job:"job",
  salmos:"salmos",salmo:"salmos",proverbios:"proverbios",eclesiastes:"eclesiastes",
  "eclesiastés":"eclesiastes",cantares:"cantares",isaias:"isaias","isaías":"isaias",
  jeremias:"jeremias","jeremías":"jeremias",lamentaciones:"lamentaciones",
  ezequiel:"ezequiel",daniel:"daniel",oseas:"oseas",joel:"joel",amos:"amos",
  abdias:"abdias","abdías":"abdias",jonas:"jonas","jonás":"jonas",miqueas:"miqueas",
  nahum:"nahum",habacuc:"habacuc",sofonias:"sofonias","sofonías":"sofonias",
  hageo:"hageo",zacarias:"zacarias","zacarías":"zacarias",malaquias:"malaquias",
  "malaquías":"malaquias",mateo:"mateo",marcos:"marcos",lucas:"lucas",juan:"juan",
  hechos:"hechos",romanos:"romanos","1 corintios":"1_corintios",
  "2 corintios":"2_corintios",galatas:"galatas","gálatas":"galatas",
  efesios:"efesios",filipenses:"filipenses",colosenses:"colosenses",
  "1 tesalonicenses":"1_tesalonicenses","2 tesalonicenses":"2_tesalonicenses",
  "1 timoteo":"1_timoteo","2 timoteo":"2_timoteo",tito:"tito",filemon:"filemon",
  "filemón":"filemon",hebreos:"hebreos",santiago:"santiago","1 pedro":"1_pedro",
  "2 pedro":"2_pedro","1 juan":"1_juan","2 juan":"2_juan","3 juan":"3_juan",
  judas:"judas",apocalipsis:"apocalipsis"
}
const norm = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim()
const limpiarT = t => t.replace(/\/n/g," ").replace(/\\n/g," ").replace(/\r?\n|\r/g," ").replace(/\s+/g," ").trim()

function partirEnPaginas(texto, max=650) {
  const ps = texto.split(" "), pags = []
  let cur = ""
  for (const p of ps) {
    const c = cur ? `${cur} ${p}` : p
    if (c.length > max) { if (cur) pags.push(cur); cur = p } else cur = c
  }
  if (cur) pags.push(cur)
  return pags
}

function parsearRef(ref) {
  const s = ref.trim()
  let m = s.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
  if (m) {
    const a = LIBROS[norm(m[1])]; if (!a) return null
    return { tipo:"rango", libroMostrar:m[1], archivo:a, capitulo:+m[2], versoInicio:+m[3], versoFin:m[4]?+m[4]:+m[3] }
  }
  m = s.match(/^(.+?)\s+(\d+)$/)
  if (m) { const a = LIBROS[norm(m[1])]; if (!a) return null; return { tipo:"capitulo", libroMostrar:m[1], archivo:a, capitulo:+m[2] } }
  return null
}

function cargarLibro(archivo) {
  const dirs = [
    path.join(process.cwd(),"data","biblia","procesados"),
    path.join(process.cwd(),"..","data","biblia","procesados"),
    path.join(__dirname,"..","data","biblia","procesados"),
  ]
  for (const dir of dirs) {
    for (const ext of [".js",".json"]) {
      try {
        const fp = path.join(dir, archivo+ext)
        if (!fs.existsSync(fp)) continue
        if (ext===".json") return JSON.parse(fs.readFileSync(fp,"utf8"))
        let c = fs.readFileSync(fp,"utf8").replace(/^\s*export\s+default\s+/,"module.exports = ").replace(/;\s*$/,"")
        const m = { exports:{} }; new Function("module","exports","require",c)(m,m.exports,require)
        const r = Array.isArray(m.exports)?m.exports:Object.values(m.exports)[0]
        if (r) return r
      } catch(e){ log("Intento fallido:", archivo, e.message) }
    }
  }
  return null
}

function buscarVersiculosLocal(referencia) {
  const ref = parsearRef(referencia)
  if (!ref) throw new Error("Referencia inválida. Ejemplo: Juan 3:16 o Salmo 23")
  const b = cargarLibro(ref.archivo)
  if (!b) throw new Error(`Libro no encontrado: ${ref.archivo}`)
  const cap = b[ref.capitulo-1]
  if (!cap) throw new Error(`No existe el capítulo ${ref.capitulo}`)
  if (ref.tipo==="capitulo") {
    const vs = cap.map((t,i)=>({numero:i+1,texto:limpiarT(t)}))
    const txt = vs.map(v=>`${v.numero}. ${v.texto}`).join(" ")
    return { referencia:referencia.toUpperCase(), texto:txt, versos:vs, paginas:partirEnPaginas(txt) }
  }
  const vs = []
  for (let i=ref.versoInicio;i<=ref.versoFin;i++) {
    const v=cap[i-1]; if(!v) throw new Error(`No existe el versículo ${i}`)
    vs.push({numero:i,texto:limpiarT(v)})
  }
  const txt = vs.map(v=>`${v.numero}. ${v.texto}`).join(" ")
  return { referencia:referencia.toUpperCase(), texto:txt, versos:vs, paginas:partirEnPaginas(txt) }
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
const server = http.createServer((req,res) => {
  res.setHeader("Access-Control-Allow-Origin","*")
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS")
  if (req.url==="/ping") {
    res.writeHead(200,{"Content-Type":"application/json"})
    res.end(JSON.stringify({ok:true,app:"selah-live",salas:Object.keys(estadosPorSala)}))
    return
  }
  if (req.url?.startsWith("/api/biblia/buscar")) {
    try {
      const ref = new URL(req.url,"http://localhost").searchParams.get("ref")
      if (!ref) { res.writeHead(400,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:"Falta parámetro ref"})); return }
      const r = buscarVersiculosLocal(ref)
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify(r))
    } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:e.message})) }
    return
  }
  res.writeHead(200); res.end("Servidor activo")
})

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, { cors:{ origin:"*" } })
const pinesPorSala = {}

// ✅ Auth middleware: verifica el token contra Supabase (ECC y HS256 ambos funcionan)
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token

  if (!token) {
    if (process.env.REQUIRE_AUTH === "true") {
      log("🔒 Conexión rechazada: sin token")
      return next(new Error("Unauthorized: falta token"))
    }
    return next()
  }

  if (supabaseAdmin) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      if (error || !user) {
        log("🔒 Token inválido:", error?.message)
        return next(new Error("Unauthorized: token inválido"))
      }
      socket.data.userId = user.id  // disponible en handlers
    } catch (e) {
      return next(new Error("Unauthorized"))
    }
  }

  next()
})

io.on("connection", socket => {
  log("📱 Cliente conectado:", socket.id)

  socket.on("unirse-sala", ({ sala, pantalla, pin }) => {
    const salaF = sala || "global"
    const panF  = pantalla || "desconocida"

    if (pantalla === "control" || pantalla === "canciones") {
      const pinG = pinesPorSala[salaF]
      if (pinG && String(pin || "") !== String(pinG)) {
        socket.emit("pin-invalido", { mensaje:"PIN incorrecto. Verifica en configuración." })
        return
      }
      if (!pinG && pin) pinesPorSala[salaF] = String(pin)
    }

    socket.data.sala = salaF
    socket.data.pantalla = panF
    socket.join(salaF)
    log(`🏠 ${socket.id} → ${salaF} | ${panF}`)

    if (panF === "control" && estadosPorSala[salaF]?.tipo === "cancion") {
      socket.emit("restaurar-estado-control", estadosPorSala[salaF].data)
    }

    // ✅ Notificar al control cuando el proyector se conecta
    if (panF === "proyectar") {
      socket.broadcast.to(salaF).emit("proyector-conectado")
    }
    // ✅ Enviar estado actual a músicos al conectarse
    if (panF === "musicos" && estadosPorSala[salaF]) {
      socket.emit("estado-actual", estadosPorSala[salaF])
    }
  })

  socket.on("cargar-cancion", data => {
    const sala = salaDe(socket)
    guardarEstadoSala(sala, { tipo:"cancion", data:{ ...data, index:data.index||0 } })
    io.to(sala).emit("cargar-cancion", data)
    enviarPush(sala, data?.titulo, data?.tono)
    // ✅ Supabase Realtime — músicos remotos sin WiFi de iglesia
    if (supabaseAdmin) {
      supabaseAdmin.from("estado_culto").upsert({
        iglesia_id: sala,
        tipo: "cancion",
        titulo: data?.titulo || "",
        tono: data?.tono || "",
        partes: data?.partes || [],
        index: data?.index || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: "iglesia_id" }).then(({ error }) => {
        if (error) log("❌ Error estado_culto:", error.message)
      })
    }
  })

  socket.on("cambiar-parte", index => {
    const sala = salaDe(socket)
    const est  = estadosPorSala[sala]
    if (est?.tipo === "cancion") { est.data.index = index; guardarEstadoSala(sala, est) }
    io.to(sala).emit("cambiar-parte", index)
    // ✅ Sincronizar índice en Supabase también
    if (supabaseAdmin) {
      supabaseAdmin.from("estado_culto")
        .update({ index, updated_at: new Date().toISOString() })
        .eq("iglesia_id", sala).then(() => {})
    }
  })

  socket.on("cancion-activa", data => io.to(salaDe(socket)).emit("cancion-activa", data))

  socket.on("mostrar-imagen", data => {
    const sala = salaDe(socket)
    guardarEstadoSala(sala, { tipo:"imagen", data })
    io.to(sala).emit("mostrar-imagen", data)
  })

  socket.on("mostrar-biblia", data => {
    const sala = salaDe(socket)
    guardarEstadoSala(sala, { tipo:"biblia", data:{ ...data, pagina:data.pagina||0 } })
    io.to(sala).emit("mostrar-biblia", data)
  })

  socket.on("cambiar-pagina-biblia", pagina => {
    const sala = salaDe(socket)
    const est  = estadosPorSala[sala]
    if (est?.tipo === "biblia") { est.data.pagina = pagina; guardarEstadoSala(sala, est) }
    io.to(sala).emit("cambiar-pagina-biblia", pagina)
  })

  socket.on("mostrar-estado", data => {
    const sala = salaDe(socket)
    guardarEstadoSala(sala, { tipo:"estado", data:{ ...data } })
    io.to(sala).emit("mostrar-estado", data)
  })

  socket.on("cambiar-fondo", fondo => {
    const sala = salaDe(socket)
    // Actualizar fondo en el estado guardado sin cambiar el tipo
    const est = estadosPorSala[sala]
    if (est) { est.data = { ...(est.data || {}), fondo }; guardarEstadoSala(sala, est) }
    socket.broadcast.to(sala).emit("cambiar-fondo", fondo)
  })

  socket.on("control-siguiente", () => socket.broadcast.to(salaDe(socket)).emit("control-siguiente"))
  socket.on("control-anterior",  () => socket.broadcast.to(salaDe(socket)).emit("control-anterior"))
  socket.on("precargar-imagenes", urls => io.to(salaDe(socket)).emit("precargar-imagenes", urls))

  // ✅ Zoom: control → proyector y proyector → control
  socket.on("ajustar-zoom", data => {
    const sala = salaDe(socket)
    io.to(sala).emit("ajustar-zoom", data)
  })
  socket.on("zoom-info", data => {
    const sala = salaDe(socket)
    io.to(sala).emit("zoom-info", data)
  })

  // ✅ Biblia via socket — más confiable que HTTP en APK/Electron
  socket.on("buscar-biblia", (ref, callback) => {
    try {
      const data = buscarVersiculosLocal(ref)
      callback(data)
    } catch(e) {
      callback({ error: e.message })
    }
  })

  // ✅ get-estado: devuelve estado guardado inmediatamente sin preguntar al control
  socket.on("get-estado", () => {
    const sala = salaDe(socket)
    if (estadosPorSala[sala]) {
      socket.emit("estado-actual", estadosPorSala[sala])
    } else {
      socket.broadcast.to(sala).emit("proyectar-solicita-estado")
    }
  })

  socket.on("reenviar-estado-a-proyectar", data => {
    socket.broadcast.to(salaDe(socket)).emit("cargar-cancion", data)
  })

  socket.on("disconnect", () => {
    const sala = socket.data?.sala
    const pantalla = socket.data?.pantalla
    log("❌ Desconectado:", { id:socket.id, sala, pantalla })
    // ✅ Notificar al control cuando el proyector se cierra
    if (pantalla === "proyectar" && sala) {
      socket.broadcast.to(sala).emit("proyector-desconectado")
    }
  })
})

// ── Guardar estado al cerrar el proceso ──────────────────────────────────────
process.on("SIGINT",  () => { guardarEstados(); process.exit(0) })
process.on("SIGTERM", () => { guardarEstados(); process.exit(0) })

const PORT = process.env.PORT || 4000
server.listen(PORT, "0.0.0.0", () => console.log(`🔥 Selah Live server :${PORT}`))