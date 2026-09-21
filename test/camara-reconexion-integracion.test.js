const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { Server } = require('socket.io')
const { io: cliente } = require('socket.io-client')
const { createServer } = require('node:http')

// Ejecuta los handlers reales del repositorio en un servidor local efímero, sin Electron ni cámara.
test('Socket.IO: identidad conservada, aviso de desconexión correcto y duplicado rechazado', async () => {
  const fuente = readFileSync('electron/main.js', 'utf8')
  const inicio = fuente.indexOf('    const salaCam =')
  const fin = fuente.indexOf('    // ── Señalización WebRTC: "emisión directa"', inicio)
  const dInicio = fuente.indexOf('      if (socket.data?.camaraCodigo)')
  const dFin = fuente.indexOf('      // Emisión directa: si cae', dInicio)
  assert.ok(inicio > 0 && fin > inicio && dFin > dInicio)
  const instalar = new Function('socket', 'io', fuente.slice(inicio, fin) + '\nsocket.on("disconnect", () => {' + fuente.slice(dInicio, dFin) + '});')
  const http = createServer()
  const io = new Server(http)
  const clientes = []
  io.on('connection', s => instalar(s, io))
  await new Promise(r => http.listen(0, '127.0.0.1', r))
  const conectar = async () => {
    const c = cliente(`http://127.0.0.1:${http.address().port}`, { transports:['websocket'], reconnection:false })
    clientes.push(c); await evento(c, 'connect'); return c
  }
  const ack = (c, nombre, datos) => c.timeout(1500).emitWithAck(nombre, datos)
  try {
    const host = await conectar(), movil = await conectar(), otro = await conectar()
    const codigo = 'PRUEBA', dispositivoId = '12345678-1234-4234-8234-123456789abc'
    assert.equal((await ack(host, 'camara:host', {codigo})).ok, true)
    assert.equal((await ack(movil, 'camara:unir', {codigo, dispositivoId})).ok, true)
    assert.equal((await ack(otro, 'camara:unir', {codigo, dispositivoId})).error, 'identidad-ocupada')
    const oferta = evento(host, 'camara:senal')
    movil.emit('camara:senal', {codigo, para:host.id, data:{tipo:'offer', sdp:'prueba'}})
    assert.equal((await oferta).dispositivoId, dispositivoId)
    const confirmacion = evento(movil, 'camara:senal')
    host.emit('camara:senal', {codigo, para:movil.id, data:{tipo:'estado-pc', video:true, grabacion:'detenida'}})
    const recibido = await confirmacion
    assert.equal(recibido.rol, 'host'); assert.equal(recibido.de, host.id)
    assert.equal(recibido.data.grabacion, 'detenida')
    // Un emisor no puede hacerse pasar por confirmación del PC.
    const siguiente = evento(host, 'camara:senal')
    movil.emit('camara:senal', {codigo, para:host.id, data:{tipo:'estado-pc', video:true, grabacion:'activa'}})
    movil.emit('camara:senal', {codigo, para:host.id, data:{tipo:'ice', candidate:'barrera'}})
    assert.equal((await siguiente).data.tipo, 'ice')
    const idViejo = movil.id
    const salida = evento(host, 'camara:par-fin')
    movil.disconnect()
    const aviso = await salida
    assert.equal(aviso.de, idViejo); assert.equal(aviso.rol, 'emisor'); assert.equal(aviso.dispositivoId, dispositivoId)
    const nuevo = await conectar()
    const unido = await ack(nuevo, 'camara:unir', {codigo, dispositivoId})
    assert.equal(unido.ok, true); assert.notEqual(unido.peerId, idViejo)
    const reconectado = evento(host, 'camara:senal')
    nuevo.emit('camara:senal', {codigo, para:host.id, data:{tipo:'offer', sdp:'nueva'}})
    const paquete = await reconectado
    assert.equal(paquete.dispositivoId, dispositivoId); assert.equal(paquete.de, nuevo.id)
  } finally {
    clientes.forEach(c => c.disconnect())
    await new Promise(r => io.close(r))
    if (http.listening) await new Promise(r => http.close(r))
  }
})
function evento(socket, nombre) {
  return new Promise((resolve, reject) => {
    const limite = setTimeout(() => { socket.off(nombre, recibir); reject(Error(`Timeout ${nombre}`)) }, 2000)
    const recibir = dato => { clearTimeout(limite); resolve(dato) }
    socket.once(nombre, recibir)
  })
}
