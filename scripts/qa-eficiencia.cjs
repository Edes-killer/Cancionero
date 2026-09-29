// Compara el pipeline real de salida contra un receptor TCP local. No abre
// cámara, micrófono, Internet ni destinos RTMP y nunca usa credenciales.
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const segundos = Number(process.argv[2] || 30)
if (!Number.isFinite(segundos) || segundos < 10 || segundos > 300) {
  throw Error('Duración admitida: 10–300 segundos')
}

const ensayo = path.join(__dirname, 'qa-envio-local.cjs')
const encoders = process.platform === 'win32' ? ['h264_mf', 'libx264'] : ['libx264']
const resultados = []

for (const encoder of encoders) {
  console.log(`\n▶ ${encoder} · ${segundos}s · 1920×1080 @ 30 fps`)
  const proceso = spawnSync(process.execPath, [ensayo, String(segundos), encoder], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: (segundos + 60) * 1000,
    windowsHide: true,
  })
  const lineas = (proceso.stdout || '').trim().split(/\r?\n/).filter(Boolean)
  let resultado = null
  for (let i = lineas.length - 1; i >= 0; i--) {
    try { resultado = JSON.parse(lineas[i]); break } catch {}
  }
  if (!resultado || typeof resultado.ok !== 'boolean') {
    resultado = { ok:false, encoder, error:(proceso.stderr || 'Sin resultado del ensayo').trim() }
  }
  resultados.push(resultado)
  console.log(JSON.stringify(resultado))
}

const aprobados = resultados.filter(r => r.ok && r.colaMax === 0 && r.avisosTiempo === 0)
const recomendado = aprobados.find(r => r.encoder === 'h264_mf') || aprobados[0] || null
const informe = {
  ok: aprobados.length > 0,
  segundos,
  recomendado: recomendado?.encoder || null,
  criterio: '30 fps, sin cola y sin avisos de tiempo',
  resultados,
}

console.log('\nResumen')
console.log(JSON.stringify(informe, null, 2))
if (!informe.ok) process.exitCode = 1
