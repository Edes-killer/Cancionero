const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { rutaDentroDe, nombreArchivoSeguro, esOrigenInterno, esEnlaceWeb } = require("../electron/security")
const { EventEmitter } = require("node:events")
const { protegerSalida } = require("../electron/safe-output")
const fs = require("node:fs")

test("las rutas estáticas no pueden escapar de la carpeta pública", () => {
  const raiz = path.resolve("out")
  assert.equal(rutaDentroDe(raiz, "control/index.html"), path.join(raiz, "control", "index.html"))
  assert.equal(rutaDentroDe(raiz, "../../package.json"), null)
  assert.equal(rutaDentroDe(raiz, "..\\package.json"), null)
})

test("la galería rechaza rutas y extensiones ajenas", () => {
  const media = /\.(webp|jpg|jpeg|png|gif)$/i
  assert.equal(nombreArchivoSeguro("logo.webp", media), "logo.webp")
  assert.equal(nombreArchivoSeguro("../logo.webp", media), null)
  assert.equal(nombreArchivoSeguro("script.exe", media), null)
})

test("Electron solo confía en su origen interno y abre enlaces web", () => {
  assert.equal(esOrigenInterno("http://localhost:3000/control/"), true)
  assert.equal(esOrigenInterno("http://127.0.0.1:3000/"), true)
  assert.equal(esOrigenInterno("https://ejemplo.cl/"), false)
  assert.equal(esEnlaceWeb("https://selah-live.vercel.app/"), true)
  assert.equal(esEnlaceWeb("javascript:alert(1)"), false)
  assert.equal(esEnlaceWeb("file:///C:/secreto.txt"), false)
})

test("cerrar la consola no derriba el proceso principal", () => {
  const salida = new EventEmitter()
  protegerSalida(salida)
  protegerSalida(salida)
  assert.equal(salida.listenerCount("error"), 1)
  assert.doesNotThrow(() => salida.emit("error", Object.assign(new Error("broken pipe"), { code: "EPIPE" })))
})

test("la migración cierra la elevación de privilegios y aísla multimedia", () => {
  const sql = fs.readFileSync("supabase/migrations/20260908_security_hardening.sql", "utf8")
  assert.match(sql, /^begin;/m)
  assert.match(sql, /drop policy if exists "usuario actualiza su propio registro"/i)
  assert.match(sql, /drop policy if exists "usuario inserta su propio registro"/i)
  assert.match(sql, /create or replace function public\.aceptar_invitacion/i)
  assert.match(sql, /public\.iglesia_de_ruta_storage\(name\)/i)
  assert.match(sql, /alter column iglesia_id drop default/i)
  assert.match(sql, /commit;\s*$/i)
})

test("crear y unirse a iglesias usa RPC atómicos, no inserciones directas", () => {
  const crear = fs.readFileSync("app/crear-iglesia/page.tsx", "utf8")
  const onboarding = fs.readFileSync("app/onboarding/page.tsx", "utf8")
  const unirse = fs.readFileSync("app/unirse/page.tsx", "utf8")
  assert.match(crear, /rpc\("crear_iglesia_segura"/)
  assert.match(onboarding, /rpc\("crear_iglesia_segura"/)
  assert.match(unirse, /rpc\("ver_invitacion"/)
  assert.match(unirse, /rpc\("aceptar_invitacion"/)
  for (const codigo of [crear, onboarding, unirse]) {
    assert.doesNotMatch(codigo, /from\("usuarios_iglesia"\)[\s\S]{0,160}\.insert\(/)
  }
})
