const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Writable } = require('node:stream')
const { ColaTransmision } = require('../lib/colaTransmision.ts')
const { escribirFragmento } = require('../electron/escritura-transmision')

test('espera confirmación antes de entregar el próximo fragmento y conserva orden', async () => {
  const salida = []
  const sink = new Writable({ write(b, _, cb) { setTimeout(() => { salida.push(b.toString()); cb() }, 5) } })
  const errores = [], cola = new ColaTransmision(e => errores.push(e))
  for (const texto of ['cabecera', 'video1', 'audio1']) cola.agregar(texto.length, () => escribirFragmento(sink, Buffer.from(texto)))
  await cola.terminar(); sink.end()
  assert.deepEqual(salida, ['cabecera','video1','audio1']); assert.deepEqual(errores, [])
})
test('cola saturada falla una vez y no descarta fragmentos para continuar un contenedor corrupto', async () => {
  const errores = [], cola = new ColaTransmision(e => errores.push(e), 4)
  let tareas = 0
  cola.agregar(3, async () => { tareas++ })
  cola.agregar(3, async () => { tareas++ })
  cola.agregar(3, async () => { tareas++ })
  await cola.terminar()
  assert.equal(errores.length, 1); assert.equal(tareas, 0)
})
test('pipe bloqueado vence plazo y limpia listeners', async () => {
  const sink = new Writable({ write() {} })
  await assert.rejects(escribirFragmento(sink, Buffer.from('video'), 20), /no confirma progreso/)
  assert.equal(sink.listenerCount('error'), 0); assert.equal(sink.listenerCount('close'), 0)
  sink.destroy()
})
test('cierre del motor libera espera sin aguardar timeout', async () => {
  const sink = new Writable({ write() {} })
  const pendiente = escribirFragmento(sink, Buffer.from('video'))
  sink.destroy()
  await assert.rejects(pendiente, /cerró/)
})

test('escritura pendiente no vence si FFmpeg sigue avanzando', async () => {
  let cuadros = 0
  const sink = new Writable({ write(b, _, cb) { setTimeout(cb, 160) } })
  const timer = setInterval(() => cuadros++, 10)
  try { await escribirFragmento(sink, Buffer.from('video'), 50, () => cuadros) }
  finally { clearInterval(timer); sink.destroy() }
})

test('estadísticas repetidas no se confunden con progreso', async () => {
  const sink = new Writable({ write() {} })
  try { await assert.rejects(escribirFragmento(sink, Buffer.from('video'), 30, () => 793), /no confirma progreso/) }
  finally { sink.destroy() }
})
test('error de escritura detiene la cola y no lanza tareas siguientes', async () => {
  const sink = new Writable({ write(b, _, cb) { cb(Error('pipe roto')) } })
  // Equivale al listener permanente del proceso principal.
  sink.on('error', () => {})
  const errores = [], cola = new ColaTransmision(e => errores.push(e))
  let segundo = false
  cola.agregar(1, () => escribirFragmento(sink, Buffer.from('a')))
  cola.agregar(1, async () => { segundo = true })
  await cola.terminar()
  assert.equal(segundo, false); assert.deepEqual(errores, ['pipe roto'])
})
test('rechaza fragmento mayor al límite antes de escribirlo', async () => {
  let escrito = false
  const sink = new Writable({ write(b, _, cb) { escrito = true; cb() } })
  await assert.rejects(escribirFragmento(sink, Buffer.alloc(8 * 1024 * 1024 + 1)), /saturada/)
  assert.equal(escrito, false); sink.destroy()
})

test('FFmpeg real recibe contenedor completo mediante escritura confirmada', { timeout: 15000 }, async () => {
  const { spawn } = require('node:child_process')
  const ffmpeg = require('ffmpeg-static')
  const productor = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-t','2','-c:v','libx264','-preset','ultrafast','-f','matroska','pipe:1'], { windowsHide:true, stdio:['ignore','pipe','pipe'] })
  const consumidor = spawn(ffmpeg, ['-hide_banner','-loglevel','info','-i','pipe:0','-vf','fps=30','-f','null','-'], { windowsHide:true, stdio:['pipe','ignore','pipe'] })
  let log = '', logProductor = ''
  consumidor.stdin.on('error', () => {})
  consumidor.stderr.on('data', b => log += b.toString())
  productor.stderr.on('data', b => logProductor += b.toString())
  const esperar = p => new Promise((resolve, reject) => { p.once('error', reject); p.once('close', resolve) })
  const finalProductor = esperar(productor), finalConsumidor = esperar(consumidor)
  const limite = setTimeout(() => { productor.kill(); consumidor.kill() }, 10000)
  try {
    for await (const chunk of productor.stdout) await escribirFragmento(consumidor.stdin, chunk)
    consumidor.stdin.end()
    assert.equal(await finalProductor, 0, logProductor)
    assert.equal(await finalConsumidor, 0, log)
    assert.match(log, /frame=\s*60/)
    assert.doesNotMatch(log, /File ended prematurely|Non-monotonic DTS/)
  } finally { clearTimeout(limite); productor.kill(); consumidor.kill() }
})
