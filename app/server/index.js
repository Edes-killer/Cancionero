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
const { buscarVersiculosLocal: buscarVersiculosCompartido } = require("../../lib/biblia-server")
function buscarVersiculosLocal(referencia) {
  const dirs = [
    path.join(process.cwd(),"data","biblia","procesados"),
    path.join(process.cwd(),"..","data","biblia","procesados"),
    path.join(__dirname,"..","data","biblia","procesados"),
  ]
  return buscarVersiculosCompartido(referencia, dirs)
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