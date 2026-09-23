// Receptor TCP local para FLV: no publica, no usa cámara/micrófono ni credenciales.
const fs = require('node:fs')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { escribirFragmento } = require('../electron/escritura-transmision')
const { DiagnosticoTransmision } = require('../electron/diagnostico-transmision')
const ffmpeg = require('ffmpeg-static')
const segundos = Number(process.argv[2] || 60)
if (!Number.isFinite(segundos) || segundos < 10 || segundos > 1800) throw Error('Duración admitida: 10–1800 segundos')
const fuente = fs.readFileSync('electron/main.js','utf8')
const inicio = fuente.indexOf('function construirArgsFFmpeg('), fin = fuente.indexOf('\nfunction rutaLogTransmision', inicio)
if (inicio < 0 || fin < 0) throw Error('No se encontró configuración FFmpeg')
const construir = new Function(fuente.slice(inicio, fin) + '; return construirArgsFFmpeg;')()
;(async () => {
  let bytes = 0, errorProductor = '', colaMax = 0, salida = ''
  const sockets = new Set()
  const server = net.createServer(s => { sockets.add(s); s.on('data', b => bytes += b.length); s.on('error', () => {}); s.on('close', () => sockets.delete(s)) })
  await new Promise(r => server.listen(0,'127.0.0.1',r))
  const d = new DiagnosticoTransmision()
  const destino = `tcp://127.0.0.1:${server.address().port}`
  const encoder = process.argv[3] || 'h264_mf'
  const consumidor = spawn(ffmpeg, construir(encoder,[destino],6000), { windowsHide:true, stdio:['pipe','ignore','pipe'] })
  const productor = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-re','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t',String(segundos),'-c:v','libx264','-preset','ultrafast','-b:v','12000k','-c:a','libopus','-b:a','256k','-f','matroska','pipe:1'], { windowsHide:true, stdio:['ignore','pipe','pipe'] })
  const esperar = p => new Promise(resolve => { p.on('error', e => { console.error(e.message); resolve(-1) }); p.on('close', resolve) })
  const finP = esperar(productor), finC = esperar(consumidor)
  consumidor.stdin.on('error', () => {})
  consumidor.stderr.on('data', b => { d.stderr(b.toString()); salida = (salida + b.toString()).slice(-4000) })
  productor.stderr.on('data', b => errorProductor += b.toString())
  const timer = setTimeout(() => { productor.kill(); consumidor.kill() }, (segundos + 45)*1000)
  const informe = setInterval(() => console.log(JSON.stringify(d.estado(consumidor.stdin.writableLength, true))),15000)
  try {
    for await (const b of productor.stdout) {
      d.chunk(b.length)
      await escribirFragmento(consumidor.stdin,b,30000,()=>d.cuadros)
      colaMax = Math.max(colaMax,consumidor.stdin.writableLength)
    }
    consumidor.stdin.end()
    const codigos = await Promise.all([finP,finC])
    d.stderr('\n')
    const ok = codigos.every(c=>c===0) && bytes > 0 && d.cuadros >= segundos*29 && d.dts===0
    console.log(JSON.stringify({ok, segundos, encoder, codigos, cuadros:d.cuadros, avisosTiempo:d.dts, bytesRecibidos:bytes, colaMax}))
    if (!ok) { console.error(salida, errorProductor); process.exitCode=1 }
  } catch(e) { console.error(e.message); process.exitCode=1 }
  finally { clearInterval(informe); clearTimeout(timer); productor.kill(); consumidor.kill(); sockets.forEach(s=>s.destroy()); server.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
