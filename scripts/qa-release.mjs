import { spawnSync } from "node:child_process"

const npmCli = process.env.npm_execpath

if (!npmCli) {
  console.error("No se pudo localizar npm. Ejecuta esta comprobación mediante npm run qa:release.")
  process.exit(1)
}

const comprobaciones = [
  {
    nombre: "Cambios sin errores de formato Git",
    comando: "git",
    args: ["diff", "--check"],
  },
  {
    nombre: "Pruebas automatizadas",
    comando: process.execPath,
    args: [npmCli, "test"],
  },
  {
    nombre: "Compilación web y TypeScript",
    comando: process.execPath,
    args: [npmCli, "run", "build"],
  },
  {
    nombre: "Dependencias de producción",
    comando: process.execPath,
    args: [npmCli, "audit", "--omit=dev", "--audit-level=high"],
  },
  {
    nombre: "Sintaxis del proceso principal Electron",
    comando: process.execPath,
    args: ["--check", "electron/main.js"],
  },
  {
    nombre: "Sintaxis del puente Electron",
    comando: process.execPath,
    args: ["--check", "electron/preload.js"],
  },
  {
    nombre: "Sintaxis de seguridad Electron",
    comando: process.execPath,
    args: ["--check", "electron/security.js"],
  },
]

const resultados = []

console.log("\n🧪 QA de publicación — Selah Live\n")

for (const prueba of comprobaciones) {
  console.log(`▶ ${prueba.nombre}`)
  const inicio = Date.now()
  const resultado = spawnSync(prueba.comando, prueba.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 30 * 1024 * 1024,
  })

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
  const aprobada = resultado.status === 0 && !resultado.error
  resultados.push({ nombre: prueba.nombre, aprobada, segundos })

  if (aprobada) {
    console.log(`✅ Aprobada (${segundos}s)\n`)
    continue
  }

  console.error(`❌ Falló (${segundos}s)`)
  if (resultado.error) console.error(resultado.error.message)
  if (resultado.stdout?.trim()) console.error(resultado.stdout.trim())
  if (resultado.stderr?.trim()) console.error(resultado.stderr.trim())
  console.error("\nLa publicación fue bloqueada. Corrige esta comprobación y vuelve a ejecutar npm run qa:release.\n")
  process.exit(1)
}

console.log("Resumen")
for (const resultado of resultados) {
  console.log(`${resultado.aprobada ? "✅" : "❌"} ${resultado.nombre} · ${resultado.segundos}s`)
}
console.log(`\n✅ ${resultados.length}/${resultados.length} comprobaciones aprobadas. La versión puede pasar a empaquetado y prueba física.\n`)
