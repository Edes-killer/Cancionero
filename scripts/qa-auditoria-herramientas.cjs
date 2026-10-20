const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

// Estas dos alertas no tienen una versión corregida publicada al 19-10-2026.
// Solo llegan por herramientas de desarrollo (lint y empaquetado), nunca por
// el código distribuido. El gate de producción corre aparte y no admite esta
// excepción. Se usan IDs de advisory para que cualquier alerta nueva bloquee.
const AVISOS_TEMPORALES = new Map([
  [1240992, "braces (lint de Next.js)"],
  [1241202, "sprintf-js (electron-builder)"],
])

const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
if (!fs.existsSync(npmCli)) {
  console.error("No se encontró npm para ejecutar la auditoría.")
  process.exit(1)
}
const resultado = spawnSync(process.execPath, [npmCli, "audit", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: false,
  maxBuffer: 30 * 1024 * 1024,
})
if (resultado.error) {
  console.error(`No se pudo ejecutar npm audit: ${resultado.error.message}`)
  process.exit(1)
}

let informe
try {
  informe = JSON.parse(resultado.stdout || "{}")
} catch {
  console.error("No se pudo interpretar npm audit.")
  if (resultado.stderr?.trim()) console.error(resultado.stderr.trim())
  process.exit(1)
}

const vulnerabilidades = informe.vulnerabilities || {}
const fuentesPorNombre = new Map(
  Object.keys(vulnerabilidades).map(nombre => [nombre, new Set()]),
)

// npm puede entregar dependencias circulares (por ejemplo electron-builder ↔
// app-builder-lib). Primero registramos los avisos directos y luego propagamos
// sus IDs hasta llegar a un punto fijo. Así ningún ciclo oculta su advisory real.
for (const [nombre, nodo] of Object.entries(vulnerabilidades)) {
  const fuentes = fuentesPorNombre.get(nombre)
  for (const via of nodo?.via || []) {
    if (typeof via === "object" && Number.isInteger(via.source)) fuentes.add(via.source)
  }
}

let cambio = true
while (cambio) {
  cambio = false
  for (const [nombre, nodo] of Object.entries(vulnerabilidades)) {
    const destino = fuentesPorNombre.get(nombre)
    for (const via of nodo?.via || []) {
      if (typeof via !== "string") continue
      for (const fuente of fuentesPorNombre.get(via) || []) {
        if (destino.has(fuente)) continue
        destino.add(fuente)
        cambio = true
      }
    }
  }
}

const bloqueos = []
const aceptados = new Set()
for (const [nombre, nodo] of Object.entries(vulnerabilidades)) {
  const fuentes = fuentesPorNombre.get(nombre)
  const soloTemporales = fuentes.size > 0 && [...fuentes].every(f => AVISOS_TEMPORALES.has(f))
  if (nodo.severity === "critical" || !soloTemporales) {
    bloqueos.push(`${nombre} (${nodo.severity})`)
    continue
  }
  for (const fuente of fuentes) aceptados.add(fuente)
}

if (bloqueos.length) {
  console.error(`Vulnerabilidades de herramientas no autorizadas: ${bloqueos.join(", ")}`)
  process.exit(1)
}

if (aceptados.size) {
  console.log("Avisos temporales, solo en herramientas y sin parche disponible:")
  for (const fuente of aceptados) console.log(`- GHSA ${fuente}: ${AVISOS_TEMPORALES.get(fuente)}`)
}
console.log("Auditoría de herramientas aprobada; cualquier advisory nuevo seguirá bloqueando.")
