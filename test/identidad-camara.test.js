const { test } = require('node:test')
const assert = require('node:assert/strict')
const { identidadCamara, claveCamara, EnlacesCamara, accionFinCamara } = require('../lib/identidadCamara.ts')
const uno = '12345678-1234-4234-8234-123456789abc'
const dos = '22345678-1234-4234-8234-123456789abc'

test('identidad persiste y no depende del socket ni del código de sala', () => {
  const datos = new Map()
  const almacen = { getItem: k => datos.get(k), setItem: (k, v) => datos.set(k, v) }
  assert.equal(identidadCamara(almacen, () => uno), uno)
  assert.equal(identidadCamara(almacen, () => dos), uno)
  assert.equal(claveCamara('viejo', uno), claveCamara('nuevo', uno))
  assert.notEqual(claveCamara('viejo', uno), claveCamara('nuevo', dos))
})
test('compatibilidad antigua y almacenamiento bloqueado no impiden conectar', () => {
  assert.equal(claveCamara('socket', { id: uno }), 'socket')
  assert.equal(claveCamara('socket', 'invalido'), 'socket')
  assert.equal(identidadCamara({ getItem(){throw Error()}, setItem(){throw Error()} }, () => uno), uno)
})
test('cierre y candidatos antiguos no afectan al celular reconectado ni al otro celular', () => {
  const e = new EnlacesCamara()
  e.registrar(uno, 'anterior'); e.registrar(dos, 'segundo'); e.registrar(uno, 'nuevo')
  assert.equal(e.retirar(uno, 'anterior'), false)
  assert.equal(e.vigente(uno, 'anterior'), false)
  assert.equal(e.vigente(uno, 'nuevo'), true)
  assert.equal(e.vigente(dos, 'segundo'), true)
  assert.equal(e.retirar(uno, 'nuevo'), true)
  assert.equal(e.vigente(dos, 'segundo'), true)
})

test('la desconexión de otra cámara no apaga los demás celulares', () => {
  assert.equal(accionFinCamara({de:'otro', rol:'emisor', intencional:true}, 'pc'), 'ignorar')
  assert.equal(accionFinCamara({de:'pc', rol:'host', intencional:false}, 'pc'), 'reintentar')
  assert.equal(accionFinCamara({de:'pc', rol:'host', intencional:true}, 'pc'), 'cerrar')
  assert.equal(accionFinCamara({de:'pc-viejo', rol:'host'}, 'pc'), 'ignorar')
  assert.equal(accionFinCamara({de:'host'}, 'pc'), 'reintentar')
})
