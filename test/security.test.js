const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { rutaDentroDe, nombreArchivoSeguro, esOrigenInterno, esEnlaceWeb } = require("../electron/security")

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
