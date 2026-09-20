const { test } = require('node:test')
const assert = require('node:assert/strict')
const { CalidadAdaptativa, medirEnvio, medirRecepcion } = require('../lib/calidadAdaptativa.ts')

test('un bajón aislado no reduce calidad; tres limitaciones sostenidas sí', () => {
  const c = new CalidadAdaptativa()
  assert.equal(c.observar(3000, 20, 'bandwidth'), null)
  assert.equal(c.observar(6000, 30, 'none'), null)
  assert.equal(c.observar(9000, 20, 'cpu'), null)
  assert.equal(c.observar(12000, 20, 'cpu'), null)
  assert.equal(c.observar(15000, 20, 'cpu'), 1)
  assert.equal(c.nivel, 0, 'no confirmar hasta que WebRTC acepte')
})
test('respeta enfriamiento y piso de calidad', () => {
  const c = new CalidadAdaptativa()
  c.confirmar(1, 0)
  for (let t = 3000; t < 15000; t += 3000) assert.equal(c.observar(t, 18, 'cpu'), null)
  assert.equal(c.observar(15000, 18, 'cpu'), 2)
  c.confirmar(2, 15000)
  for (let t = 18000; t <= 60000; t += 3000) assert.equal(c.observar(t, 18, 'cpu'), null)
})
test('recupera un solo nivel tras treinta segundos estables', () => {
  const c = new CalidadAdaptativa()
  c.confirmar(2, 0)
  for (let t = 3000; t < 30000; t += 3000) assert.equal(c.observar(t, 30, 'none'), null)
  assert.equal(c.observar(30000, 30, 'none'), 1)
  c.confirmar(1, 30000)
  assert.equal(c.observar(33000, 30, 'none'), null)
})
test('FPS desconocidos, pausa o causa ausente no justifican recuperación', () => {
  const c = new CalidadAdaptativa()
  c.confirmar(1, 0)
  for (let t = 3000; t <= 60000; t += 3000) assert.equal(c.observar(t, 30, undefined), null)
  assert.equal(c.observar(63000, NaN, 'none'), null)
  assert.equal(c.observar(66000, 0, 'none'), null)
  assert.equal(c.observar(100000, 30, 'none'), null)
  assert.equal(c.observar(100000, 30, 'none'), null)
})
test('rechazo WebRTC conserva nivel y aplaza reintentos', () => {
  const c = new CalidadAdaptativa()
  c.fallar(9000)
  for (let t = 12000; t < 24000; t += 3000) assert.equal(c.observar(t, 15, 'bandwidth'), null)
  assert.equal(c.nivel, 0)
  assert.equal(c.observar(24000, 15, 'bandwidth'), 1)
})
test('deltas reales y reinicios de contadores no producen estadísticas falsas', () => {
  const a = { id: 'v', timestamp: 1000, bytesSent: 1000, framesEncoded: 30 }
  const b = { id: 'v', timestamp: 4000, bytesSent: 1501000, framesEncoded: 120 }
  assert.deepEqual(medirEnvio(b, a), { fps: 30, mbps: 4 })
  assert.equal(medirEnvio(a, b), null)
  assert.equal(medirEnvio(b, null), null)
  assert.equal(medirEnvio({ ...b, id: 'nuevo' }, a), null)
  assert.equal(medirEnvio({ ...b, bytesSent: undefined }, a), null)
  assert.equal(medirEnvio({ ...b, timestamp: 30000 }, a), null)
})

test('recepción distingue búfer desconocido de cero y mide deltas, no promedios históricos', () => {
  const a = { id: 'v', timestamp: 1000, bytesReceived: 1000, framesDecoded: 30, jitterBufferDelay: 10, jitterBufferEmittedCount: 100 }
  const b = { ...a, timestamp: 6000, bytesReceived: 2501000, framesDecoded: 180, jitterBufferDelay: 55, jitterBufferEmittedCount: 250 }
  const lectura = medirRecepcion(b, a)
  assert.equal(lectura.fps, 30)
  assert.equal(lectura.mbps, 4)
  assert.equal(lectura.bufferMs, 300)
  assert.match(lectura.aviso, /Búfer elevado/)
  assert.equal(medirRecepcion({ ...b, jitterBufferDelay: undefined }, a).bufferMs, null)
  assert.equal(medirRecepcion({ ...b, jitterBufferDelay: 0 }, a).bufferMs, null)
  assert.equal(medirRecepcion({ ...b, framesDecoded: 0 }, a), null)
})
test('recepción sin cuadros alerta sin atribuir falsamente el fallo a internet', () => {
  const a = { id: 'v', timestamp: 1000, bytesReceived: 1000, framesDecoded: 30 }
  const b = { ...a, timestamp: 6000 }
  assert.match(medirRecepcion(b, a).aviso, /No llegan cuadros/)
  assert.equal(medirRecepcion(b, a).bufferMs, null)
})
