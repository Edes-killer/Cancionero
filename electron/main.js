try { require("dotenv").config() } catch(e) {}
const { app, BrowserWindow, shell, Menu, ipcMain, dialog, session, desktopCapturer } = require("electron")
const path = require("path")
const http = require("http")
const { Server } = require("socket.io")
const { rutaDentroDe, nombreArchivoSeguro, esOrigenInterno, esEnlaceWeb } = require("./security")
const fs = require("fs")
const net = require("net")
const os = require("os")
const { spawn } = require("child_process")

// ── Transmisión en vivo (Incremento 2): canvas+audio (webm) → ffmpeg → RTMP ──
// ffmpeg va empaquetado (ffmpeg-static). En la app empaquetada el binario se
// desempaqueta del asar (ver asarUnpack en electron-builder.json), por eso hay
// que corregir la ruta de app.asar → app.asar.unpacked.
let ffmpegPath = null
try {
  ffmpegPath = require("ffmpeg-static")
  if (ffmpegPath && ffmpegPath.includes("app.asar") && !ffmpegPath.includes("app.asar.unpacked")) {
    ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked")
  }
} catch (e) { console.error("ffmpeg-static no disponible:", e) }
let ffmpegProc = null
let pararIntencional = false // true cuando el usuario detiene (no es una caída)
let encoderElegido = null // se cachea el primer encoder que funcione en este PC

// Grabación local (respaldo del culto): los MISMOS trozos que van a ffmpeg se
// escriben también a disco (un solo encode → no ahoga PCs modestos). Cada trozo
// es un contenedor mkv válido; en una reconexión el grabador del renderer se
// recrea (cabecera nueva), así que rodamos a un SEGMENTO nuevo y al final los
// unimos en un solo archivo.
let grabStream = null   // fs.WriteStream del segmento en curso
let grabBase = null     // ruta base (sin extensión) del culto en curso
let grabSegs = []       // rutas .mkv de los segmentos grabados

function carpetaGrabaciones() {
  let base
  try { base = app.getPath("videos") } catch { base = os.tmpdir() }
  const dir = path.join(base, "Selah Live")
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  return dir
}

// Parsea la línea de estadísticas de ffmpeg (-stats) para el panel de salud.
// Ej: "frame=300 fps=30 q=28 size=... time=00:00:10.00 bitrate=2543.1kbits/s dup=0 drop=2 speed=1.00x"
function parseStats(m) {
  if (!/bitrate=|fps=|speed=/.test(m)) return null
  const num = (re) => { const g = re.exec(m); const v = g ? parseFloat(g[1]) : NaN; return Number.isFinite(v) ? v : null }
  const bitrate = num(/bitrate=\s*([\d.]+)kbits\/s/i)
  const fps = num(/fps=\s*([\d.]+)/i)
  const speed = num(/speed=\s*([\d.]+)x/i)
  const drop = num(/drop=\s*(\d+)/i)
  const dup = num(/dup=\s*(\d+)/i)
  const tg = /time=\s*(\d+):(\d+):(\d+)/.exec(m)
  const timeMs = tg ? ((+tg[1]) * 3600 + (+tg[2]) * 60 + (+tg[3])) * 1000 : null
  if (bitrate == null && fps == null && speed == null) return null
  return { bitrate, fps, speed, drop, dup, timeMs }
}

// Probar si un encoder realmente arranca en ESTE PC (no basta con que exista;
// h264_qsv puede estar listado pero fallar sin GPU Intel utilizable).
function probarEncoder(enc) {
  return new Promise(resolve => {
    let listo = false
    const finalizar = ok => { if (!listo) { listo = true; resolve(ok) } }
    try {
      const p = spawn(ffmpegPath, [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc=size=640x360:rate=15",
        "-t", "0.3", "-c:v", enc, "-f", "null", "-",
      ])
      p.on("error", () => finalizar(false))
      p.on("close", code => finalizar(code === 0))
      setTimeout(() => { try { p.kill("SIGKILL") } catch {} finalizar(false) }, 5000)
    } catch { finalizar(false) }
  })
}

// Elegir el mejor encoder disponible: hardware primero (liviano para el i3),
// software (libx264) como último recurso siempre disponible.
async function elegirEncoder() {
  if (encoderElegido) return encoderElegido
  for (const enc of ["h264_qsv", "h264_mf"]) {
    if (await probarEncoder(enc)) { encoderElegido = enc; break }
  }
  if (!encoderElegido) encoderElegido = "libx264"
  console.log("🎬 Encoder de transmisión:", encoderElegido)
  return encoderElegido
}

// Argumentos de ffmpeg según el encoder. En todos: keyframe cada ~2s y AAC.
// rtmpUrls: 1 destino → -f flv; varios → muxer "tee" (codifica una vez y empuja
// a todas las plataformas a la vez). onfail=ignore: si una cae, las otras siguen.
function construirArgsFFmpeg(encoder, rtmpUrls, bitrateKbps) {
  const kbps = Math.max(600, Math.min(8000, Number(bitrateKbps) || 2500))
  const vb = `${kbps}k`, buf = `${kbps * 2}k`
  // -loglevel warning + stats cada 5s: vemos problemas reales (cortes,
  // "Broken pipe", "Connection reset") y si el PC va al día (speed≈1.0x).
  const base = ["-hide_banner", "-loglevel", "warning", "-stats", "-stats_period", "5", "-fflags", "+genpts", "-i", "pipe:0"]
  // Keyframe cada 2s POR TIEMPO real: aunque el PC entregue pocos fps, el
  // keyframe llega a tiempo y la plataforma no corta (era la causa de los cortes).
  const kf = ["-force_key_frames", "expr:gte(t,n_forced*2)"]
  let video
  if (encoder === "h264_qsv") {
    video = ["-c:v", "h264_qsv", "-b:v", vb, "-maxrate", vb, "-bufsize", buf, "-g", "60", "-look_ahead", "0", ...kf]
  } else if (encoder === "h264_mf") {
    video = ["-c:v", "h264_mf", "-b:v", vb, "-g", "60", ...kf]
  } else {
    video = [
      "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
      "-g", "60", "-keyint_min", "60", ...kf,
      "-b:v", vb, "-maxrate", vb, "-bufsize", buf,
    ]
  }
  const audio = ["-c:a", "aac", "-b:a", "128k", "-ar", "44100"]
  const comun = [...base, ...video, ...audio, "-max_muxing_queue_size", "1024"]
  if (rtmpUrls.length === 1) return [...comun, "-f", "flv", rtmpUrls[0]]
  // Varios destinos: un solo encode → muxer tee a todas las plataformas.
  // -flags +global_header es necesario para que el tee escriba la cabecera.
  const spec = rtmpUrls.map(u => `[f=flv:onfail=ignore]${u}`).join("|")
  return [...comun, "-flags", "+global_header", "-map", "0:v", "-map", "0:a", "-f", "tee", spec]
}

function rutaLogTransmision() {
  try { return path.join(app.getPath("userData"), "transmision.log") }
  catch { return path.join(os.tmpdir(), "selah-transmision.log") }
}

// ✅ Matar ffmpeg si la app se cierra mientras transmite: si no, queda huérfano
// empujando a Facebook y el siguiente intento choca con "límite de streams".
app.on("before-quit", () => {
  if (ffmpegProc) { try { ffmpegProc.kill("SIGKILL") } catch {} ffmpegProc = null }
  if (grabStream) { try { grabStream.end() } catch {} grabStream = null }
})

function registrarIPCTransmision() {
  // Iniciar: levanta ffmpeg leyendo webm por stdin y empujando a RTMP.
  ipcMain.handle("transmision:iniciar", async (_e, { rtmpUrl, rtmpUrls, bitrateKbps } = {}) => {
    try {
      if (!ffmpegPath) return { ok: false, error: "No se encontró ffmpeg dentro de la app." }
      // Acepta un arreglo (multiplataforma) o una sola URL (compatibilidad).
      const urls = (Array.isArray(rtmpUrls) ? rtmpUrls : [rtmpUrl]).filter(u => typeof u === "string" && /^rtmps?:\/\//i.test(u))
      if (urls.length === 0) return { ok: false, error: "No hay ninguna dirección de transmisión válida." }
      if (ffmpegProc) { try { ffmpegProc.kill("SIGKILL") } catch {} ffmpegProc = null }
      pararIntencional = false // arrancamos: cualquier cierre siguiente es una caída

      const encoder = await elegirEncoder()
      const args = construirArgsFFmpeg(encoder, urls, bitrateKbps)
      const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"] })
      ffmpegProc = proc

      // Registro a archivo para diagnóstico (el usuario puede mandárnoslo).
      try {
        const cab = `\n===== ${new Date().toLocaleString()} · encoder=${encoder} =====\nffmpeg ${args.join(" ")}\n`
        fs.appendFileSync(rutaLogTransmision(), cab)
      } catch {}
      const aLog = (txt) => { try { fs.appendFileSync(rutaLogTransmision(), txt) } catch {} }

      const enviar = (canal, dato) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(canal, dato)
      }
      proc.stderr.on("data", d => {
        const m = d.toString(); console.error("[ffmpeg]", m); aLog(m); enviar("transmision:log", m)
        const st = parseStats(m); if (st) enviar("transmision:stats", st)
      })
      proc.on("error", err => { aLog(`\n[error de proceso] ${err.message}\n`); enviar("transmision:estado", { estado: "error", error: err.message, inesperado: !pararIntencional }); if (ffmpegProc === proc) ffmpegProc = null })
      proc.on("close", code => { aLog(`\n[ffmpeg terminó con código ${code}]\n`); enviar("transmision:estado", { estado: "terminado", code, inesperado: !pararIntencional }); if (ffmpegProc === proc) ffmpegProc = null })
      proc.stdin.on("error", () => {}) // evitar crash si RTMP corta el pipe

      return { ok: true, encoder }
    } catch (e) { return { ok: false, error: e.message || String(e) } }
  })

  // Cada trozo de video/audio que llega del renderer → stdin de ffmpeg.
  ipcMain.on("transmision:chunk", (_e, chunk) => {
    try {
      if (ffmpegProc && ffmpegProc.stdin && ffmpegProc.stdin.writable) ffmpegProc.stdin.write(Buffer.from(chunk))
    } catch { /* el cierre/error del proceso lo maneja */ }
  })

  // Detener: cerrar stdin para que ffmpeg termine limpio; forzar si se demora.
  // pararIntencional evita que el cierre se trate como una caída (reconexión).
  ipcMain.handle("transmision:detener", async () => {
    try {
      pararIntencional = true
      if (ffmpegProc) {
        const p = ffmpegProc; ffmpegProc = null
        try { p.stdin.end() } catch {}
        setTimeout(() => { try { p.kill("SIGKILL") } catch {} }, 1500)
      }
      return { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // ── Grabación local (respaldo) ────────────────────────────────────────────
  function abrirSegmento() {
    const idx = grabSegs.length
    const ruta = idx === 0 ? `${grabBase}.mkv` : `${grabBase} (${idx + 1}).mkv`
    grabStream = fs.createWriteStream(ruta)
    grabStream.on("error", () => {})
    grabSegs.push(ruta)
  }

  // Abre el archivo del culto y empieza a recibir trozos (los mismos del stream).
  ipcMain.handle("grabacion:iniciar", async (_e, { nombre } = {}) => {
    try {
      if (grabStream) { try { grabStream.end() } catch {} grabStream = null }
      grabSegs = []
      const limpio = String(nombre || "Culto").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 40) || "Culto"
      const f = new Date()
      const pad = n => String(n).padStart(2, "0")
      const sello = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())} ${pad(f.getHours())}-${pad(f.getMinutes())}`
      grabBase = path.join(carpetaGrabaciones(), `${limpio} ${sello}`)
      abrirSegmento()
      return { ok: true, ruta: grabSegs[0], carpeta: carpetaGrabaciones() }
    } catch (e) { return { ok: false, error: e.message || String(e) } }
  })

  ipcMain.on("grabacion:chunk", (_e, chunk) => {
    try { if (grabStream && grabStream.writable) grabStream.write(Buffer.from(chunk)) } catch {}
  })

  // Al reconectar, el grabador del renderer se recrea (cabecera nueva) → rodamos
  // a un segmento nuevo para no mezclar dos contenedores en un mismo archivo.
  ipcMain.handle("grabacion:nuevoSegmento", async () => {
    try {
      if (!grabBase) return { ok: false }
      if (grabStream) { const s = grabStream; grabStream = null; await new Promise(r => { try { s.end(r) } catch { r() } }) }
      abrirSegmento()
      return { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // Cierra el archivo y, en segundo plano, deja un solo .mp4 (une segmentos si
  // hubo reconexiones). Emite "grabacion:listo" cuando está disponible.
  ipcMain.handle("grabacion:detener", async () => {
    try {
      const segs = grabSegs.slice(); const s = grabStream
      grabStream = null; grabBase = null; grabSegs = []
      if (!s || segs.length === 0) return { ok: false, error: "No había grabación en curso." }
      await new Promise(res => { try { s.end(res) } catch { res() } })
      const carpeta = carpetaGrabaciones()
      const enviar = (canal, dato) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(canal, dato) }
      const mp4 = segs[0].replace(/\.mkv$/i, ".mp4")
      const listo = (ruta) => enviar("grabacion:listo", { ok: true, ruta, carpeta })

      if (!ffmpegPath) { listo(segs[0]); return { ok: true, ruta: segs[0], carpeta } }
      try {
        let proc
        if (segs.length === 1) {
          // Un solo segmento: remux directo mkv → mp4 (copia, rápido).
          proc = spawn(ffmpegPath, ["-y", "-i", segs[0], "-c", "copy", "-movflags", "+faststart", mp4], { stdio: "ignore" })
        } else {
          // Varios: unir con el demuxer concat (copia, sin recodificar).
          const lista = path.join(carpeta, `concat-${Date.now()}.txt`)
          fs.writeFileSync(lista, segs.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"))
          proc = spawn(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", mp4], { stdio: "ignore" })
          proc.on("close", () => { try { fs.unlinkSync(lista) } catch {} })
        }
        proc.on("close", c => {
          if (c === 0) { for (const p of segs) { try { fs.unlinkSync(p) } catch {} } listo(mp4) }
          else listo(segs[0])
        })
        proc.on("error", () => listo(segs[0]))
      } catch { listo(segs[0]) }
      return { ok: true, ruta: mp4, carpeta }
    } catch (e) { return { ok: false, error: e.message || String(e) } }
  })

  ipcMain.handle("grabacion:abrirCarpeta", async () => {
    try { await shell.openPath(carpetaGrabaciones()); return { ok: true } }
    catch (e) { return { ok: false, error: e.message } }
  })

  // ── Compartir pantalla ────────────────────────────────────────────────────
  // Lista pantallas y ventanas disponibles (con miniatura) para que el usuario
  // elija cuál compartir. La captura la hace el renderer con el id devuelto.
  ipcMain.handle("pantalla:fuentes", async () => {
    try {
      const fuentes = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
      })
      return {
        ok: true,
        fuentes: fuentes.map(f => ({
          id: f.id,
          nombre: f.name,
          esPantalla: f.id.startsWith("screen:"),
          thumb: (() => { try { return f.thumbnail.toDataURL() } catch { return "" } })(),
        })),
      }
    } catch (e) { return { ok: false, error: e.message || String(e) } }
  })

  // Abrir el archivo de registro para diagnóstico.
  ipcMain.handle("transmision:abrirLog", async () => {
    try { await shell.openPath(rutaLogTransmision()); return { ok: true } }
    catch (e) { return { ok: false, error: e.message } }
  })
}
registrarIPCTransmision()

// ── Importar desde PowerPoint (Windows) ──────────────────────────────────────
// Dos modos: (1) desincrustar las imágenes del .pptx (es un zip → Expand-Archive)
// y (2) renderizar cada diapositiva completa a PNG vía PowerPoint COM.
function correrPS1(contenido) {
  return new Promise((resolve) => {
    const f = path.join(os.tmpdir(), `selah-ps-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
    try { fs.writeFileSync(f, contenido, "utf8") } catch (e) { return resolve({ code: -1, out: "", err: e.message }) }
    let out = "", err = ""
    let ps
    try { ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", f], { windowsHide: true }) }
    catch (e) { try { fs.unlinkSync(f) } catch {} return resolve({ code: -1, out: "", err: e.message }) }
    ps.stdout.on("data", d => out += d.toString())
    ps.stderr.on("data", d => err += d.toString())
    ps.on("close", code => { try { fs.unlinkSync(f) } catch {} resolve({ code, out, err }) })
    ps.on("error", e => { try { fs.unlinkSync(f) } catch {} resolve({ code: -1, out, err: e.message }) })
  })
}
const q = (s) => String(s).replace(/'/g, "''") // escape para comillas simples de PowerShell
const aDataUrl = (file) => {
  const ext = (file.split(".").pop() || "png").toLowerCase()
  const mime = ext === "jpg" ? "jpeg" : ext
  return `data:image/${mime};base64,${fs.readFileSync(file).toString("base64")}`
}
const ordenNum = (a, b) => (parseInt((a.match(/\d+/) || ["0"])[0], 10) - parseInt((b.match(/\d+/) || ["0"])[0], 10))

function registrarIPCPowerPoint() {
  // Diálogo nativo para elegir el .pptx / .ppt.
  ipcMain.handle("ppt:elegir", async () => {
    try {
      const r = await dialog.showOpenDialog(mainWindow, {
        title: "Elige una presentación de PowerPoint",
        filters: [{ name: "PowerPoint", extensions: ["pptx", "ppt"] }],
        properties: ["openFile"],
      })
      if (r.canceled || !r.filePaths[0]) return { ok: false, cancelado: true }
      return { ok: true, ruta: r.filePaths[0] }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // Modo 1: desincrustar las imágenes del .pptx (ppt/media/*).
  ipcMain.handle("ppt:imagenes", async (_e, { ruta } = {}) => {
    try {
      if (!ruta || !fs.existsSync(ruta)) return { ok: false, error: "No se encontró el archivo." }
      // .ppt antiguo NO es un zip → no se puede descomprimir. Guiar a "Diapositivas".
      if (!/\.pptx$/i.test(ruta)) {
        return { ok: false, error: "Este es un PowerPoint antiguo (.ppt). Las imágenes incrustadas solo salen de archivos .pptx. Usa la opción “Diapositivas completas”, que sí funciona con .ppt." }
      }
      const work = path.join(os.tmpdir(), `selah-ppt-${Date.now()}`)
      const zip = `${work}.zip`
      const r = await correrPS1(
        `$ErrorActionPreference='Stop'\n` +
        `Copy-Item -LiteralPath '${q(ruta)}' -Destination '${q(zip)}' -Force\n` +
        `Expand-Archive -LiteralPath '${q(zip)}' -DestinationPath '${q(work)}' -Force\n`
      )
      const mediaDir = path.join(work, "ppt", "media")
      const imagenes = []
      if (fs.existsSync(mediaDir)) {
        const files = fs.readdirSync(mediaDir).filter(f => /\.(png|jpe?g|gif|bmp|webp)$/i.test(f)).sort(ordenNum)
        for (const f of files) { try { imagenes.push({ nombre: f, dataUrl: aDataUrl(path.join(mediaDir, f)) }) } catch {} }
      }
      try { fs.rmSync(work, { recursive: true, force: true }) } catch {}
      try { fs.unlinkSync(zip) } catch {}
      if (imagenes.length === 0) {
        // Nunca devolvemos el stack de PowerShell; mensaje claro según el caso.
        const dañado = /directorio central|central directory|End of Central|ZipArchive/i.test(r.err || "")
        return { ok: false, error: dañado
          ? "El archivo no es un .pptx válido (puede estar dañado). Prueba con “Diapositivas completas”."
          : "La presentación no tiene imágenes incrustadas (es solo texto). Prueba con “Diapositivas completas”." }
      }
      return { ok: true, imagenes }
    } catch (e) { return { ok: false, error: "No se pudieron extraer las imágenes. Prueba con “Diapositivas completas”." } }
  })

  // Modo 2: renderizar cada diapositiva completa a PNG (PowerPoint COM).
  ipcMain.handle("ppt:diapositivas", async (_e, { ruta } = {}) => {
    try {
      if (!ruta || !fs.existsSync(ruta)) return { ok: false, error: "No se encontró el archivo." }
      const outDir = path.join(os.tmpdir(), `selah-slides-${Date.now()}`)
      try { fs.mkdirSync(outDir, { recursive: true }) } catch {}
      const r = await correrPS1(
        `$ErrorActionPreference='Stop'\n` +
        `$ppt = New-Object -ComObject PowerPoint.Application\n` +
        `try {\n` +
        `  $pres = $ppt.Presentations.Open('${q(ruta)}', $true, $false, $false)\n` +
        `  $w = 1920\n` +
        `  $h = [int]($w * $pres.PageSetup.SlideHeight / $pres.PageSetup.SlideWidth)\n` +
        `  for ($i=1; $i -le $pres.Slides.Count; $i++) {\n` +
        `    $n = '{0:D3}' -f $i\n` +
        `    $pres.Slides.Item($i).Export((Join-Path '${q(outDir)}' ("slide_" + $n + ".png")), 'PNG', $w, $h)\n` +
        `  }\n` +
        `  $pres.Close()\n` +
        `} finally { $ppt.Quit() }\n`
      )
      const imagenes = []
      if (fs.existsSync(outDir)) {
        const files = fs.readdirSync(outDir).filter(f => /\.png$/i.test(f)).sort()
        for (const f of files) { try { imagenes.push({ nombre: f, dataUrl: aDataUrl(path.join(outDir, f)) }) } catch {} }
      }
      try { fs.rmSync(outDir, { recursive: true, force: true }) } catch {}
      if (imagenes.length === 0) {
        const enUso = /being used|en uso|access|0x80048240|being edited/i.test(r.err || "")
        return { ok: false, error: enUso
          ? "PowerPoint no pudo abrir el archivo (¿está abierto en otra ventana?). Ciérralo y reintenta."
          : "No se pudieron exportar las diapositivas. Verifica que PowerPoint esté instalado y que el archivo no esté abierto." }
      }
      return { ok: true, imagenes }
    } catch (e) { return { ok: false, error: "No se pudieron exportar las diapositivas. Verifica que PowerPoint esté instalado." } }
  })
}
registrarIPCPowerPoint()

// IP local + puertos, para que /en-vivo arme el QR de "cámara desde el celular"
// (el celular abre http://<ip>:3000/camara y señaliza por el socket en :4000).
ipcMain.handle("camara:infoRed", () => {
  try { const ips = getLocalIPs(); return { ok: true, ip: ips[0], ips, web: 3000, socket: 4000 } }
  catch (e) { return { ok: false, error: e.message } }
})

// ── Firewall: permitir que el CELULAR se conecte por la red local ──────────────
// El Firewall de Windows suele bloquear los puertos del servidor de Selah (3000
// web, 4000 socket) desde otros equipos. El instalador ya crea la regla en la
// instalación manual; esto la repara desde la app (útil si el PC ya estaba
// instalado o se actualizó en silencio). Abrir el firewall requiere admin → se
// lanza un PowerShell ELEVADO (UAC) que borra la regla vieja y crea la nueva.
ipcMain.handle("firewall:estado", async () => {
  return await new Promise((resolve) => {
    try {
      const ps = spawn("netsh", ["advfirewall", "firewall", "show", "rule", "name=SelahLive"], { windowsHide: true })
      let out = ""
      ps.stdout && ps.stdout.on("data", d => { out += d.toString() })
      ps.on("close", () => resolve({ existe: /localport/i.test(out) }))
      ps.on("error", () => resolve({ existe: false }))
    } catch { resolve({ existe: false }) }
  })
})
ipcMain.handle("firewall:reparar", async () => {
  return await new Promise((resolve) => {
    // powershell no elevado que lanza netsh ELEVADO (UAC) con cada parámetro como
    // un ítem del ArgumentList → sin comillas anidadas frágiles. Nombre de regla
    // fijo (SelahLive); si se repite, Windows la vuelve a crear (inofensivo).
    const items = ["advfirewall", "firewall", "add", "rule", "name=SelahLive", "dir=in", "action=allow", "protocol=TCP", "localport=3000,4000", "profile=any"]
    const arg = "Start-Process netsh -Verb RunAs -WindowStyle Hidden -ArgumentList " + items.map(x => "'" + x + "'").join(",")
    try {
      const ps = spawn("powershell.exe", ["-NoProfile", "-Command", arg], { windowsHide: true })
      ps.on("close", (code) => resolve({ ok: code === 0 }))
      ps.on("error", (e) => resolve({ ok: false, error: e.message }))
    } catch (e) { resolve({ ok: false, error: e.message }) }
  })
})

// Calentar la detección de encoder unos segundos tras arrancar, para que al
// dar "Salir en vivo" ya esté elegido (conecta más rápido). Se cachea en memoria.
if (ffmpegPath) setTimeout(() => { elegirEncoder().catch(() => {}) }, 4000)

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
// Prioridad de rangos LAN: 192.168 y 10.x primero (routers domésticos), 172.16-31
// después, y CGNAT (100.64-127.x, típico de repetidores/mesh raros) AL FINAL, porque
// esas IPs muchas veces NO son alcanzables desde el celular.
function _esCGNAT(a) { const p = a.split(".").map(Number); return p[0] === 100 && p[1] >= 64 && p[1] <= 127 }
function _es172priv(a) { const p = a.split(".").map(Number); return p[0] === 172 && p[1] >= 16 && p[1] <= 31 }
function _prioridadIP(a) {
  if (a.startsWith("192.168.")) return 0
  if (a.startsWith("10.")) return 1
  if (_es172priv(a)) return 2
  if (_esCGNAT(a)) return 9
  return 5
}

// Devuelve TODAS las IPv4 LAN del equipo, mejor-primero. El repetidor puede darle
// varias al PC; mostrarlas todas deja al usuario elegir la que sí ve el celular.
function getLocalIPs() {
  const interfaces = os.networkInterfaces()
  const NOMBRES_IGNORAR = /virtualbox|vmware|hyper-v|vethernet|loopback|tailscale|zerotier|tap-|tun|vpn|docker|wsl|bluetooth/i
  const cand = []
  for (const name of Object.keys(interfaces)) {
    if (NOMBRES_IGNORAR.test(name)) continue
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) cand.push(iface.address)
    }
  }
  cand.sort((a, b) => _prioridadIP(a) - _prioridadIP(b))
  return cand.length ? cand : ["127.0.0.1"]
}

function getLocalIP() { return getLocalIPs()[0] }

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
      let urlPath
      try { urlPath = decodeURIComponent(req.url.split("?")[0].split("#")[0]) }
      catch { res.writeHead(400); res.end("Ruta inválida"); return }
      if (urlPath === "/") urlPath = "/index.html"

      // Nunca permitir que una URL con ../ salga de la exportación estática.
      const raiz = path.resolve(outDir)
      const relativo = urlPath.replace(/^[/\\]+/, "")

      const tryPaths = [
        rutaDentroDe(raiz, relativo),
        rutaDentroDe(raiz, relativo + ".html"),
        rutaDentroDe(raiz, path.join(relativo, "index.html")),
        path.join(outDir, "404.html"),
      ].filter(Boolean)

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
const EVENTOS_PUENTE_NUBE = new Set([
  "cargar-cancion", "cambiar-parte", "cancion-activa", "mostrar-imagen",
  "mostrar-biblia", "cambiar-pagina-biblia", "mostrar-estado",
  "mostrar-banner-urgente", "ocultar-banner-urgente", "modo-limpio",
  "cambiar-fondo", "control-siguiente", "control-anterior", "precargar-imagenes",
  "ajustar-zoom", "reenviar-estado-a-proyectar",
])

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
    // ✅ CORS completo: sin esto, un DELETE con JSON (borrar imagen local) dispara
    // un preflight OPTIONS que el servidor no respondía → "Failed to fetch".
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return }

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
      res.end(JSON.stringify({ ok: true, app: "selah-live", puerto: 4000 }))
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
      let nombre = ""
      try { nombre = decodeURIComponent(req.url.split("?")[0].replace("/imagenes/", "")) }
      catch { res.writeHead(400); res.end(); return }
      if (!nombreArchivoSeguro(nombre)) { res.writeHead(400); res.end(); return }
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
      let excedido = false
      req.on("data", c => {
        if (excedido) return
        body += c
        if (body.length > 10_000) {
          excedido = true
          res.writeHead(413, {"Content-Type":"application/json"})
          res.end(JSON.stringify({ error: "solicitud_demasiado_grande" }))
        }
      })
      req.on("end", () => {
        if (excedido) return
        try {
          const { nombre } = JSON.parse(body)
          if (!nombreArchivoSeguro(nombre)) {
            res.writeHead(400, {"Content-Type":"application/json"})
            res.end(JSON.stringify({ error: "nombre_invalido" })); return
          }
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
      let bytesPpt = 0, excedidoPpt = false
      req.on("data", c => {
        if (excedidoPpt) return
        bytesPpt += c.length
        if (bytesPpt > 100 * 1024 * 1024) {
          excedidoPpt = true
          res.writeHead(413, {"Content-Type":"application/json"})
          res.end(JSON.stringify({ error: "ppt_demasiado_grande" }))
          return
        }
        chunksPpt.push(c)
      })
      req.on("end", () => {
        if (excedidoPpt) return
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
      let bytesImagen = 0, excedidoImagen = false
      req.on("data", c => {
        if (excedidoImagen) return
        bytesImagen += c.length
        if (bytesImagen > 25 * 1024 * 1024) {
          excedidoImagen = true
          res.writeHead(413, {"Content-Type":"application/json"})
          res.end(JSON.stringify({ error: "imagen_demasiado_grande" }))
          return
        }
        chunks.push(c)
      })
      req.on("end", () => {
        if (excedidoImagen) return
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
          const filename = nombreArchivoSeguro(fnMatch[1], /\.(webp|jpg|jpeg|png|gif)$/i)
          if (!filename) {
            res.writeHead(415, {"Content-Type":"application/json"})
            res.end(JSON.stringify({ error: "formato_no_permitido" })); return
          }
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

    // Puente NUBE→local: el proyector recibe un evento por Supabase (cuando el
    // control no pudo por la red local) y lo reinyecta acá para repartirlo a la
    // sala como cualquier evento normal, sin tocar los handlers del proyector.
    socket.on("bridge-nube", ({ evento, data } = {}) => {
      // Solo el proyector legítimamente suscrito al canal de Supabase actúa
      // como puente. Un cliente LAN cualquiera no puede inyectar eventos.
      if (socket.data.pantalla === "proyectar" && EVENTOS_PUENTE_NUBE.has(evento)) {
        io.to(salaDe(socket)).emit(evento, data)
      }
    })

    socket.on("cambiar-parte", (index) => {
      const sala = salaDe(socket)
      const estado = estadosPorSala[sala]
      if (estado?.tipo === "cancion") {
        estado.data.index = index
        guardarEstadoSala(sala, estado)
      }
      // ✅ A los DEMÁS, no al emisor: así el Control que avanzó no recibe eco de
      // su propio cambio, pero el proyector, los músicos y OTROS controles
      // (Electron ↔ APK) sí se sincronizan.
      socket.broadcast.to(sala).emit("cambiar-parte", index)
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
      // ✅ A los demás (mismo motivo que cambiar-parte): sincroniza otros
      // controles/proyector sin hacer eco al emisor.
      socket.broadcast.to(sala).emit("cambiar-pagina-biblia", pagina)
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

    // ── Señalización WebRTC: "cámara desde el celular" ──────────────────────
    // El PC (host) abre una sala por CÓDIGO; el celular (emisor) se une con ese
    // código; el servidor solo hace de RELAY de la señalización (SDP/ICE). El
    // video va directo PC↔celular por la LAN (no pasa por el servidor).
    const salaCam = (c) => "cam-" + String(c || "").trim().toUpperCase()

    socket.on("camara:host", ({ codigo } = {}) => {
      if (!codigo) return
      socket.data.camaraCodigo = codigo
      socket.data.camaraRol = "host"
      socket.join(salaCam(codigo))
      console.log("📷 host de cámara:", codigo)
    })

    socket.on("camara:unir", ({ codigo } = {}, cb) => {
      const room = salaCam(codigo)
      const set = io.sockets.adapter.rooms.get(room)
      const hayHost = !!set && [...set].some(id => io.sockets.sockets.get(id)?.data?.camaraRol === "host")
      if (!hayHost) { if (typeof cb === "function") cb({ ok: false, error: "no-host" }); return }
      socket.data.camaraCodigo = codigo
      socket.data.camaraRol = "emisor"
      socket.join(room)
      socket.broadcast.to(room).emit("camara:emisor-listo")
      if (typeof cb === "function") cb({ ok: true })
      console.log("📷 emisor unido:", codigo)
    })

    // Relay de la señalización (oferta/respuesta/ICE) al OTRO peer de la sala.
    socket.on("camara:senal", ({ codigo, data } = {}) => {
      if (!codigo || !data) return
      socket.broadcast.to(salaCam(codigo)).emit("camara:senal", { data, de: socket.data.camaraRol })
    })

    socket.on("camara:fin", ({ codigo } = {}) => {
      const c = codigo || socket.data.camaraCodigo
      if (c) socket.broadcast.to(salaCam(c)).emit("camara:par-fin", { de: socket.data.camaraRol })
    })

    // ── Señalización WebRTC: "emisión directa" (link propio en la red) ──────────
    // El PC (emisor) mantiene una RTCPeerConnection por CADA espectador, así que
    // aquí la señalización es DIRIGIDA por socket.id (no broadcast como la cámara).
    // El video/audio va directo PC→espectador por la LAN; el servidor solo hace de
    // relay de la señalización (SDP/ICE) y avisa al emisor cuando llega un nuevo par.
    const emisorDeEmision = () => {
      const set = io.sockets.adapter.rooms.get("emision")
      return set && [...set].find(id => io.sockets.sockets.get(id)?.data?.emisionRol === "emisor")
    }

    socket.on("emision:host", () => {
      socket.data.emisionRol = "emisor"
      socket.join("emision")
      console.log("📡 emisor de emisión directa listo")
    })

    socket.on("emision:ver", (_ = {}, cb) => {
      const emisorId = emisorDeEmision()
      if (!emisorId) { if (typeof cb === "function") cb({ ok: false, error: "sin-emision" }); return }
      socket.data.emisionRol = "espectador"
      socket.join("emision")
      io.to(emisorId).emit("emision:nuevo-espectador", { id: socket.id })
      if (typeof cb === "function") cb({ ok: true })
      console.log("📡 espectador unido:", socket.id)
    })

    // Señal dirigida a un socket concreto (oferta/respuesta/ICE entre emisor y par).
    socket.on("emision:senal", ({ para, data } = {}) => {
      if (!para || !data) return
      io.to(para).emit("emision:senal", { data, de: socket.id })
    })

    socket.on("emision:fin", () => {
      if (socket.data?.emisionRol === "emisor") socket.broadcast.to("emision").emit("emision:fin")
    })

    socket.on("disconnect", () => {
      const sala = socket.data?.sala
      const pantalla = socket.data?.pantalla
      console.log("❌ Desconectado:", socket.id, pantalla)
      // Notificar al control cuando el proyector se cierra
      if (pantalla === "proyectar" && sala) {
        socket.broadcast.to(sala).emit("proyector-desconectado")
      }
      // Avisar al otro peer de la cámara si uno se cae.
      if (socket.data?.camaraCodigo) {
        socket.broadcast.to(salaCam(socket.data.camaraCodigo)).emit("camara:par-fin", { de: socket.data.camaraRol })
      }
      // Emisión directa: si cae un espectador, avisar al emisor para que cierre su
      // PC; si cae el emisor, avisar a todos los espectadores.
      if (socket.data?.emisionRol === "espectador") {
        const emisorId = emisorDeEmision()
        if (emisorId) io.to(emisorId).emit("emision:espectador-fin", { id: socket.id })
      } else if (socket.data?.emisionRol === "emisor") {
        socket.broadcast.to("emision").emit("emision:fin")
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
// ✅ Referencias a los servidores embebidos. Mantienen vivo el proceso principal
// (event loop) aunque se cierren las ventanas -> al actualizar, el .exe seguía
// en uso y el instalador fallaba con "archivo en uso". Se cierran antes de
// instalar la actualización.
let staticServer = null
let socketServer = null

// ── Ventana de progreso de actualización ──────────────────────────────────────
// ✅ El usuario debe VER que se está actualizando y cuánto falta. Antes todo
// pasaba invisible y la app se cerraba de golpe.
let ventanaProgreso = null

function mostrarVentanaProgreso(version) {
  if (ventanaProgreso && !ventanaProgreso.isDestroyed()) return ventanaProgreso
  ventanaProgreso = new BrowserWindow({
    width: 440, height: 200,
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: true, frame: false, backgroundColor: "#0b1220", show: false,
    skipTaskbar: false, title: "Actualizando Selah Live",
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  const html = `<!doctype html><meta charset="utf-8">
<style>
  body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:#0b1220;color:#fff;
       height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 28px;box-sizing:border-box;
       -webkit-app-region:drag;user-select:none}
  .t{font-size:16px;font-weight:800;margin-bottom:4px}
  .s{font-size:12px;opacity:.6;margin-bottom:16px}
  .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}
  .fill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#3b82f6,#6366f1);transition:width .25s}
  .row{display:flex;justify-content:space-between;margin-top:10px;font-size:12px;opacity:.75}
  .pct{font-weight:800;opacity:1}
</style>
<div class="t">⬇️ Descargando actualización${version ? " " + version : ""}</div>
<div class="s">Selah Live se reiniciará solo al terminar. No cierres la aplicación.</div>
<div class="bar"><div class="fill" id="f"></div></div>
<div class="row"><span id="d">Iniciando descarga...</span><span class="pct" id="p">0%</span></div>
<div class="row"><span id="t2"></span><span></span></div>
<script>
  window.setProgreso = function(pct, detalle, tiempo){
    document.getElementById('f').style.width = pct + '%'
    document.getElementById('p').textContent = pct + '%'
    document.getElementById('d').textContent = detalle || ''
    document.getElementById('t2').textContent = tiempo || ''
  }
  window.setInstalando = function(){
    document.querySelector('.t').textContent = '⚙️ Instalando actualización'
    document.querySelector('.s').textContent = 'Esto toma unos segundos. Selah Live se abrirá sola al terminar.'
    document.getElementById('f').style.width = '100%'
    document.getElementById('p').textContent = ''
    document.getElementById('d').textContent = 'Reemplazando archivos...'
    document.getElementById('t2').textContent = ''
  }
</script>`

  ventanaProgreso.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html))
  ventanaProgreso.once("ready-to-show", () => {
    if (ventanaProgreso && !ventanaProgreso.isDestroyed()) ventanaProgreso.show()
  })
  return ventanaProgreso
}

function actualizarProgreso(pct, detalle, tiempo) {
  if (!ventanaProgreso || ventanaProgreso.isDestroyed()) return
  ventanaProgreso.webContents
    .executeJavaScript(`window.setProgreso(${pct}, ${JSON.stringify(detalle || "")}, ${JSON.stringify(tiempo || "")})`)
    .catch(() => {})
}

function cerrarVentanaProgreso() {
  try {
    if (ventanaProgreso && !ventanaProgreso.isDestroyed()) ventanaProgreso.destroy()
  } catch (e) {}
  ventanaProgreso = null
  try { mainWindow && !mainWindow.isDestroyed() && mainWindow.setProgressBar(-1) } catch (e) {}
}

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
      // ✅ No frenar el dibujo cuando la ventana está en segundo plano. Sin
      // esto, al poner Facebook adelante, requestAnimationFrame se ralentiza y
      // la Transmisión en vivo cae a ~5fps (video entrecortado y la plataforma
      // corta). Con esto la composición sigue a fps pleno aunque no tenga foco.
      backgroundThrottling: false,
    },
    show: false, // Esperar a que esté listo para mostrar
  })

  // ✅ Permitir cámara y micrófono para la Transmisión en vivo. Sin esto,
  // getUserMedia queda bloqueado en la app empaquetada y la cámara no abre.
  try {
    session.defaultSession.setPermissionRequestHandler((wc, permiso, permitir) => {
      const origenPermitido = esOrigenInterno(wc.getURL())
      permitir(origenPermitido && (permiso === "media" || permiso === "camera" || permiso === "microphone"))
    })
  } catch (e) { console.error("No se pudo configurar permisos de medios:", e) }

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
      if (esEnlaceWeb(url)) shell.openExternal(url)
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

  // La ventana principal nunca debe navegar fuera del servidor interno. Si una
  // página remota lograra cargarse aquí, heredaría acceso a los puentes IPC.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (esOrigenInterno(url)) return
    event.preventDefault()
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
  staticServer = await startStaticServer(outDir, 3000)
  socketServer = startSocketServer(4000)

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
      // ✅ Ventana de progreso visible: el usuario tiene que SABER que se está
      // actualizando y cuánto falta. Antes la descarga era invisible y la app
      // simplemente se cerraba de golpe, lo que asusta.
      mostrarVentanaProgreso(info?.version || "")
    })

    autoUpdater.on("download-progress", (p) => {
      const pct = Math.round(p?.percent || 0)
      const mb = (n) => (n / 1024 / 1024).toFixed(0)
      const velocidad = (p?.bytesPerSecond || 0) / 1024 / 1024
      // Tiempo restante estimado
      const restanteSeg = velocidad > 0
        ? Math.max(0, ((p.total - p.transferred) / 1024 / 1024) / velocidad)
        : 0
      const tiempo = restanteSeg > 90
        ? `~${Math.ceil(restanteSeg / 60)} min restantes`
        : restanteSeg > 0 ? `~${Math.ceil(restanteSeg)} seg restantes` : ""
      actualizarProgreso(pct, `${mb(p.transferred)} de ${mb(p.total)} MB · ${velocidad.toFixed(1)} MB/s`, tiempo)
      // Barra de progreso en el ícono de la barra de tareas
      try { mainWindow && !mainWindow.isDestroyed() && mainWindow.setProgressBar(pct / 100) } catch (e) {}
    })

    autoUpdater.on("update-not-available", () => {
      // Solo notificar si fue verificación manual
    })

    autoUpdater.on("update-downloaded", (info) => {
      // ✅ La descarga terminó → cerrar la ventanita de progreso de DESCARGA.
      // Si no, queda pegada al 100% detrás del diálogo. La fase de instalación
      // abre su propia ventana limpia más abajo.
      cerrarVentanaProgreso()
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "¡Actualización lista!",
        message: `Nueva versión ${info?.version || ""} descargada.`,
        detail: "Se cerrará Selah Live, verás el progreso de la instalación (unos segundos) y la app se abrirá sola al terminar.",
        buttons: ["Instalar ahora", "Después"],
        defaultId: 0
      }).then(result => {
        if (result.response !== 0) { cerrarVentanaProgreso(); return }
        if (result.response === 0) {
          // ✅ Mostrar "Instalando..." mientras corre el instalador, para que el
          // usuario sepa qué está pasando y no crea que la app se colgó.
          try {
            const v = mostrarVentanaProgreso("")
            v.webContents.executeJavaScript("window.setInstalando()").catch(() => {})
          } catch (e) {}
          // ✅ Cierre limpio antes de instalar. La causa raíz del "archivo en
          // uso": los servidores embebidos (3000/4000) mantenían VIVO el proceso
          // principal aunque se cerraran las ventanas, así que el .exe seguía
          // bloqueado cuando el instalador intentaba reemplazarlo — segundos
          // después, ya con el usuario clickeando "Instalar". Cerrarlos libera
          // el event loop para que el proceso muera de verdad.
          try { socketServer && socketServer.close() } catch (e) {}
          try { staticServer && staticServer.close() } catch (e) {}
          app.removeAllListeners("window-all-closed")
          // ✅ Cerrar todas MENOS la ventana de progreso, para que el usuario
          // siga viendo "Instalando..." hasta que el proceso termine.
          BrowserWindow.getAllWindows().forEach(w => {
            if (w !== ventanaProgreso) { try { w.destroy() } catch (e) {} }
          })
          // ✅ isSilent=false: el instalador oneClick muestra su propia ventana
          // de progreso. Antes iba silencioso y la app simplemente desaparecía
          // sin explicación. isForceRunAfter relanza la app al terminar.
          autoUpdater.quitAndInstall(false, true)
          // ✅ Forzar la salida RÁPIDO: el cierre "elegante" no bastaba (handles
          // de socket.io/servidor mantenían el proceso vivo y el instalador
          // encontraba la app corriendo a mitad de instalación). 3.5s era
          // demasiado tarde: el instalador ya había chequeado. app.exit(0) mata
          // el proceso de una; el instalador ya es un proceso aparte, no le
          // afecta. El grueso del arreglo igual vive en installer.nsh (mata la
          // app desde el instalador nuevo antes de tocar archivos).
          setTimeout(() => { try { app.exit(0) } catch (e) {} }, 1000)
        }
      })
    })

    autoUpdater.on("error", (err) => {
      console.log("Auto-updater error:", err?.message)
      // ✅ Si falla la descarga/actualización, cerrar la ventana de progreso
      // (si no, se quedaría colgada en pantalla para siempre) y avisar.
      const estabaVisible = !!(ventanaProgreso && !ventanaProgreso.isDestroyed())
      cerrarVentanaProgreso()
      if (estabaVisible && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: "warning",
          title: "No se pudo actualizar",
          message: "Hubo un problema al descargar la actualización.",
          detail: "Puedes seguir usando Selah Live normalmente. Vuelve a intentarlo más tarde desde Configuración.",
          buttons: ["OK"]
        }).catch(() => {})
      }
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
