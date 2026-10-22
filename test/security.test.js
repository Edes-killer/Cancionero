const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const {
  rutaDentroDe, nombreArchivoSeguro, esOrigenInterno, esEnlaceWeb,
  esAutorizacionSupabase, destinoCallbackOAuth, destinoCallbackOAuthLocal, esOrigenServidorSelah,
  normalizarDireccionRed, esDireccionLoopback, pantallaSelahValida,
  salaSelahValida, pinSalaValido, pinSalaCoincide, puedeSenalizarEmision,
} = require("../electron/security")
const { EventEmitter } = require("node:events")
const { protegerSalida } = require("../electron/safe-output")
const fs = require("node:fs")

test("las rutas estáticas no pueden escapar de la carpeta pública", () => {
  const raiz = path.resolve("out")
  assert.equal(rutaDentroDe(raiz, "control/index.html"), path.join(raiz, "control", "index.html"))
  assert.equal(rutaDentroDe(raiz, "../../package.json"), null)
  assert.equal(rutaDentroDe(raiz, "..\\package.json"), null)
})

test("la galería rechaza rutas y extensiones ajenas", () => {
  const media = /\.(webp|jpg|jpeg|png|gif)$/i
  assert.equal(nombreArchivoSeguro("logo.webp", media), "logo.webp")
  assert.equal(nombreArchivoSeguro("../logo.webp", media), null)
  assert.equal(nombreArchivoSeguro("script.exe", media), null)
})

test("la seguridad LAN distingue el escritorio local de otros equipos", () => {
  assert.equal(normalizarDireccionRed("::ffff:127.0.0.1"), "127.0.0.1")
  assert.equal(esDireccionLoopback("::1"), true)
  assert.equal(esDireccionLoopback("127.0.0.1"), true)
  assert.equal(esDireccionLoopback("192.168.1.20"), false)
  assert.equal(esOrigenServidorSelah("http://localhost:3000/control/"), true)
  assert.equal(esOrigenServidorSelah("http://127.0.0.1:3000/"), true)
  assert.equal(esOrigenServidorSelah("http://localhost:9999/"), false)
  assert.equal(esOrigenServidorSelah("https://sitio-malicioso.example/"), false)
})

test("las salas, pantallas y PIN se validan antes de autorizar", () => {
  assert.equal(pantallaSelahValida("control"), true)
  assert.equal(pantallaSelahValida("administrador"), false)
  assert.equal(salaSelahValida("cb7db0f2-7e9a-4cb7-bdfb-2bdd57ca1630"), true)
  assert.equal(salaSelahValida("../otra"), false)
  assert.equal(pinSalaValido("7391"), true)
  assert.equal(pinSalaValido("12x4"), false)
  assert.equal(pinSalaCoincide("7391", "7391"), true)
  assert.equal(pinSalaCoincide("7391", "0000"), false)
})

test("la señal WebRTC directa solo circula entre pares de la misma emisión", () => {
  assert.equal(puedeSenalizarEmision({ rol:"emisor", codigo:"ABC123" }, { rol:"espectador", codigo:"ABC123" }), true)
  assert.equal(puedeSenalizarEmision({ rol:"espectador", codigo:"ABC123" }, { rol:"emisor", codigo:"ABC123" }), true)
  assert.equal(puedeSenalizarEmision({ rol:"espectador", codigo:"OTRA" }, { rol:"emisor", codigo:"ABC123" }), false)
  assert.equal(puedeSenalizarEmision({ rol:"espectador", codigo:"ABC123" }, { rol:"espectador", codigo:"ABC123" }), false)
})

test("Electron ignora una IP remota guardada y usa su servidor loopback", () => {
  const servidor = fs.readFileSync("lib/servidor.ts", "utf8")
  assert.match(servidor, /navigator\.userAgent\.includes\("Electron"\)\) return "http:\/\/127\.0\.0\.1:4000"/)
  assert.ok(servidor.indexOf('navigator.userAgent.includes("Electron")') < servidor.indexOf("NEXT_PUBLIC_SOCKET_URL"))
})

test("Electron solo confía en su origen interno y abre enlaces web", () => {
  assert.equal(esOrigenInterno("http://localhost:3000/control/"), true)
  assert.equal(esOrigenInterno("http://127.0.0.1:3000/"), true)
  assert.equal(esOrigenInterno("https://ejemplo.cl/"), false)
  assert.equal(esEnlaceWeb("https://selah-live.vercel.app/"), true)
  assert.equal(esEnlaceWeb("javascript:alert(1)"), false)
  assert.equal(esEnlaceWeb("file:///C:/secreto.txt"), false)
})

test("Google se abre fuera de Electron y el callback solo vuelve a una ruta interna", () => {
  assert.equal(esAutorizacionSupabase("https://ejemplo.supabase.co/auth/v1/authorize?provider=google"), true)
  assert.equal(esAutorizacionSupabase("https://ejemplo.cl/auth/v1/authorize?provider=google"), false)
  assert.equal(esAutorizacionSupabase("https://ejemplo.supabase.co/otro?provider=google"), false)
  assert.equal(destinoCallbackOAuth("selahlive://auth/callback#access_token=abc&refresh_token=def"), "http://localhost:3000/auth/callback/#access_token=abc&refresh_token=def")
  assert.equal(destinoCallbackOAuth("selahlive://evil/callback#access_token=abc&refresh_token=def"), null)
  assert.equal(destinoCallbackOAuth("https://evil.cl/#access_token=abc&refresh_token=def"), null)
  assert.equal(destinoCallbackOAuth("selahlive://auth/callback?code=codigo%20pkce"), "http://localhost:3000/auth/callback/?code=codigo%20pkce")
  assert.equal(destinoCallbackOAuth("selahlive://auth/callback#error=access_denied"), "http://localhost:3000/login/?error=oauth&detalle=access_denied")
  assert.deepEqual(
    destinoCallbackOAuthLocal("http://localhost:3000/auth/callback/?selah_nonce=unico#access_token=abc&refresh_token=def"),
    {
      nonce: "unico",
      destino: "http://localhost:3000/auth/callback/?selah_nonce=unico#access_token=abc&refresh_token=def",
    },
  )
  assert.equal(destinoCallbackOAuthLocal("https://evil.cl/auth/callback/?selah_nonce=unico#access_token=abc&refresh_token=def"), null)
  assert.equal(destinoCallbackOAuthLocal("http://localhost:3000/otra/?selah_nonce=unico#access_token=abc&refresh_token=def"), null)
  const login = fs.readFileSync("app/login/page.tsx", "utf8")
  const main = fs.readFileSync("electron/main.js", "utf8")
  const preload = fs.readFileSync("electron/preload.js", "utf8")
  assert.match(login, /skipBrowserRedirect: isCapacitor \|\| isElectron/)
  assert.match(login, /puente\.abrirGoogle\(data\.url\)/)
  assert.match(main, /setAsDefaultProtocolClient\("selahlive"/)
  assert.match(main, /evento\.sender !== mainWindow\.webContents/)
  assert.match(main, /const enlaceOAuthInicial = process\.argv\.find/)
  assert.match(main, /oauth-pendiente\.json/)
  assert.match(main, /let protocoloSelahRegistrado = false/)
  assert.match(main, /app\.isDefaultProtocolClient\("selahlive"/)
  assert.match(main, /tipo !== "google" && !protocoloSelahRegistrado/)
  assert.match(main, /redirectTo: `http:\/\/localhost:3000\/auth\/callback\/\?selah_nonce=/)
  assert.match(main, /req\.url\?\.startsWith\("\/oauth\/entregar"\)/)
  assert.match(main, /crypto\.randomBytes\(24\)/)
  assert.match(main, /if \(enlaceOAuthInicial\) recibirCallbackOAuth\(enlaceOAuthInicial\)/)
  assert.match(main, /ipcMain\.handle\("oauth:preparar-retorno"/)
  assert.match(preload, /prepararRetorno: \(tipo\) => ipcRenderer\.invoke\("oauth:preparar-retorno", tipo\)/)
  assert.match(preload, /diagnostico: \(evento, codigo\) => ipcRenderer\.send\("auth:diagnostico"/)
  assert.match(main, /ipcMain\.on\("auth:diagnostico"/)
  assert.match(main, /replace\(\/\[\^a-z0-9_-\]\//)
  assert.match(main, /error\?\.code === "EADDRINUSE"/)
  assert.match(main, /Selah Live ya está abierto/)
  assert.match(main, /mainWindow\.isMinimized\(\)/)
  assert.match(login, /prepararRetorno/)
  assert.match(login, /prepararRetorno\?\.\("google"\)/)
  assert.match(login, /navigator\.userAgent\.includes\("Electron"\)\) return "selahlive:\/\/auth\/callback"/)
})

test("cerrar la consola no derriba el proceso principal", () => {
  const salida = new EventEmitter()
  protegerSalida(salida)
  protegerSalida(salida)
  assert.equal(salida.listenerCount("error"), 1)
  assert.doesNotThrow(() => salida.emit("error", Object.assign(new Error("broken pipe"), { code: "EPIPE" })))
})

test("la actualización de escritorio mantiene un progreso visible hasta instalar", () => {
  const main = fs.readFileSync("electron/main.js", "utf8")
  const installer = fs.readFileSync("electron/installer.nsh", "utf8")
  assert.match(main, /function traerVentanaProgresoAlFrente\(/)
  assert.match(main, /if \(!ventanaProgreso\.isVisible\(\)\) ventanaProgreso\.show\(\)/)
  assert.match(main, /closable: false[\s\S]{0,160}show: true/)
  assert.doesNotMatch(main, /backgroundColor: "#0b1220", show: false/)
  assert.match(main, /webContents\.once\("did-finish-load"[\s\S]{0,180}aplicarEstadoVentanaProgreso\(\)/)
  assert.match(main, /autoUpdater\.on\("download-progress"[\s\S]{0,800}actualizarProgreso\(/)
  const inicioDescargada = main.indexOf('autoUpdater.on("update-downloaded"')
  const finDescargada = main.indexOf('autoUpdater.on("error"')
  const descargada = main.slice(inicioDescargada, finDescargada)
  assert.match(descargada, /fase: "instalando"/)
  assert.match(descargada, /aplicarEstadoVentanaProgreso\(\)/)
  assert.match(descargada, /autoUpdater\.quitAndInstall\(false, true\)/)
  assert.ok(descargada.indexOf('fase: "instalando"') < descargada.indexOf("autoUpdater.quitAndInstall"))
  assert.match(descargada, /guardarEstadoInstalacion\(info\?\.version/)
  assert.match(main, /function leerResultadoInstalacion\(/)
  assert.match(main, /actualizacion_instalada/)
  assert.match(main, /Actualización \$\{resultado\.version\} completada/)
  assert.match(installer, /Banner::show \/NOUNLOAD "Selah Live" "Paso 1 de 3/)
  assert.match(installer, /Paso 2 de 3 - Instalando archivos/)
  assert.match(installer, /Banner::destroy/)
})

test("la APK muestra porcentaje real y el empaquetado exige un OTA trazable", () => {
  const ota = fs.readFileSync("components/OtaUpdater.tsx", "utf8")
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
  const verificador = fs.readFileSync("scripts/qa-artefactos.cjs", "utf8")
  assert.match(ota, /addListener\("download"/)
  assert.match(ota, /aria-label="Progreso de actualización"/)
  assert.match(ota, /aria-valuenow=\{estado\.porcentaje\}/)
  assert.match(ota, /\{estado\.porcentaje\}%/)
  assert.match(pkg.scripts["candidata:build"], /npm run ota -- --sin-build/)
  assert.match(verificador, /const ota = path\.join\(raiz, 'bundle\.zip'\)/)
  assert.match(verificador, /validarBuildInfo\(datos, 'El bundle OTA'\)/)
})

test("la migración cierra la elevación de privilegios y aísla multimedia", () => {
  const sql = fs.readFileSync("supabase/migrations/20260908_security_hardening.sql", "utf8")
  assert.match(sql, /^begin;/m)
  assert.match(sql, /drop policy if exists "usuario actualiza su propio registro"/i)
  assert.match(sql, /drop policy if exists "usuario inserta su propio registro"/i)
  assert.match(sql, /create or replace function public\.aceptar_invitacion/i)
  assert.match(sql, /public\.iglesia_de_ruta_storage\(name\)/i)
  assert.match(sql, /alter column iglesia_id drop default/i)
  assert.match(sql, /commit;\s*$/i)
})

test("crear y unirse a iglesias usa RPC atómicos, no inserciones directas", () => {
  const crear = fs.readFileSync("app/crear-iglesia/page.tsx", "utf8")
  const onboarding = fs.readFileSync("app/onboarding/page.tsx", "utf8")
  const unirse = fs.readFileSync("app/unirse/page.tsx", "utf8")
  assert.match(crear, /rpc\("crear_iglesia_segura"/)
  assert.match(onboarding, /rpc\("crear_iglesia_segura"/)
  assert.match(unirse, /rpc\("ver_invitacion"/)
  assert.match(unirse, /rpc\("aceptar_invitacion"/)
  for (const codigo of [crear, onboarding, unirse]) {
    assert.doesNotMatch(codigo, /from\("usuarios_iglesia"\)[\s\S]{0,160}\.insert\(/)
  }
})

test("Electron distribuido nunca acepta credenciales elevadas de Supabase", () => {
  const main = fs.readFileSync("electron/main.js", "utf8")
  assert.doesNotMatch(main, /SUPABASE_SERVICE_KEY|SUPABASE_SECRET_KEY|service_role/i)
})

test("el código versionado no contiene formatos comunes de secretos", () => {
  const { execFileSync } = require("node:child_process")
  const archivos = execFileSync("git", ["ls-files", "-z"]).toString().split("\0").filter(Boolean)
  const patrones = [
    /ghp_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /sb_secret_[A-Za-z0-9_-]{20,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ]
  for (const archivo of archivos) {
    if (!fs.existsSync(archivo) || fs.statSync(archivo).size > 2_000_000) continue
    const contenido = fs.readFileSync(archivo, "utf8")
    for (const patron of patrones) {
      assert.doesNotMatch(contenido, patron, `secreto potencial en ${archivo}`)
    }
  }
})
