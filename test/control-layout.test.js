const test = require("node:test")
const assert = require("node:assert/strict")
const { limitarAnchoBiblioteca, limitarPosMonitor } = require("../lib/controlLayout.ts")

test("el divisor conserva un mínimo de 280 px por panel cuando hay espacio", () => {
  const anchoGrid = 820
  const disponible = anchoGrid - 40 - 12 - 8
  const izquierda = limitarAnchoBiblioteca(5, anchoGrid)
  const derecha = limitarAnchoBiblioteca(95, anchoGrid)
  assert.ok(disponible * izquierda / 100 >= 279.99)
  assert.ok(disponible * (100 - derecha) / 100 >= 279.99)
  assert.equal(limitarAnchoBiblioteca(45, anchoGrid), 45)
  assert.equal(limitarAnchoBiblioteca(90, 600), 50)
})

test("el monitor vuelve al área visible si se arrastra fuera o crece", () => {
  const ventana = { ancho: 1280, alto: 720 }
  const panel = { ancho: 560, alto: 360 }
  assert.deepEqual(limitarPosMonitor({ x: 2000, y: 900 }, ventana, panel), { x: 716, y: 356 })
  assert.deepEqual(limitarPosMonitor({ x: -40, y: -50 }, ventana, panel), { x: 4, y: 56 })
  assert.deepEqual(limitarPosMonitor({ x: 200, y: 200 }, ventana, panel), { x: 200, y: 200 })
})
