const test = require("node:test")
const assert = require("node:assert/strict")
const { construirSecuenciaCoro, resincronizarPosicion } = require("../lib/secuenciaCoro.ts")

const partes = tipos => tipos.map(tipo => ({ tipo }))

test("repetir coro intercala un coro ubicado al medio o al final", () => {
  assert.deepEqual(construirSecuenciaCoro(partes(["Verso", "Coro", "Verso", "Puente"]), true), [0, 1, 2, 1, 3, 1])
  assert.deepEqual(construirSecuenciaCoro(partes(["Verso", "Verso", "Coro"]), true), [0, 2, 1, 2])
})

test("sin repetir o sin coro conserva el orden; solo coros nunca desaparecen", () => {
  assert.deepEqual(construirSecuenciaCoro(partes(["Verso", "Coro", "Verso"]), false), [0, 1, 2])
  assert.deepEqual(construirSecuenciaCoro(partes(["Verso", "Puente"]), true), [0, 1])
  assert.deepEqual(construirSecuenciaCoro(partes(["Coro"]), true), [0])
})

test("adelantar, retroceder y saltar manualmente mantienen el puntero", () => {
  const seq = construirSecuenciaCoro(partes(["Verso", "Coro", "Verso", "Verso"]), true)
  assert.equal(resincronizarPosicion(seq, 1, 1), 1)
  assert.equal(resincronizarPosicion(seq, 2, 1), 2)
  assert.equal(resincronizarPosicion(seq, 1, 2), 3)
  assert.equal(resincronizarPosicion(seq, 3, 3), 4)
  assert.equal(resincronizarPosicion(seq, 0, 5), 0)
})
