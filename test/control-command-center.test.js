const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
const control = fs.readFileSync(path.join(raiz, "app/control/page.tsx"), "utf8")
const centro = fs.readFileSync(path.join(raiz, "components/control/CentroComandos.tsx"), "utf8")

test("Control ofrece búsqueda universal por teclado y botón", () => {
  assert.match(control, /e\.key\.toLowerCase\(\) === "k"/)
  assert.match(control, /Buscar  Ctrl\+K/)
  assert.match(centro, /Busca una canción, número o tono/)
})

test("favoritas y recientes quedan disponibles sin saturar Control móvil", () => {
  assert.match(control, /selah-control-favoritos/)
  assert.match(control, /selah-control-recientes/)
  assert.match(control, /!isMobile && <button/)
  assert.match(centro, /FAVORITAS Y RECIENTES/)
})

test("las ediciones de la lista se pueden deshacer antes de guardar", () => {
  assert.match(control, /DESHACER/)
  assert.match(control, /setLista\(deshacerLista\.items\)/)
  const bloqueEliminar = control.slice(control.indexOf("const eliminarDeLista"), control.indexOf("const itemAFila"))
  assert.doesNotMatch(bloqueEliminar, /from\("items_lista"\)/)
})

test("el operador puede anticipar el siguiente elemento del culto", () => {
  assert.match(control, /SIGUE ·/)
  assert.match(control, /lista\[indiceActivoLista \+ 1\]/)
})

