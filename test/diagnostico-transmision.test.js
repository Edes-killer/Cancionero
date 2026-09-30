const { test } = require('node:test')
const assert = require('node:assert/strict')
const { DiagnosticoTransmision, ocultarDestinos } = require('../electron/diagnostico-transmision')
test('captura ausente y cola acumulada se distinguen', () => {
  const d = new DiagnosticoTransmision(0)
  assert.match(d.estado(0,true,13000).diagnostico, /No llegan fragmentos/)
  d.chunk(100,14000)
  assert.match(d.estado(5000000,true,14001).diagnostico, /Datos acumulados/)
})
test('estadísticas fragmentadas y múltiples líneas conservan último avance', () => {
  const d = new DiagnosticoTransmision(0)
  d.stderr('fra',100); d.stderr('me=10 fps=30\rframe=20 fps=30\n',200)
  assert.equal(d.estado(0,true,300).cuadros,20)
  assert.equal(d.estado(0,true,300).avanceMs,100)
})
test('frame repetido no confirma avance; caso del culto de 26 segundos', () => {
  const d = new DiagnosticoTransmision(0)
  d.stderr('frame=793 time=00:00:27.16\r',27000)
  d.stderr('frame=793 time=00:00:27.16\r',44000)
  d.chunk(100,44000)
  assert.match(d.estado(0,true,44000).diagnostico,/no confirma cuadros nuevos/)
})
test('rechazo de destino prevalece sobre error de conexión genérico', () => {
  const d = new DiagnosticoTransmision(0)
  d.stderr('Publish Rejected: Invalid URL\nI/O error\n',1)
  assert.match(d.estado(0,false,2).diagnostico,/Destino rechazado/)
})
test('una recuperación limpia la alarma de conexión pero no un rechazo permanente', () => {
  const conexion = new DiagnosticoTransmision(0)
  conexion.stderr('TLS fatal alert\n', 1)
  assert.match(conexion.estado(0, true, 2).diagnostico, /intentando recuperarla/)
  conexion.recuperacionDestino()
  assert.doesNotMatch(conexion.estado(0, true, 3).diagnostico, /interrumpida/)

  const rechazo = new DiagnosticoTransmision(0)
  rechazo.stderr('Publish Rejected: Invalid URL\n', 1)
  rechazo.recuperacionDestino()
  assert.match(rechazo.estado(0, true, 2).diagnostico, /Destino rechazado/)
})
test('timestamps se contabilizan y la salud nunca confirma Facebook', () => {
  const d = new DiagnosticoTransmision(0)
  d.stderr('frame=1\nNon-monotonic DTS\nQueue input is backward in time\n',100)
  assert.equal(d.estado(0,true,200).avisosTiempo,2)
  assert.match(d.estado(0,false,200).diagnostico,/detenido/)
})
test('el diagnóstico final conserva la causa aunque el proceso ya esté detenido', () => {
  const entrada = new DiagnosticoTransmision(0)
  entrada.finalizar('Límite de video pendiente alcanzado.', 'entrada', null)
  assert.deepEqual(
    { texto: entrada.estado(0, false, 100).diagnostico, tipo: entrada.estado(0, false, 100).finTipo, codigo: entrada.estado(0, false, 100).codigoSalida },
    { texto: 'Límite de video pendiente alcanzado.', tipo: 'entrada', codigo: null },
  )

  const conexion = new DiagnosticoTransmision(0)
  conexion.stderr('TLS fatal alert\n', 10)
  conexion.finalizar('La conexión con el destino se interrumpió y el motor terminó.', 'conexion', 1)
  const estado = conexion.estado(0, false, 100)
  assert.match(estado.diagnostico, /conexión con el destino/i)
  assert.equal(estado.finTipo, 'conexion')
  assert.equal(estado.codigoSalida, 1)
})
test('redacción no expone claves de destinos simples ni tee', () => {
  const oculto = ocultarDestinos("rtmps://host/app/SECRETO [f=flv]rtmp://host/OTRO|rtmps://x/TERCERO")
  for (const clave of ['SECRETO','OTRO','TERCERO']) assert.ok(!oculto.includes(clave))
})
