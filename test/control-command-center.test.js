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
  assert.match(centro, /Busca contenido o escribe una acción/)
})

test("favoritas y recientes quedan disponibles sin saturar Control móvil", () => {
  assert.match(control, /selah-control-favoritos/)
  assert.match(control, /selah-control-recientes/)
  assert.match(control, /!isMobile && <button/)
  assert.match(centro, /FAVORITAS Y RECIENTES/)
})

test("las ediciones de la lista se pueden deshacer antes de guardar", () => {
  assert.match(control, /DESHACER/)
  assert.match(control, /setLista\(anterior\.items\)/)
  const bloqueEliminar = control.slice(control.indexOf("const eliminarDeLista"), control.indexOf("const itemAFila"))
  assert.doesNotMatch(bloqueEliminar, /from\("items_lista"\)/)
})

test("el operador puede anticipar el siguiente elemento del culto", () => {
  assert.match(control, /SIGUE ·/)
  assert.match(control, /lista\[indiceActivoLista \+ 1\]/)
})

test("las acciones rápidas conservan el contexto operativo", () => {
  assert.match(centro, /Escribe el mensaje que verá la iglesia/)
  assert.match(centro, /Espera con logo/)
  assert.match(control, /volverCentroTrasRevision/)
  assert.match(control, /Seguir editando/)
  assert.match(control, /logoEsperaUrl\.trim\(\) \? proyectarPantallaLogo\(\) : proyectarPantallaEspera\(\)/)
})

test("Control advierte cambios pendientes y permite guardarlos con Ctrl S", () => {
  assert.match(control, /hayCambiosCulto/)
  assert.match(control, /CAMBIOS SIN GUARDAR/)
  assert.match(control, /Cambios sin guardar/)
  assert.match(control, /e\.key\.toLowerCase\(\) === "s"/)
  assert.match(control, /guardarCultoRef\.current\(\)/)
})

test("el buscador universal encuentra y opera recursos de Galería", () => {
  assert.match(centro, /recursosEncontrados/)
  assert.match(centro, />GALERÍA</)
  assert.match(centro, /onRecurso\(r, true\)/)
  assert.match(centro, /onRecurso\(r, false\)/)
  assert.match(control, /proyectarMediaDesdeGaleria/)
  assert.match(control, /selah-galeria-cache-/)
})

test("el buscador abre cultos sin perder cambios silenciosamente", () => {
  assert.match(centro, /CULTOS GUARDADOS/)
  assert.match(centro, /cultosEncontrados/)
  assert.match(control, /const abrirCultoGuardado/)
  assert.match(control, /Hay cambios sin guardar en el culto actual/)
  assert.match(control, /if \(!ok\) return false/)
})

test("las acciones rápidas incluyen Palabra y guardado del culto", () => {
  assert.match(centro, /Ejemplo: Juan 3:16 o Salmos 23/)
  assert.match(centro, /onBiblia\(referenciaBiblia\.trim\(\), true\)/)
  assert.match(centro, /onBiblia\(referenciaBiblia\.trim\(\), false\)/)
  assert.match(centro, /onAccion\("guardar"\)/)
  assert.match(control, /accion === "guardar"\) guardarCultoRef\.current\(\)/)
})

test("deshacer funciona por botón y Ctrl Z; Escape cierra el buscador", () => {
  assert.match(control, /e\.key\.toLowerCase\(\) === "z"/)
  assert.match(control, /const ejecutarDeshacerLista/)
  assert.match(control, /onClick=\{ejecutarDeshacerLista\}/)
  assert.match(centro, /document\.addEventListener\("keydown", cerrarConEscape\)/)
  assert.match(centro, /document\.body\.style\.overflow = "hidden"/)
})

test("el centro de comandos navega resultados heterogéneos con teclado", () => {
  assert.match(centro, /opcionesTeclado/)
  assert.match(centro, /e\.key === "ArrowDown"/)
  assert.match(centro, /e\.key === "ArrowUp"/)
  assert.match(centro, /void ejecutarSeleccion\(\)/)
  assert.match(centro, /claveSeleccionada/)
  assert.match(centro, /↑↓ seleccionar/)
})

test("la búsqueda universal encuentra letras y mantiene visible la selección", () => {
  assert.match(centro, /c\.texto_busqueda/)
  assert.match(centro, /c\.categoria/)
  assert.match(centro, /const fragmentoLetra/)
  assert.match(centro, /scrollIntoView\(\{ block:"nearest" \}\)/)
  assert.match(centro, /data-comando-clave/)
})

test("el buscador reconoce comandos operativos escritos", () => {
  assert.match(centro, /const comandosEncontrados/)
  for (const comando of ["mensaje", "palabra", "espera", "apagar", "revisar", "guardar"]) {
    assert.match(centro, new RegExp(`id:\"${comando}\"`))
  }
  assert.match(centro, />ACCIONES</)
  assert.match(centro, /comando-\$\{c\.id\}/)
})

test("Enter proyecta y Shift Enter agrega contenido a la lista", () => {
  assert.match(centro, /const agregarSeleccion/)
  assert.match(centro, /e\.shiftKey \? agregarSeleccion\(\)/)
  assert.match(centro, /agregar:\(\) => onRecurso\(r, true\)/)
  assert.match(centro, /agregar:\(\) => onAgregar\(c\)/)
  assert.match(centro, /Shift\+↵ agregar a lista/)
})
