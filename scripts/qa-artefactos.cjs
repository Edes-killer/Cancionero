// Valida artefactos ya construidos. No compila, publica ni lee contraseñas.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const raiz = path.resolve(__dirname, '..')
const estrictoPublicacion = process.argv.includes('--publicar')
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'))
const version = pkg.version
const apk = path.join(raiz, 'selah-live.apk')
const exe = path.join(raiz, 'dist-electron', `Selah Live Setup ${version}.exe`)
const metadata = path.join(raiz, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'output-metadata.json')
const latestYml = path.join(raiz, 'dist-electron', 'latest.yml')
const firmaAndroidEsperada = 'e2f870e235bbdf4bee71ed91b8d82c21cad9543839b1518068a65f3a7b5dab55'
const errores = []
const avisos = []

const sha256 = archivo => crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex').toUpperCase()
const exigirArchivo = archivo => {
  if (!fs.existsSync(archivo)) { errores.push(`Falta ${path.relative(raiz, archivo)}`); return false }
  if (fs.statSync(archivo).size === 0) { errores.push(`${path.relative(raiz, archivo)} está vacío`); return false }
  return true
}

for (const manifiesto of ['public/version.json', 'public/ota.json']) {
  const datos = JSON.parse(fs.readFileSync(path.join(raiz, manifiesto), 'utf8'))
  if (datos.version !== version) errores.push(`${manifiesto} anuncia ${datos.version}, pero package.json usa ${version}`)
}

if (exigirArchivo(metadata)) {
  const datos = JSON.parse(fs.readFileSync(metadata, 'utf8'))
  const elemento = datos.elements?.[0]
  const esperado = version.split('.').map(Number)
  const versionCodeEsperado = esperado[0] * 1000000 + esperado[1] * 10000 + esperado[2]
  if (elemento?.versionName !== version) errores.push(`APK declara versionName ${elemento?.versionName || 'desconocida'}`)
  if (elemento?.versionCode !== versionCodeEsperado) errores.push(`APK declara versionCode ${elemento?.versionCode || 'desconocido'}; se esperaba ${versionCodeEsperado}`)
}

let apkInfo = null
if (exigirArchivo(apk)) {
  const sdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'build-tools')
  const versiones = fs.existsSync(sdk) ? fs.readdirSync(sdk).sort((a,b) => b.localeCompare(a, undefined, { numeric:true })) : []
  const apksigner = versiones.map(v => path.join(sdk, v, 'apksigner.bat')).find(fs.existsSync)
  if (!apksigner) errores.push('No se encontró apksigner para verificar la APK')
  else {
    const r = spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      '& $env:SELAH_APKSIGNER verify --verbose --print-certs $env:SELAH_APK',
    ], {
      encoding:'utf8', windowsHide:true,
      env:{ ...process.env, SELAH_APKSIGNER:apksigner, SELAH_APK:apk },
    })
    const salida = `${r.stdout || ''}\n${r.stderr || ''}`
    if (r.status !== 0 || !/^Verifies$/m.test(salida)) errores.push('La APK no supera apksigner verify')
    const firma = /certificate SHA-256 digest:\s*([a-f0-9]+)/i.exec(salida)?.[1]?.toLowerCase()
    if (firma !== firmaAndroidEsperada) errores.push(`La APK no usa el certificado histórico esperado (${firma || 'sin firma'})`)
    apkInfo = { bytes:fs.statSync(apk).size, sha256:sha256(apk), firma }
  }
}

let windowsInfo = null
if (exigirArchivo(exe)) {
  let r = null
  for (const interprete of ['pwsh.exe', 'powershell.exe']) {
    const intento = spawnSync(interprete, ['-NoProfile', '-Command', '(Get-AuthenticodeSignature -LiteralPath $env:SELAH_ARTEFACTO).Status.value__'], {
      encoding:'utf8', windowsHide:true, env:{ ...process.env, SELAH_ARTEFACTO:exe },
    })
    if (intento.status === 0 && (intento.stdout || '').trim()) { r = intento; break }
  }
  if (!r) errores.push('No fue posible verificar Authenticode del instalador Windows')
  const estadosFirma = { 0:'Valid', 1:'UnknownError', 2:'NotSigned', 3:'HashMismatch', 4:'NotTrusted', 5:'NotSupported' }
  const codigoFirma = Number.parseInt((r?.stdout || '').trim(), 10)
  const firma = estadosFirma[codigoFirma] || `Desconocida (${Number.isNaN(codigoFirma) ? 'sin respuesta' : codigoFirma})`
  windowsInfo = { bytes:fs.statSync(exe).size, sha256:sha256(exe), authenticode:firma }
  if (firma !== 'Valid') {
    const mensaje = `El instalador Windows tiene Authenticode ${firma}; puede activar SmartScreen`
    if (estrictoPublicacion) errores.push(mensaje)
    else avisos.push(mensaje)
  }
}

if (exigirArchivo(latestYml)) {
  const contenido = fs.readFileSync(latestYml, 'utf8')
  const publicada = /^version:\s*['"]?([^'"\s]+)['"]?/m.exec(contenido)?.[1]
  if (publicada !== version) errores.push(`latest.yml declara ${publicada || 'sin versión'}; se esperaba ${version}`)
  if (!contenido.includes(`Selah-Live-Setup-${version}.exe`)) errores.push('latest.yml no apunta al instalador esperado')
}

const informe = { ok:errores.length === 0, modo:estrictoPublicacion ? 'publicación' : 'candidata', version, apk:apkInfo, windows:windowsInfo, avisos, errores }
console.log(JSON.stringify(informe, null, 2))
if (errores.length) process.exitCode = 1
