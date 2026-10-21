const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const { prepararDestino, probarDestino, probarDestinos } = require("../electron/preflight-red")

test("la revisión de red admite RTMP(S) sin devolver la clave", () => {
  assert.deepEqual(prepararDestino("rtmps://live.example:443/rtmp/clave-privada"), {
    ok:true, host:"live.example", puerto:443, seguro:true,
  })
  assert.equal(JSON.stringify(prepararDestino("rtmps://live.example/rtmp/clave-privada")).includes("clave-privada"), false)
  assert.equal(prepararDestino("https://live.example/stream").ok, false)
  assert.equal(prepararDestino("rtmp://usuario:clave@live.example/stream").ok, false)
})

test("comprueba un receptor RTMP alcanzable sin enviar contenido", async () => {
  const servidor = net.createServer(socket => socket.end())
  await new Promise((resolve, reject) => servidor.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()))
  const direccion = servidor.address()
  const resultado = await probarDestino(`rtmp://127.0.0.1:${direccion.port}/live/secreto`, 2_000)
  servidor.close()
  assert.equal(resultado.ok, true)
  assert.equal(resultado.host, "127.0.0.1")
  assert.equal(JSON.stringify(resultado).includes("secreto"), false)
})

test("limita la revisión a cuatro destinos", async () => {
  const resultados = await probarDestinos(Array.from({ length:7 }, () => "http://invalido"), 500)
  assert.equal(resultados.length, 4)
  assert.ok(resultados.every(r => r.ok === false))
})
