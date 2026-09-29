const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { datosSegmento, buscarGrabacionesPendientes, crearPlanRecuperacion } = require("../electron/grabaciones-pendientes")

test("identifica segmentos y conserva su orden numérico", () => {
  assert.deepEqual(datosSegmento("Culto 2026-09-29.mkv"), { base: "Culto 2026-09-29", indice: 1 })
  assert.deepEqual(datosSegmento("Culto 2026-09-29 (12).mkv"), { base: "Culto 2026-09-29", indice: 12 })
  assert.equal(datosSegmento("video.mp4"), null)
})

test("agrupa grabaciones abandonadas sin incluir la sesión activa", () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "selah-pendientes-"))
  try {
    const uno = path.join(carpeta, "Culto prueba.mkv")
    const dos = path.join(carpeta, "Culto prueba (2).mkv")
    const activa = path.join(carpeta, "Culto activo.mkv")
    fs.writeFileSync(dos, "segmento dos")
    fs.writeFileSync(uno, "segmento uno")
    fs.writeFileSync(activa, "grabando")
    fs.writeFileSync(path.join(carpeta, "ignorar.mp4"), "listo")

    const grupos = buscarGrabacionesPendientes(carpeta, [activa])
    assert.equal(grupos.length, 1)
    assert.equal(grupos[0].id, "Culto prueba")
    assert.deepEqual(grupos[0].archivos, [uno, dos])
    assert.equal(grupos[0].bytes, 24)
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true })
  }
})

test("FFmpeg recupera y decodifica dos segmentos reales con el plan de producción", { timeout: 30000 }, () => {
  const ffmpeg = require("ffmpeg-static")
  assert.ok(ffmpeg, "ffmpeg-static debe estar disponible")
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "selah-recuperacion-real-"))
  try {
    const uno = path.join(carpeta, "Culto real.mkv")
    const dos = path.join(carpeta, "Culto real (2).mkv")
    const lista = path.join(carpeta, "segmentos.txt")
    const salida = path.join(carpeta, "Culto real recuperada.mp4")
    const crear = (ruta, color) => spawnSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:s=320x180:r=30`,
      "-t", "0.25", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "matroska", "-y", ruta,
    ], { encoding: "utf8" })
    for (const [ruta, color] of [[uno, "red"], [dos, "blue"]]) {
      const generado = crear(ruta, color)
      assert.equal(generado.status, 0, generado.stderr)
    }

    const plan = crearPlanRecuperacion([uno, dos], salida, lista)
    fs.writeFileSync(lista, plan.contenidoLista)
    const recuperado = spawnSync(ffmpeg, plan.args, { encoding: "utf8" })
    assert.equal(recuperado.status, 0, recuperado.stderr)
    assert.ok(fs.statSync(salida).size > 0)

    const validado = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", salida, "-f", "null", "-"], { encoding: "utf8" })
    assert.equal(validado.status, 0, validado.stderr)
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true })
  }
})
