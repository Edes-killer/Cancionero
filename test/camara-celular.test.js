const test = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")

const movil = readFileSync("app/camara/page.tsx", "utf8")
const transmision = readFileSync("app/en-vivo/page.tsx", "utf8")
const electron = readFileSync("electron/main.js", "utf8")

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
