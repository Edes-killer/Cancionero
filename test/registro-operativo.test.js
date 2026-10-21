const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const {
  configurarCarpeta, registrar, leerRecientes, rutaActual, sanitizarTexto, sanitizar,
} = require("../electron/registro-operativo")

test("el registro operativo oculta secretos antes de escribirlos", () => {
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "selah-log-"))
  configurarCarpeta(temporal)
  const tokenPrueba = ["ghp", "abcdefghijklmnopqrstuvwxyz123456"].join("_")
  registrar("prueba", {
    email: "pastor@iglesia.cl",
    rtmpUrl: "rtmps://servidor.example/live/clave-secreta",
    authorization: "Bearer secreto-total",
    token: tokenPrueba,
    anidado: { mensaje: "falló para pastor@iglesia.cl" },
  }, "error")
  const disco = fs.readFileSync(rutaActual(), "utf8")
  assert.equal(disco.includes("clave-secreta"), false)
  assert.equal(disco.includes("pastor@iglesia.cl"), false)
  assert.equal(disco.includes("abcdefghijklmnopqrstuvwxyz123456"), false)
  assert.match(disco, /DATO_SENSIBLE_OCULTO|DESTINO_RTMP_OCULTO/)
  fs.rmSync(temporal, { recursive:true, force:true })
})

test("el registro operativo tolera errores y referencias circulares", () => {
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "selah-log-"))
  configurarCarpeta(temporal)
  const circular = { nombre:"prueba" }
  circular.mismo = circular
  registrar("fallo_controlado", { error:new Error("correo usuario@dominio.cl"), circular }, "critico")
  const entradas = leerRecientes(5)
  assert.equal(entradas.length, 1)
  assert.equal(entradas[0].nivel, "critico")
  assert.equal(entradas[0].detalle.circular.mismo, "[REFERENCIA_CIRCULAR]")
  assert.match(entradas[0].detalle.error.mensaje, /u\*\*\*o@dominio\.cl/)
  fs.rmSync(temporal, { recursive:true, force:true })
})

test("los sanitizadores limitan datos y destinos sensibles", () => {
  assert.equal(sanitizarTexto("rtmp://host/live/key"), "[DESTINO_RTMP_OCULTO]")
  assert.deepEqual(sanitizar({ password:"1234", normal:"ok" }), {
    password:"[DATO_SENSIBLE_OCULTO]", normal:"ok",
  })
})
