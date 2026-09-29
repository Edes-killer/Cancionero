const test = require("node:test")
const assert = require("node:assert/strict")
const { evaluarEspacioGrabacion } = require("../electron/espacio-grabacion")

const GIB = 1024 ** 3

test("bloquea una grabación con menos de 1 GB libre", () => {
  const estado = evaluarEspacioGrabacion(0.8 * GIB)
  assert.equal(estado.nivel, "bloqueado")
  assert.equal(estado.puedeGrabar, false)
})

test("advierte cuando alcanza para grabar pero no para un culto largo", () => {
  const estado = evaluarEspacioGrabacion(4 * GIB)
  assert.equal(estado.nivel, "advertencia")
  assert.equal(estado.puedeGrabar, true)
  assert.match(estado.detalle, /8 GB/)
})

test("aprueba una reserva saludable y tolera medición no disponible", () => {
  assert.equal(evaluarEspacioGrabacion(12 * GIB).nivel, "ok")
  assert.equal(evaluarEspacioGrabacion(Number.NaN).nivel, "desconocido")
})
