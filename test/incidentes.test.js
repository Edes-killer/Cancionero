const test = require("node:test")
const assert = require("node:assert/strict")
const { explicarIncidente } = require("../lib/incidentes.ts")

test("distingue rechazo de plataforma de una cámara interrumpida", () => {
  const plataforma = explicarIncidente("A TLS fatal alert has been received al abrir RTMPS", "transmision")
  const camara = explicarIncidente("Búfer elevado; la cámara dejó de enviar fotogramas", "camara")
  assert.equal(plataforma.codigo, "SALIDA-PLATAFORMA")
  assert.equal(plataforma.prioridad, "critico")
  assert.equal(camara.codigo, "FUENTE-INTERRUMPIDA")
  assert.match(camara.accion, /celular|punto de acceso/i)
})

test("explica permisos, fuente ocupada, audio, motor y red", () => {
  assert.equal(explicarIncidente("NotAllowedError: no diste permiso", "camara").codigo, "PERMISO-MEDIOS")
  assert.equal(explicarIncidente("NotReadableError: cámara ocupada", "camara").codigo, "FUENTE-OCUPADA")
  assert.equal(explicarIncidente("Non-monotonic DTS de audio", "transmision").codigo, "AUDIO-INESTABLE")
  assert.equal(explicarIncidente("FFmpeg encoder bajo speed=0.3", "transmision").codigo, "MOTOR-VIDEO")
  assert.equal(explicarIncidente("Socket no responde en la misma red", "conexion").codigo, "CONEXION-LOCAL")
})

test("un incidente desconocido sigue entregando una acción segura", () => {
  const guia = explicarIncidente("condición extraña", "transmision")
  assert.equal(guia.codigo, "TX-GENERAL")
  assert.ok(guia.accion.length > 20)
  assert.ok(guia.conserva.length > 10)
})
