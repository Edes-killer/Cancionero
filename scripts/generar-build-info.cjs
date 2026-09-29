// Genera trazabilidad reproducible para incorporar a web, APK y Electron.
// No incluye usuario, rutas, secretos ni fecha: solo versión y commit Git.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')

const raiz = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'))
const git = (args) => execFileSync('git', args, { cwd:raiz, encoding:'utf8', windowsHide:true }).trim()
const estadoDiff = (args) => spawnSync('git', args, { cwd:raiz, windowsHide:true }).status

let commit
try { commit = git(['rev-parse', 'HEAD']) } catch { throw Error('No se pudo determinar el commit Git del build') }
const trabajo = estadoDiff(['diff', '--quiet'])
const indice = estadoDiff(['diff', '--cached', '--quiet'])
if (![0, 1].includes(trabajo) || ![0, 1].includes(indice)) throw Error('No se pudo comprobar el estado Git del build')

const info = {
  schema:1,
  version:pkg.version,
  commit,
  dirtyTracked:trabajo === 1 || indice === 1,
}
const destino = path.join(raiz, 'public', 'build-info.json')
fs.writeFileSync(destino, JSON.stringify(info))
console.log(`Build ${info.version} · ${commit.slice(0, 8)}${info.dirtyTracked ? ' · cambios rastreados sin commit' : ''}`)
