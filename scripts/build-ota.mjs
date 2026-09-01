// Crea el bundle OTA (parte web) para actualizar el celular SIN reinstalar el APK.
// Deja "bundle.zip" en la raíz, listo para subir al release de GitHub.
//
//   npm run ota
//
// Pasos: next build → @capgo/cli bundle zip (estructura correcta + valida notifyAppReady).

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const version = JSON.parse(readFileSync("./package.json", "utf8")).version
const appId = "com.tuiglesia.cancionero"
const run = (cmd) => { console.log("\n▶ " + cmd); execSync(cmd, { stdio: "inherit" }) }

console.log(`\n📦 Bundle OTA (web) · versión ${version}`)
run("npm run build")
run(`npx --yes @capgo/cli@latest bundle zip ${appId} --path out --name bundle.zip`)

console.log(`\n✅ Listo: bundle.zip  (v${version})`)
console.log('→ Súbelo al release de GitHub como asset con el nombre "bundle.zip".')
console.log('   Los celulares compatibles lo descargan y muestran “Aplicar”; no interrumpe el culto por sí solo.')
