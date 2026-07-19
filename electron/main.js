try { require("dotenv").config() } catch(e) {}
const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require("electron")
const path = require("path")
const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")
const net = require("net")
const os = require("os")
const { spawn } = require("child_process")

// ✅ Single instance lock — necesario para que NSIS pueda cerrar la app al actualizar
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// ── Obtener IP local ─────────────────────────────────────────────────────────
// ✅ Filtra adaptadores virtuales (VPN, VirtualBox, Hyper-V, etc.) que en
//    Windows suelen aparecer ANTES que el WiFi/Ethernet real, causando que
//    el QR apunte a una IP inalcanzable desde el celular.
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  const candidatos = []

  const NOMBRES_IGNORAR = /virtualbox|vmware|hyper-v|vethernet|loopback|tailscale|zerotier|tap-|tun|vpn|docker|wsl|bluetooth/i

  for (const name of Object.keys(interfaces)) {
    if (NOMBRES_IGNORAR.test(name)) continue
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidatos.push({ name, address: iface.address })
      }
    }
  }

  if (candidatos.length === 0) return "127.0.0.1"

  // Preferir rangos típicos de red doméstica (192.168.x.x)
  const domestica = candidatos.find(c => c.address.startsWith("192.168."))
  if (domestica) return domestica.address

  // Luego 10.x.x.x (también común en routers, menos en VPNs corporativas)
  const privada10 = candidatos.find(c => c.address.startsWith("10."))
  if (privada10) return privada10.address

  return candidatos[0].address
}

// ── Biblia local (lógica compartida con app/server/index.js) ──────────────────
const { buscarVersiculosLocal: buscarVersiculosCompartido } = require("../lib/biblia-server")
function buscarVersiculosLocal(referencia) {
  const dirs = [
    path.join(process.resourcesPath||"","data","biblia","procesados"),
    path.join(__dirname,"..","data","biblia","procesados"),
    path.join(process.cwd(),"data","biblia","procesados"),
    path.join(app.getPath("userData"),"biblia","procesados"),
  ]
  return buscarVersiculosCompartido(referencia, dirs)
}

// ── Servidor estático para /out ───────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".webp": "image/webp",
}

function startStaticServer(outDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Limpiar query strings y hash
      let urlPath = req.url.split("?")[0].split("#")[0]
      if (urlPath === "/") urlPath = "/index.html"

      const tryPaths = [
        path.join(outDir, urlPath),
        path.join(outDir, urlPath + ".html"),
        path.join(outDir, urlPath, "index.html"),
        path.join(outDir, "404.html"),
      ]

      let filePath = tryPaths.find(p => {
        try { return fs.statSync(p).isFile() } catch { return false }
      }) || path.join(outDir, "404.html")

      const ext = path.extname(filePath)
      const contentType = MIME[ext] || "application/octet-stream"

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      })
      fs.createReadStream(filePath).pipe(res)
    })

    server.listen(port, "0.0.0.0", () => {
      console.log(`🌐 Servidor web en http://localhost:${port}`)
      resolve(server)
    })
  })
}

// ── Supabase REST para músicos remotos ───────────────────────────────────────
// Lee del .env.local del proyecto Next.js
require("dotenv").config({ path: path.join(__dirname, "../.env.local") })
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

const upsertEstadoCulto = async (sala, tipo, data = {}) => {
  if (!SUPABASE_URL || !SUPABASE_KEY || !sala || sala === "global") return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/estado_culto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        iglesia_id: sala, tipo,
        titulo: data.titulo || "",
        tono: data.tono || "",
        partes: data.partes || [],
        index: data.index || 0,
        updated_at: new Date().toISOString()
      })
    })
  } catch { /* sin internet, no crítico */ }
}

// ── Servidor Socket.IO ─────────────────────────────────────────────────────────
let estadosPorSala = {}
const pinesPorSala = {}
// ✅ Banner de urgencia: se superpone a lo que sea que esté proyectando sin
// reemplazarlo, así que se guarda aparte de estadosPorSala. No se persiste
// a disco -es intencionalmente efímero.
let bannerPorSala = {}
let modoLimpioPorSala = {}

function startSocketServer(port) {
  const estadoPath = path.join(app.getPath("userData"), "estado.json")

  try {
    const data = fs.readFileSync(estadoPath, "utf-8")
    const parsed = JSON.parse(data)
    if (parsed?.tipo && parsed?.data) {
      estadosPorSala = { global: parsed }
    } else {
      estadosPorSala = parsed || {}
    }
    console.log("♻️ Estados restaurados:", Object.keys(estadosPorSala))
  } catch {
    console.log("⚠️ Sin estado previo")
  }

  const guardarEstados = () => {
    // ✅ Escritura síncrona: garantiza persistencia antes de cualquier crash
    try { fs.writeFileSync(estadoPath, JSON.stringify(estadosPorSala, null, 2)) }
    catch (e) { console.error("❌ Error guardando estados:", e) }
  }

  const salaDe = (socket) => socket.data?.sala || "global"

  const guardarEstadoSala = (sala, estado) => {
    estadosPorSala[sala] = estado
    guardarEstados()
  }

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    if (req.url === "/qr") {
      const handler = async () => {
        try {
          const QRCode = require("qrcode")
          const ip = getLocalIP()
          const url = `selah://${ip}:4000`
          const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 })
          const base64 = qrDataUrl.split(",")[1]
          const buf = Buffer.from(base64, "base64")
          res.writeHead(200, { "Content-Type": "image/png" })
          res.end(buf)
        } catch(e) { res.writeHead(500); res.end() }
      }
      handler(); return
    }

    if (req.url === "/info") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, ip: getLocalIP(), puerto: 4000, app: "selah-live" }))
      return
    }
    if (req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (req.url?.startsWith("/api/imagenes/listar")) {
      const dir = path.join(app.getPath("userData"), "imagenes")
      if (!fs.existsSync(dir)) { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({imagenes:[]})); return }
      const archivos = fs.readdirSync(dir).filter(f => /\.(webp|jpg|jpeg|png|gif)$/i.test(f))
      const imagenes = archivos.map(f => ({ url: `http://localhost:4000/imagenes/${f}`, nombre: f }))
      res.writeHead(200, {"Content-Type":"application/json"})
      res.end(JSON.stringify({ imagenes })); return
    }

    if (req.url?.startsWith("/imagenes/")) {
      const nombre = req.url.replace("/imagenes/", "")
      const filePath = path.join(app.getPath("userData"), "imagenes", nombre)
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {"Content-Type":"image/webp"})
        fs.createReadStream(filePath).pipe(res)
      } else {
        res.writeHead(404); res.end()
      }
      return
    }

    if (req.url === "/api/imagenes/eliminar" && req.method === "DELETE") {
      let body = ""
      req.on("data", c => body += c)
      req.on("end", () => {
        try {
          const { nombre } = JSON.parse(body)
          const filePath = path.join(app.getPath("userData"), "imagenes", nombre)
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          res.writeHead(200, {"Content-Type":"application/json"})
          res.end(JSON.stringify({ ok: true }))
        } catch(e) {
          res.writeHead(500); res.end()
        }
      })
      return
    }

    // ✅ Conversión automática .ppt (binario antiguo) → .pptx
    // Usa el PowerPoint que el usuario ya tiene instalado, vía COM Automation
    // por PowerShell. Si no hay PowerPoint instalado o algo falla, responde
    // con error claro y el frontend muestra instrucciones manuales.
    if (req.url === "/api/ppt/convertir" && req.method === "POST") {
      const chunksPpt = []
      req.on("data", c => chunksPpt.push(c))
      req.on("end", () => {
        const body = Buffer.concat(chunksPpt)
        const boundary = req.headers["content-type"]?.split("boundary=")[1]
        if (!boundary) { res.writeHead(400); res.end(JSON.stringify({error:"sin_boundary"})); return }

        const parts = body.toString("binary").split(`--${boundary}`)
        let nombreOriginal = null, contenido = null
        for (const part of parts) {
          const headerEnd = part.indexOf("\r\n\r\n")
          if (headerEnd === -1) continue
          const header = part.slice(0, headerEnd)
          if (!header.includes("filename=")) continue
          const fnMatch = header.match(/filename="([^"]+)"/)
          if (!fnMatch) continue
          nombreOriginal = fnMatch[1]
          contenido = part.slice(headerEnd + 4, part.lastIndexOf("\r\n"))
          break
        }
        if (!contenido) { res.writeHead(400); res.end(JSON.stringify({error:"sin_archivo"})); return }

        // Carpeta temporal exclusiva para esta conversión
        const tmpDir = path.join(app.getPath("temp"), "selah-ppt-" + Date.now())
        fs.mkdirSync(tmpDir, { recursive: true })
        const inputPath  = path.join(tmpDir, "original.ppt")
        const outputPath = path.join(tmpDir, "convertido.pptx")
        fs.writeFileSync(inputPath, Buffer.from(contenido, "binary"))

        // Script PowerShell: abre con PowerPoint instalado, guarda como .pptx, cierra
        const psScript = `
$ErrorActionPreference = 'Stop'
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $pres = $ppt.Presentations.Open('${inputPath.replace(/\\/g,"\\\\")}', $true, $true, $false)
  $pres.SaveAs('${outputPath.replace(/\\/g,"\\\\")}', 24)
  $pres.Close()
  $ppt.Quit()
  Write-Output "OK"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}`.trim()

        const limpiar = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {} }

        // ✅ Timeout de 25s — si PowerPoint no responde (no instalado, popup
        // bloqueante, licencia, etc.) no dejamos la conversión colgada
        const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript])
        let respondido = false
        const timer = setTimeout(() => {
          if (respondido) return
          respondido = true
          try { ps.kill() } catch {}
          limpiar()
          res.writeHead(504, {"Content-Type":"application/json"})
          res.end(JSON.stringify({ error: "timeout", mensaje: "PowerPoint no respondió a tiempo" }))
        }, 25000)

        ps.on("close", code => {
          if (respondido) return
          clearTimeout(timer)
          if (code === 0 && fs.existsSync(outputPath)) {
            respondido = true
            const pptxBuffer = fs.readFileSync(outputPath)
            res.writeHead(200, {
              "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "Content-Disposition": `attachment; filename="${(nombreOriginal||"convertido").replace(/\.ppt$/i,".pptx")}"`
            })
            res.end(pptxBuffer)
            limpiar()
          } else {
            respondido = true
            limpiar()
            res.writeHead(422, {"Content-Type":"application/json"})
            res.end(JSON.stringify({ error: "sin_powerpoint", mensaje: "No se pudo convertir — PowerPoint no está instalado o no se pudo abrir el archivo" }))
          }
        })
      })
      return
    }

    if (req.url === "/api/imagenes/guardar" && req.method === "POST") {
      const dir = path.join(app.getPath("userData"), "imagenes")
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const chunks = []
      req.on("data", c => chunks.push(c))
      req.on("end", () => {
        const body = Buffer.concat(chunks)
        const boundary = req.headers["content-type"]?.split("boundary=")[1]
        if (!boundary) { res.writeHead(400); res.end(); return }
        // Extraer el archivo del multipart
        const marker = Buffer.from(`--${boundary}`)
        const parts = body.toString("binary").split(`--${boundary}`)
        for (const part of parts) {
          const headerEnd = part.indexOf("\r\n\r\n")
          if (headerEnd === -1) continue
          const header = part.slice(0, headerEnd)
          if (!header.includes("filename=")) continue
          const fnMatch = header.match(/filename="([^"]+)"/)
          if (!fnMatch) continue
          const filename = fnMatch[1]
          const content = part.slice(headerEnd + 4, part.lastIndexOf("\r\n"))
          const filePath = path.join(dir, filename)
          fs.writeFileSync(filePath, Buffer.from(content, "binary"))
          const url = `http://localhost:4000/imagenes/${filename}`
          res.writeHead(200, {"Content-Type":"application/json"})
          res.end(JSON.stringify({ url, nombre: filename }))
          return
        }
        res.writeHead(400); res.end()
      })
      return
    }

    if (req.url?.startsWith("/api/biblia/buscar")) {
      const url = new URL(req.url, "http://localhost")
      const ref = url.searchParams.get("ref") || ""
      try {
        const data = buscarVersiculosLocal(ref)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify(data))
      } catch(e) {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }
    res.writeHead(200)
    res.end("Selah Live Server")
  })

  const io = new Server(server, { cors: { origin: "*" } })

  io.on("connection", (socket) => {
    console.log("📱 Cliente conectado:", socket.id)

    socket.on("unirse-sala", ({ sala, pantalla, pin }) => {
      const salaFinal = sala || "global"

      if (pantalla === "control" || pantalla === "canciones") {
        const pinG = pinesPorSala[salaFinal]
        if (pinG && String(pin || "") !== String(pinG)) {
          socket.emit("pin-invalido", { mensaje: "PIN incorrecto. Verifica en configuración." })
          return
        }
        if (!pinG && pin) pinesPorSala[salaFinal] = String(pin)
      }

      socket.data.sala = salaFinal
      socket.data.pantalla = pantalla || "desconocida"
      socket.join(salaFinal)
      console.log(`🏠 ${socket.id} → sala: ${salaFinal} | pantalla: ${pantalla}`)

      if (pantalla === "control" && estadosPorSala[salaFinal]) {
        const estado = estadosPorSala[salaFinal]
        if (estado.tipo === "cancion") socket.emit("restaurar-estado-control", estado.data)
      }

      // ✅ Enviar estado guardado al proyector también
      if (pantalla === "proyectar") {
        if (estadosPorSala[salaFinal]) socket.emit("estado-actual", estadosPorSala[salaFinal])
        if (bannerPorSala[salaFinal]) socket.emit("mostrar-banner-urgente", bannerPorSala[salaFinal])
        if (modoLimpioPorSala[salaFinal] !== undefined) socket.emit("modo-limpio", modoLimpioPorSala[salaFinal])
        // Notificar al control que el proyector se conectó
        socket.broadcast.to(salaFinal).emit("proyector-conectado")
      }
      // ✅ También enviar estado a músicos al conectarse
      if (pantalla === "musicos" && estadosPorSala[salaFinal]) {
        socket.emit("estado-actual", estadosPorSala[salaFinal])
      }
    })

    socket.on("cargar-cancion", (data) => {
      const sala = salaDe(socket)
      guardarEstadoSala(sala, { tipo: "cancion", data: { ...data, index: data.index || 0 } })
      io.to(sala).emit("cargar-cancion", data)
      upsertEstadoCulto(sala, "cancion", data)
    })

    socket.on("cambiar-parte", (index) => {
      const sala = salaDe(socket)
      const estado = estadosPorSala[sala]
      if (estado?.tipo === "cancion") {
        estado.data.index = index
        guardarEstadoSala(sala, estado)
      }
      io.to(sala).emit("cambiar-parte", index)
      if (sala !== "global") {
        fetch(`${SUPABASE_URL}/rest/v1/estado_culto?iglesia_id=eq.${sala}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ index, updated_at: new Date().toISOString() })
        }).catch(() => {})
      }
    })

    socket.on("cancion-activa", (data) => {
      io.to(salaDe(socket)).emit("cancion-activa", data)
    })

    socket.on("mostrar-imagen", (data) => {
      const sala = salaDe(socket)
      guardarEstadoSala(sala, { tipo: "imagen", data })
      io.to(sala).emit("mostrar-imagen", data)
    })

    socket.on("mostrar-biblia", (data) => {
      const sala = salaDe(socket)
      guardarEstadoSala(sala, { tipo: "biblia", data: { ...data, pagina: data.pagina || 0 } })
      io.to(sala).emit("mostrar-biblia", data)
    })

    socket.on("cambiar-pagina-biblia", (pagina) => {
      const sala = salaDe(socket)
      const estado = estadosPorSala[sala]
      if (estado?.tipo === "biblia") {
        estado.data.pagina = pagina
        guardarEstadoSala(sala, estado)
      }
      io.to(sala).emit("cambiar-pagina-biblia", pagina)
    })

    socket.on("mostrar-estado", (data) => {
      const sala = salaDe(socket)
      // ✅ Spread para guardar fondo y tipo correctamente
      guardarEstadoSala(sala, { tipo: "estado", data: { ...data } })
      io.to(sala).emit("mostrar-estado", data)
    })

    socket.on("mostrar-banner-urgente", (texto) => {
      const sala = salaDe(socket)
      bannerPorSala[sala] = String(texto || "").slice(0, 200)
      io.to(sala).emit("mostrar-banner-urgente", bannerPorSala[sala])
    })

    socket.on("ocultar-banner-urgente", () => {
      const sala = salaDe(socket)
      delete bannerPorSala[sala]
      io.to(sala).emit("ocultar-banner-urgente")
    })

    // ✅ Modo limpio: antes solo se guardaba en localStorage, lo que solo
    // funcionaba si Control y Proyector eran la misma máquina -- si Control
    // se opera desde un celular y Proyector corre en otro equipo, nunca se
    // enteraba. Ahora viaja por el socket como el resto del estado en vivo.
    socket.on("modo-limpio", (activo) => {
      const sala = salaDe(socket)
      modoLimpioPorSala[sala] = !!activo
      io.to(sala).emit("modo-limpio", !!activo)
    })

    socket.on("cambiar-fondo", (fondo) => {
      const sala = salaDe(socket)
      const est = estadosPorSala[sala]
      if (est) { est.data = { ...(est.data || {}), fondo }; guardarEstadoSala(sala, est) }
      socket.broadcast.to(sala).emit("cambiar-fondo", fondo)
    })

    socket.on("control-siguiente", () => socket.broadcast.to(salaDe(socket)).emit("control-siguiente"))
    socket.on("control-anterior",  () => socket.broadcast.to(salaDe(socket)).emit("control-anterior"))
    socket.on("precargar-imagenes", (urls) => io.to(salaDe(socket)).emit("precargar-imagenes", urls))

    // ✅ Zoom remoto control → proyector
    socket.on("ajustar-zoom", (data) => io.to(salaDe(socket)).emit("ajustar-zoom", data))
    socket.on("zoom-info",    (data) => io.to(salaDe(socket)).emit("zoom-info",    data))

    // ✅ Biblia via socket (evita problemas de fetch HTTP en APK/Electron)
    socket.on("buscar-biblia", (ref, callback) => {
      try {
        const data = buscarVersiculosLocal(ref)
        if (typeof callback === "function") callback(data)
      } catch(e) {
        if (typeof callback === "function") callback({ error: e.message })
      }
    })

    socket.on("get-estado", () => {
      const sala = salaDe(socket)
      if (estadosPorSala[sala]) {
        socket.emit("estado-actual", estadosPorSala[sala])
      } else {
        socket.broadcast.to(sala).emit("proyectar-solicita-estado")
      }
    })

    socket.on("reenviar-estado-a-proyectar", (data) => {
      socket.broadcast.to(salaDe(socket)).emit("cargar-cancion", data)
    })

    socket.on("disconnect", () => {
      const sala = socket.data?.sala
      const pantalla = socket.data?.pantalla
      console.log("❌ Desconectado:", socket.id, pantalla)
      // Notificar al control cuando el proyector se cierra
      if (pantalla === "proyectar" && sala) {
        socket.broadcast.to(sala).emit("proyector-desconectado")
      }
    })
  })

  server.listen(port, "0.0.0.0", () => {
    console.log(`🔥 Socket.IO en puerto ${port}`)
  })

  return server
}

// ── Ventana principal ─────────────────────────────────────────────────────────
let mainWindow = null
let proyectorWin = null  // ✅ referencia directa a la ventana del proyector (para ESC)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Selah Live",
    icon: path.join(__dirname, "../public/icon-512.png"),
    backgroundColor: "#060d1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Esperar a que esté listo para mostrar
  })

  // Menú simplificado
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Selah Live",
      submenu: [
        { label: "Acerca de Selah Live", role: "about" },
        { type: "separator" },
        { label: "Salir", role: "quit" }
      ]
    },
    {
      label: "Ver",
      submenu: [
        { label: "Recargar", role: "reload" },
        { label: "Pantalla completa", role: "togglefullscreen" },
        { label: "Herramientas de desarrollador", role: "toggleDevTools" },
      ]
    },
    {
      label: "Ventana",
      submenu: [
        { label: "Minimizar", role: "minimize" },
        { label: "Maximizar", role: "maximize" },
      ]
    }
  ]))

  // Abrir links externos en el browser del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("http://localhost")) {
      shell.openExternal(url)
      return { action: "deny" }
    }

    // ✅ Proyector: cubre la pantalla pero sin fullscreen real
    // Así Alt+Tab funciona y se puede cambiar de ventana en emergencias
    if (url.includes("/proyectar")) {
      const displays = require("electron").screen.getAllDisplays()
      const secondDisplay = displays.find(d => d.id !== require("electron").screen.getPrimaryDisplay().id)
      const target = secondDisplay || require("electron").screen.getPrimaryDisplay()

      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          x: target.bounds.x,
          y: target.bounds.y,
          width: target.bounds.width,
          height: target.bounds.height,
          fullscreen: false,         // ← Sin fullscreen real → Alt+Tab funciona
          frame: false,              // Sin bordes
          alwaysOnTop: false,        // Libre por defecto — ESC lo fija encima
          backgroundColor: "#000",
          title: "Selah Live — Proyector",
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          }
        }
      }
    }

    return { action: "allow" }
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
    mainWindow.maximize()
  })

  mainWindow.loadURL("http://localhost:3000")
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const outDir = path.join(__dirname, "../out")

  console.log("🚀 Iniciando Selah Live...")
  await startStaticServer(outDir, 3000)
  startSocketServer(4000)

  const ip = getLocalIP()
  console.log(`📡 IP local: ${ip}`)

  createWindow()

  // ── Atajos de teclado globales ────────────────────────────────────────────
  const { globalShortcut } = require("electron")

  // ESC — cierra la pantalla de proyección. Antes un ESC solo cambiaba
  // "siempre encima" y hacía falta doble ESC para cerrar, lo que se sentía
  // como que "no cierra". El proyector no es fullscreen real (fullscreen:false),
  // así que Alt+Tab ya funciona sin necesidad de despinnearlo.
  // ✅ Guardamos la referencia de la ventana del proyector directamente. Antes
  // se la buscaba por título ("Proyector"), pero layout.tsx pone
  // document.title = "Selah Live" al cargar la página, así que getTitle() ya no
  // contenía "Proyector" y el ESC NO encontraba la ventana → no cerraba (ni
  // fullscreen ni normal). Por URL/referencia es infalible.
  const cerrarProyector = (win) => {
    if (!win || win.isDestroyed()) return
    if (win.isFullScreen()) win.setFullScreen(false)
    win.setAlwaysOnTop(false)
    win.close()
  }

  globalShortcut.register("Escape", () => {
    const wins = require("electron").BrowserWindow.getAllWindows()
    const proyector = proyectorWin && !proyectorWin.isDestroyed()
      ? proyectorWin
      : wins.find(w => w !== mainWindow && (w.webContents.getURL() || "").includes("/proyectar"))
    cerrarProyector(proyector)
  })

  // ✅ Respaldo cuando el proyector tiene foco (p.ej. en fullscreen real, donde
  // Chromium puede quedarse con el primer ESC): un listener dentro de la ventana.
  mainWindow.webContents.on("did-create-window", (win, details) => {
    if (!details?.url?.includes("/proyectar")) return
    proyectorWin = win
    win.on("closed", () => { if (proyectorWin === win) proyectorWin = null })
    win.webContents.on("before-input-event", (e, input) => {
      if (input.type === "keyDown" && input.key === "Escape") cerrarProyector(win)
    })
  })

  // ── Auto-updater ─────────────────────────────────────────────────────────────
  try {
    const { autoUpdater } = require("electron-updater")

    // ✅ Para repositorio privado de GitHub
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "Edes-killer",
      repo: "Cancionero"
    })

    // Verificar al iniciar (con delay para que cargue la app)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => console.log("Update check:", e?.message))
    }, 8000)

    // IPC: botón manual desde configuración
    // ✅ Limpiar cookies y datos de sesión del WebView (para logout limpio)
    ipcMain.handle("clear-session", async () => {
      try {
        const { session } = require("electron")
        const ses = session.defaultSession

        // ✅ Solo lo que realmente causa el bug de reconexión automática
        // (cookies de Google OAuth) — esto es rápido, milisegundos.
        // "cachestorage" ya no aplica (sin Service Worker) y "clearCache()"
        // (caché HTTP completo: imágenes, scripts, respuestas de semanas de
        // uso) es lo que tomaba minutos. Ninguno es necesario para el logout.
        await ses.clearStorageData({
          storages: ["cookies", "localstorage", "sessionstorage", "indexdb"]
        })

        // Limpiar el caché HTTP en segundo plano, sin bloquear el logout
        ses.clearCache().catch(() => {})

        console.log("✅ Sesión de Electron limpiada")
        return { ok: true }
      } catch (e) {
        console.error("Error limpiando sesión:", e)
        return { ok: false }
      }
    })

    ipcMain.on("check-for-updates", () => {
      autoUpdater.checkForUpdates().catch(e => {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Sin actualizaciones",
          message: "Ya tienes la versión más reciente de Selah Live.",
          buttons: ["OK"]
        })
      })
    })

    autoUpdater.on("update-available", (info) => {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Nueva versión disponible",
        message: `Selah Live ${info.version} está disponible`,
        detail: "La actualización se descargará en segundo plano. Te avisaremos cuando esté lista.",
        buttons: ["OK"]
      })
    })

    autoUpdater.on("update-not-available", () => {
      // Solo notificar si fue verificación manual
    })

    autoUpdater.on("update-downloaded", (info) => {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "¡Actualización lista!",
        message: `Nueva versión ${info?.version || ""} descargada.`,
        detail: "Se cerrará Selah Live y se abrirá el instalador. Seguí los pasos en pantalla; si aparece 'archivo en uso', dale Reintentar.",
        buttons: ["Instalar ahora", "Después"],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          // ✅ Cierre limpio antes de instalar
          app.removeAllListeners("window-all-closed")
          BrowserWindow.getAllWindows().forEach(w => w.destroy())
          // ✅ isSilent=false → el instalador corre CON su ventana. A diferencia
          // del modo silencioso (que fallaba con "Fallo al desinstalar archivos
          // antiguos" cuando un archivo seguía en uso), el instalador con UI
          // maneja el "archivo en uso" con reintentos y muestra el progreso.
          autoUpdater.quitAndInstall(false, true)
        }
      })
    })

    autoUpdater.on("error", (err) => {
      console.log("Auto-updater error:", err?.message)
    })
  } catch (e) {
    console.log("electron-updater no disponible:", e?.message)
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  const { globalShortcut } = require("electron")
  globalShortcut.unregisterAll()
  if (process.platform !== "darwin") app.quit()
})