const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
test('audio resincroniza huecos antes de asignar timestamps por muestras', () => {
  const s = fs.readFileSync('electron/main.js','utf8')
  const i=s.indexOf('function construirArgsFFmpeg('), f=s.indexOf('\nfunction rutaLogTransmision',i)
  const construir=new Function(s.slice(i,f)+';return construirArgsFFmpeg;')()
  for(const encoder of ['h264_mf','h264_qsv','libx264']) {
    const args=construir(encoder,['rtmp://127.0.0.1/prueba'],6000)
    assert.equal(args[args.indexOf('-af')+1],'aresample=async=1000:first_pts=0,asetpts=N/SR/TB')
    assert.equal(args[args.indexOf('-vf')+1],'fps=30')
  }
})
