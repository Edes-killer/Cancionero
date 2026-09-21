const { test } = require('node:test')
const assert = require('node:assert/strict')
const { avisoCamaraPC } = require('../lib/estadoCamaraPC.ts')

test('sin PC compatible o sin confirmación nunca promete grabación', () => {
  assert.equal(avisoCamaraPC(null, 0).alerta, true)
  assert.match(avisoCamaraPC(null, 0).texto, /Sin confirmación/)
})
test('el verde vence tras ocho segundos sin respuesta incluso con socket conectado', () => {
  const estado = { recibido: 100, video: true, grabacion: 'activa' }
  assert.equal(avisoCamaraPC(estado, 200).alerta, false)
  assert.equal(avisoCamaraPC(estado, 8101).alerta, true)
  assert.match(avisoCamaraPC(estado, 8101).texto, /Sin confirmación/)
})
test('grabación activa no es prueba de que la cámara llegue', () => {
  const aviso = avisoCamaraPC({ recibido: 100, video: false, grabacion: 'activa' }, 200)
  assert.equal(aviso.alerta, true)
  assert.match(aviso.texto, /Video interrumpido/)
})
test('video recibido no es prueba de grabación', () => {
  assert.match(avisoCamaraPC({ recibido: 100, video: true, grabacion: 'detenida' }, 200).texto, /NO está grabando/)
  for (const grabacion of ['detenida', 'error', 'sin-datos', 'desconocida']) {
    assert.equal(avisoCamaraPC({ recibido: 100, video: true, grabacion }, 200).alerta, true)
  }
})
test('recepción desconocida se mantiene en comprobación', () => {
  assert.match(avisoCamaraPC({ recibido: 100, video: null, grabacion: 'activa' }, 200).texto, /Comprobando/)
})
