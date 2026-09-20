const { test } = require('node:test')
const assert = require('node:assert/strict')
const { encuadreContenido, dibujarCamaraCompleta } = require('../lib/encuadreCamara.ts')

test('vertical completa deja bandas laterales, no zoom', () => {
  assert.deepEqual(encuadreContenido(1080, 1920, 1920, 1080), { x: 656.25, y: 0, w: 607.5, h: 1080 })
})
test('webcam 4:3 y fuente panorámica conservan extremos', () => {
  assert.deepEqual(encuadreContenido(640, 480, 1280, 720), { x: 160, y: 0, w: 960, h: 720 })
  assert.deepEqual(encuadreContenido(2560, 1080, 1280, 720), { x: 0, y: 90, w: 1280, h: 540 })
  assert.deepEqual(encuadreContenido(1920, 1080, 1280, 720), { x: 0, y: 0, w: 1280, h: 720 })
})
test('rotación y PiP mantienen proporciones dentro del destino', () => {
  for (const [w, h] of [[3840,2160], [2160,3840], [640,480]]) {
    const r = encuadreContenido(w,h,320,180)
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 320 && r.y + r.h <= 180)
    assert.ok(Math.abs(r.w / r.h - w / h) < 1e-10)
  }
  assert.equal(encuadreContenido(0,1080,320,180), null)
})
test('PiP pinta negro detrás y dibuja origen completo sin recorte', () => {
  const calls = []
  const ctx = { save() {}, restore() {}, fillRect(...a) { calls.push(['fondo', this.fillStyle, ...a]) }, drawImage(...a) { calls.push(['video', ...a]) } }
  const video = { videoWidth: 640, videoHeight: 480 }
  dibujarCamaraCompleta(ctx, video, 100, 50, 320, 180)
  assert.deepEqual(calls, [['fondo','#000',100,50,320,180], ['video',video,140,50,240,180]])
})
