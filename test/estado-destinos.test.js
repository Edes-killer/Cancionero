const { test } = require('node:test')
const assert = require('node:assert/strict')
const { SeguimientoDestinos } = require('../electron/estado-destinos')

test('identifica caída y recuperación del destino correcto sin exponer su clave', () => {
  const eventos = []
  const claveA = 'rtmps://servidor/a/CLAVE-SECRETA-A'
  const claveB = 'rtmps://servidor/b/CLAVE-SECRETA-B'
  const seguimiento = new SeguimientoDestinos([
    { id:'facebook', nombre:'Facebook', url:claveA },
    { id:'youtube', nombre:'YouTube', url:claveB },
  ], evento => eventos.push(evento))

  seguimiento.iniciar()
  seguimiento.linea(`[fifo @ ABC123] Error opening ${claveB}: I/O error`)
  seguimiento.linea('[fifo @ ABC123] Recovery attempt #2/12')
  seguimiento.linea('[fifo @ ABC123] Recovery successful')

  assert.deepEqual(eventos.map(e => [e.id, e.estado]), [
    ['facebook', 'enviando'],
    ['youtube', 'enviando'],
    ['youtube', 'reconectando'],
    ['youtube', 'enviando'],
  ])
  const serializado = JSON.stringify(eventos)
  assert.doesNotMatch(serializado, /CLAVE-SECRETA|rtmps?:\/\//)
})

test('ignora mensajes sin relación y deduplica estados repetidos', () => {
  const eventos = []
  const seguimiento = new SeguimientoDestinos([
    { id:'facebook', nombre:'Facebook', url:'rtmps://host/app/secreto' },
  ], evento => eventos.push(evento))
  seguimiento.iniciar()
  seguimiento.linea('frame=300 fps=30')
  seguimiento.linea('[fifo @ UNO] Error opening rtmps://host/app/secreto: I/O error')
  seguimiento.linea('[fifo @ UNO] Recovery failed: I/O error')
  assert.equal(eventos.length, 2)
  assert.equal(eventos.at(-1).estado, 'reconectando')
})
