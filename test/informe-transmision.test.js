const test = require("node:test")
const assert = require("node:assert/strict")

test("el informe resume la sesión sin necesitar direcciones ni claves RTMP", async () => {
  const { crearInformeTransmision } = await import("../lib/informeTransmision.ts")
  const informe = crearInformeTransmision({
    inicio: 1_000,
    fin: 3_661_000,
    calidad: "alta",
    bitrateKbps: 6000,
    destinos: ["Facebook", "YouTube"],
    reconexiones: 2,
    cuadrosCaidos: 4,
    grabacionActivada: true,
    grabacionMB: 512,
    carpetaGrabacion: "Videos/Selah Live",
    diagnostico: { diagnostico: "Con avance", cuadros: 9000, detalle: "rtmps://servidor/CLAVE-SECRETA" },
  })

  assert.match(informe, /Duración: 01:01:00/)
  assert.match(informe, /Destinos: Facebook, YouTube/)
  assert.match(informe, /Reconexiones: 2/)
  assert.doesNotMatch(informe, /rtmps?:\/\//i)
  assert.doesNotMatch(informe, /CLAVE-SECRETA/)
})

test("el informe tolera métricas ausentes", async () => {
  const { crearInformeTransmision } = await import("../lib/informeTransmision.ts")
  const informe = crearInformeTransmision({
    inicio: Number.NaN,
    fin: 10_000,
    calidad: "media",
    bitrateKbps: 4500,
    destinos: [],
    reconexiones: 0,
    cuadrosCaidos: null,
    grabacionActivada: false,
    grabacionMB: 0,
  })
  assert.match(informe, /Cuadros caídos informados: Sin datos/)
  assert.match(informe, /Diagnóstico final del motor:\nNo disponible/)
})
