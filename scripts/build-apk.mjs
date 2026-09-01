// Compila el APK y lo deja renombrado como "selah-live.apk" (o "-debug.apk"),
// listo para subir al release de GitHub (el nombre que espera el botón "Actualizar").
//
//   npm run apk         → release (firmado con tu keystore) → selah-live.apk
//   npm run apk:debug   → debug (firma de depuración)       → selah-live-debug.apk
//
// Pasos: next build → cap sync android → gradlew assemble → copiar/renombrar.

import { execSync } from "node:child_process"
import { existsSync, copyFileSync, mkdirSync, readFileSync } from "node:fs"
import { platform } from "node:os"

const debug = process.argv.includes("debug")
const version = JSON.parse(readFileSync("./package.json", "utf8")).version
const run = (cmd, opts = {}) => { console.log("\n▶ " + cmd); execSync(cmd, { stdio: "inherit", ...opts }) }

console.log(`\n📦 Construyendo APK ${debug ? "DEBUG" : "RELEASE"} · versión ${version}`)

// 1) Web estática + sincronizar a Android.
run("npm run build")
run("npx cap sync android")

// 2) Compilar el APK.
const gradlew = platform() === "win32" ? "gradlew.bat" : "./gradlew"
// En algunos hosts de escritorio Windows, Java NIO no puede crear su socket
// interno si TEMP/TMP apunta a una ruta virtualizada o demasiado larga. Gradle
// falla antes de compilar con "Unable to establish loopback connection".
// Una ruta temporal corta y local evita el problema sin modificar el sistema.
const gradleEnv = { ...process.env }
if (platform() === "win32") {
  const tempJava = "C:\\jtmp"
  mkdirSync(tempJava, { recursive: true })
  gradleEnv.TEMP = tempJava
  gradleEnv.TMP = tempJava
  gradleEnv.TMPDIR = tempJava
}
run(`${gradlew} ${debug ? "assembleDebug" : "assembleRelease"}`, { cwd: "android", env: gradleEnv })

// 3) Ubicar el APK generado y renombrarlo al nombre que espera el auto-aviso.
const salida = debug ? "selah-live-debug.apk" : "selah-live.apk"
const candidatos = debug
  ? ["android/app/build/outputs/apk/debug/app-debug.apk"]
  : ["android/app/build/outputs/apk/release/app-release.apk",
     "android/app/build/outputs/apk/release/app-release-unsigned.apk"]

const apk = candidatos.find(existsSync)
if (!apk) {
  console.error("\n✗ No se encontró el APK generado. Revisa el log de gradle arriba.")
  process.exit(1)
}
copyFileSync(apk, salida)

console.log(`\n✅ Listo: ${salida}  (v${version})`)
if (apk.includes("unsigned")) {
  console.warn("⚠ El APK quedó SIN FIRMAR (falta keystore.properties). No se puede instalar así.")
  console.warn("  Configura la firma de release antes de subirlo, o usa: npm run apk:debug para probar.")
} else if (!debug) {
  console.log('→ Súbelo al release de GitHub como asset con el nombre "selah-live.apk".')
}
