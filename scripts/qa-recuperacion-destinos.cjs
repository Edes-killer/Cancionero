// Prueba de integración: un destino se corta y vuelve mientras el segundo
// continúa. Usa el mismo constructor FFmpeg de producción, sin Internet ni claves.
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')

const raiz = path.resolve(__dirname, '..')
const ffmpeg = require('ffmpeg-static')
const fuente = fs.readFileSync(path.join(raiz, 'electron', 'main.js'), 'utf8')
const inicio = fuente.indexOf('function construirArgsFFmpeg(')
const fin = fuente.indexOf('\nfunction rutaLogTransmision', inicio)
if (inicio < 0 || fin < 0) throw Error('No se encontró construirArgsFFmpeg')
const construir = new Function(fuente.slice(inicio, fin) + '; return construirArgsFFmpeg;')()

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms))
const escuchar = servidor => new Promise((resolve, reject) => {
  servidor.once('error', reject)
  servidor.listen(0, '127.0.0.1', () => resolve(servidor.address().port))
})
const cerrar = servidor => new Promise(resolve => {
  if (!servidor.listening) return resolve()
  servidor.close(() => resolve())
})

async function principal() {
  let bytesEstable = 0
  let bytesInestable = 0
  let conexionesInestables = 0
  let socketInestable = null

  const estable = net.createServer(socket => socket.on('data', datos => { bytesEstable += datos.length }))
  const inestableInicial = net.createServer(socket => {
    conexionesInestables++
    socketInestable = socket
    socket.on('data', datos => { bytesInestable += datos.length })
  })
  const puertoEstable = await escuchar(estable)
  const puertoInestable = await escuchar(inestableInicial)

  const urls = [`tcp://127.0.0.1:${puertoEstable}`, `tcp://127.0.0.1:${puertoInestable}`]
  const argsConsumidor = construir('libx264', urls, 1800)
  const consumidor = spawn(ffmpeg, argsConsumidor, {
    windowsHide:true, stdio:['pipe', 'ignore', 'pipe'],
  })
  let stderr = ''
  consumidor.stderr.on('data', dato => { stderr += dato.toString() })

  const productor = spawn(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-re',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '16', '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '2500k',
    '-c:a', 'libopus', '-b:a', '128k', '-f', 'matroska', 'pipe:1',
  ], { windowsHide:true, stdio:['ignore', 'pipe', 'pipe'] })
  productor.stdout.pipe(consumidor.stdin)

  await esperar(3500)
  const bytesEstableAntes = bytesEstable
  const bytesInestableAntes = bytesInestable
  socketInestable?.destroy()
  await cerrar(inestableInicial)

  await esperar(2500)
  const inestableRecuperado = net.createServer(socket => {
    conexionesInestables++
    socket.on('data', datos => { bytesInestable += datos.length })
  })
  await new Promise((resolve, reject) => {
    inestableRecuperado.once('error', reject)
    inestableRecuperado.listen(puertoInestable, '127.0.0.1', resolve)
  })

  const codigoProductor = await new Promise(resolve => productor.once('close', resolve))
  const codigoConsumidor = await new Promise(resolve => consumidor.once('close', resolve))
  await Promise.all([cerrar(estable), cerrar(inestableRecuperado)])

  const recuperacionDetectada = /Recovery successful/i.test(stderr)
  const resultado = {
    ok: codigoProductor === 0 && codigoConsumidor === 0 &&
      bytesEstable > bytesEstableAntes && bytesInestable > bytesInestableAntes && conexionesInestables >= 2 && recuperacionDetectada,
    codigos:[codigoProductor, codigoConsumidor],
    estable:{ antes:bytesEstableAntes, total:bytesEstable },
    inestable:{ antes:bytesInestableAntes, total:bytesInestable, conexiones:conexionesInestables },
    recuperacionDetectada,
    eventos:stderr.split(/[\r\n]+/).filter(linea => /fifo|tee|tcp|recover|error|connection/i.test(linea)).slice(-20),
  }
  console.log(JSON.stringify(resultado, null, 2))
  if (!resultado.ok) {
    console.error(stderr.slice(-4000))
    process.exitCode = 1
  }
}

principal().catch(error => { console.error(error); process.exitCode = 1 })
