const { test } = require('node:test')
const assert = require('node:assert/strict')
const { VigenciaVideo } = require('../lib/vigenciaVideo.ts')

test('cámara quieta con nuevos cuadros sigue disponible', () => {
  const v = new VigenciaVideo()
  for (let i = 0; i < 200; i++) assert.equal(v.actualizar(i * 33, i, true), true)
})
test('congelación sostenida se oculta, no un retraso breve', () => {
  const v = new VigenciaVideo()
  assert.equal(v.actualizar(0, 10, true), true)
  assert.equal(v.actualizar(2000, 10, true), true)
  assert.equal(v.actualizar(3000, 10, true), false)
})
test('pista terminada se oculta inmediatamente aunque conserve dimensiones', () => {
  const v = new VigenciaVideo()
  v.actualizar(0, 10, true)
  assert.equal(v.actualizar(33, 11, false), false)
})
test('recuperación exige un segundo de cuadros continuos', () => {
  const v = new VigenciaVideo()
  v.actualizar(0, 0, false)
  for (let i = 0; i < 10; i++) assert.equal(v.actualizar(100 + i * 100, i, true), false)
  assert.equal(v.actualizar(1100, 10, true), true)
})
test('un solo cuadro ocasional no cuenta como recuperación estable', () => {
  const v = new VigenciaVideo()
  v.actualizar(0, 0, false)
  for (let i = 1; i < 10; i++) assert.equal(v.actualizar(i * 1000, i, true), false)
})
test('sin contador no inventa congelación, y permite recuperar pista viva', () => {
  const v = new VigenciaVideo()
  v.actualizar(0, null, false)
  assert.equal(v.actualizar(100, null, true), false)
  assert.equal(v.actualizar(1100, null, true), true)
  assert.equal(v.actualizar(9000, null, true), true)
})
