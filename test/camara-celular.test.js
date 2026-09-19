const test = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")

const movil = readFileSync("app/camara/page.tsx", "utf8")
const transmision = readFileSync("app/en-vivo/page.tsx", "utf8")
const electron = readFileSync("electron/main.js", "utf8")
const inicio = readFileSync("app/page.tsx", "utf8")
const servidor = readFileSync("lib/servidor.ts", "utf8")

test("Electron abre la sala de cámara en su servidor local y confirma el registro", () => {
  assert.match(transmision, /io\("http:\/\/127\.0\.0\.1:4000"/)
  assert.match(transmision, /socket\.emit\("camara:host", \{ codigo \}, \(resp: any\) =>/)
  assert.match(electron, /socket\.on\("camara:host", \(\{ codigo \} = \{\}, cb\) =>/)
  assert.match(electron, /cb\(\{ ok: true, codigo: codigoFinal \}\)/)
  assert.match(transmision, /Abriendo sala segura…/)
  assert.match(transmision, /setCamEstado\("esperando"\)/)
})

test("ambos extremos conservan candidatos ICE que llegan antes del SDP", () => {
  assert.match(movil, /icePendienteRef/)
  assert.match(movil, /if \(pc\.remoteDescription\) await pc\.addIceCandidate/)
  assert.match(movil, /for \(const candidate of pendientes\) await pc\.addIceCandidate/)
  assert.match(transmision, /camIcePendienteRef/)
  assert.match(transmision, /if \(pc\?\.remoteDescription\) await pc\.addIceCandidate/)
  assert.match(transmision, /for \(const candidate of pendientes\) await pc\.addIceCandidate/)
})

test("los fallos WebRTC dejan diagnóstico visible y persistente", () => {
  assert.match(movil, /WebRTC celular: señal/)
  assert.match(transmision, /Falló el intercambio WebRTC con el celular/)
  assert.match(transmision, /Cámara celular: señal/)
})

test("la APK corrige una IP de router o repetidor buscando el PC real", () => {
  assert.match(movil, /buscarServidorEnRed/)
  assert.match(movil, /No responde esa IP\. Buscando el PC con Selah en la red/)
  assert.match(movil, /localStorage\.setItem\("servidor_ip", ip\)/)
  assert.match(movil, /PC encontrado en \$\{ip\}\. Reconectando/)
})

test("la transmisión evita comprimir dos veces con el mismo bitrate bajo", () => {
  assert.match(transmision, /baja: 2500, media: 4500, alta: 6000/)
  assert.match(transmision, /const bitrateCaptura =/)
  assert.match(transmision, /videoBitsPerSecond: bitrateCaptura\(bitrateRef\.current\) \* 1000/)
  assert.match(electron, /"-rate_control", "cbr", "-scenario", "live_streaming"/)
  assert.match(electron, /"-b:a", "160k", "-ar", "48000"/)
})

test("la cadena de video conserva detalle Full HD y registra la fuente real", () => {
  assert.match(transmision, /const SALIDA_ANCHO = 1920, SALIDA_ALTO = 1080/)
  assert.match(transmision, /width: \{ ideal: 1920 \}, height: \{ ideal: 1080 \}/)
  assert.match(transmision, /width=\{SALIDA_ANCHO\} height=\{SALIDA_ALTO\}/)
  assert.match(transmision, /ctx\.setTransform\(ESCALA_SALIDA/)
  assert.match(transmision, /diagnosticoFuentesVideo/)
  assert.match(transmision, /▶ salida de video: \$\{SALIDA_ANCHO\}×\$\{SALIDA_ALTO\} @ 30 fps/)
})

test("el celular negocia su capacidad nativa y prioriza resolución", () => {
  assert.match(movil, /width: \{ ideal: 3840 \}, height: \{ ideal: 2160 \}/)
  assert.match(movil, /degradationPreference = "maintain-resolution"/)
  assert.match(movil, /maxBitrate = 20_000_000/)
  assert.match(movil, /setResolucion\(`/)
})

test("la sala de cámara dirige señales y admite varios celulares", () => {
  assert.match(electron, /hostId.*camaraRol === "host"/s)
  assert.match(electron, /cb\(\{ ok: true, peerId: socket\.id, hostId \}\)/)
  assert.match(electron, /if \(para.*io\.to\(para\)\.emit\("camara:senal"/)
  assert.match(transmision, /pcHostsRef = useRef<Map<string, RTCPeerConnection>>/)
  assert.match(transmision, /phoneStreamsRef = useRef<Map<string, MediaStream>>/)
  assert.match(transmision, /celulares\.map\(c => <option/)
})

test("la cámara recuerda la sala pero permite reemplazar un código antiguo", () => {
  assert.match(transmision, /selah-camara-host-code/)
  assert.match(movil, /const cambiarCodigo = \(\) =>/)
  assert.match(movil, /localStorage\.removeItem\("selah-camara-codigo"\)/)
  assert.match(movil, /Cambiar código/)
})

test("Android libera el sender antes de abrir la cámara frontal", () => {
  assert.match(movil, /videoSenderRef\.current\?\.replaceTrack\(null\)/)
  assert.match(movil, /const esperas = \[900, 1400, 2200, 3200\]/)
  assert.match(movil, /porEtiqueta\?\.deviceId/)
  assert.match(movil, /getUserMedia\(\{ video, audio \}\)/)
  assert.match(movil, /nuevoVideo\.applyConstraints\(VIDEO_MAX\)/)
})

test("un estado WebRTC transitorio no provoca un bucle de reconexión", () => {
  assert.match(movil, /estableciendoRef/)
  assert.match(movil, /pc\.connectionState === "disconnected"/)
  assert.match(movil, /}, 8000\)/)
  assert.match(movil, /removeAllListeners\(\)/)
})

test("Transmisión se abre aparte para sobrevivir al navegar a Control", () => {
  assert.match(inicio, /window\.open\(`\$\{window\.location\.origin\}\/en-vivo`, "selah-transmision"\)/)
  assert.match(electron, /Transmisión corre en su propia ventana operativa/)
  assert.match(electron, /backgroundThrottling: false/)
})

test("una APK recién instalada busca el PC sin obligar a entrar en Ajustes", () => {
  assert.match(inicio, /if \(esApk && !localStorage\.getItem\("servidor_ip"\)\) void descubrir\(\)/)
  assert.match(inicio, /Buscando el computador…/)
  assert.match(inicio, /Selah está revisando automáticamente la red local/)
  assert.match(servidor, /for \(let i = 1; i <= 254; i\+\+\) SUBREDES_COMUNES\.forEach/)
})

test("la reconexión RTMPS espera a que Facebook libere la sesión anterior", () => {
  assert.match(transmision, /Math\.min\(5000 \* n, 30000\)/)
  assert.match(transmision, /Facebook puede tardar varios segundos en liberar una sesión RTMPS caída/)
})
