const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { normalizarTiempos, duracionParte } = require("../lib/tiemposAuto.ts")

test("los tiempos corruptos no habilitan un avance inmediato ni cambian los índices", () => {
  assert.deepEqual(normalizarTiempos({ tiempo: 100 }), [])
  assert.deepEqual(normalizarTiempos([null, -2, "4000", 12000, Infinity, 0]), [0, 0, 0, 12000])
  assert.equal(duracionParte([0, 0, 12000], 0), 12000)
  assert.equal(duracionParte([], 2), 15000)
})

test("la duración aprendida de cada parte se respeta", () => {
  const tiempos = normalizarTiempos([10000, 23000, 40000])
  assert.equal(duracionParte(tiempos, 1), 23000)
  assert.equal(duracionParte(tiempos, 9), 40000)
})

test("cambiar de ítem detiene el reloj anterior y retroceder lo reinicia", () => {
  const control = fs.readFileSync("app/control/page.tsx", "utf8")
  assert.match(control, /const irAItemLista = async[\s\S]{0,550}detenerAutoAvance\(\)/)
  assert.match(control, /const partesCancion = await getPartesCancion[\s\S]{0,250}setTiemposAprendidos\(cargarTiempos\(item\.id\)\)/)
  assert.ok((control.match(/if \(autoAvanceActivo\) iniciarAutoAvance\(tiemposAprendidos, nuevo\)/g) || []).length >= 4)
})
