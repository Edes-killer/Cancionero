const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("Control mantiene una sola experiencia sin selector Preparar/Culto", () => {
  const control = fs.readFileSync("app/control/page.tsx", "utf8")
  assert.doesNotMatch(control, /selah-modo-control|modoOperacion|cambiarModoOperacion/)
  assert.doesNotMatch(control, />\s*(?:🛠\s*)?Preparar\s*</)
  assert.doesNotMatch(control, />\s*●\s*Culto\s*</)
})

test("las ayudas contextuales son opcionales y se apagan por defecto en APK", () => {
  const ayudas = fs.readFileSync("components/ui/AyudaBotones.tsx", "utf8")
  const ajustes = fs.readFileSync("app/configuracion/page.tsx", "utf8")
  assert.match(ayudas, /selah-ayudas-contextuales/)
  assert.match(ayudas, /Capacitor[\s\S]{0,100}pointer: coarse/)
  assert.match(ayudas, /guardada === null \? !tactil/)
  assert.match(ajustes, /Ayudas sobre los botones/)
  assert.match(ajustes, /role="switch" aria-checked=\{ayudasContextuales\}/)
})

test("Control móvil agrupa acciones secundarias y muestra un solo estado prioritario", () => {
  const control = fs.readFileSync("app/control/page.tsx", "utf8")
  assert.match(control, /mostrarControlesExtraMobile/)
  assert.match(control, /Mostrar controles adicionales/)
  assert.match(control, /mostrarControlesExtraMobile \|\| autoAvanceActivo/)
  assert.match(control, /isMobile && socketConectado === true && proyectorConectado/)
  assert.match(control, /etiqueta="LISTO"/)
})
