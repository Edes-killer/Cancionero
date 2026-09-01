import { io } from "socket.io-client"

const servidor = process.argv[2] || process.env.SELAH_QA_SERVER || "http://127.0.0.1:4000"
const sala = `qa-${Date.now()}`
const otraSala = `${sala}-aislada`
const pin = "7391"

const resultados = []
const registrar = (nombre, ok, detalle = "") => {
  resultados.push({ nombre, ok, detalle })
  console.log(`${ok ? "✅" : "❌"} ${nombre}${detalle ? ` — ${detalle}` : ""}`)
}

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const conectar = () => new Promise((resolve, reject) => {
  const socket = io(servidor, { transports: ["websocket", "polling"], timeout: 3000, reconnection: false })
  const timer = setTimeout(() => { socket.close(); reject(new Error("timeout")) }, 4000)
  socket.once("connect", () => { clearTimeout(timer); resolve(socket) })
  socket.once("connect_error", error => { clearTimeout(timer); reject(error) })
})

const eventoEn = (socket, evento, ms = 900) => new Promise(resolve => {
  let recibido = false
  const handler = data => { recibido = true; socket.off(evento, handler); resolve({ recibido, data }) }
  socket.on(evento, handler)
  setTimeout(() => { socket.off(evento, handler); resolve({ recibido, data: null }) }, ms)
})
const unir = (socket, datos) => new Promise(resolve => {
  const timer = setTimeout(() => resolve({ ok: false, error: "timeout_union" }), 2000)
  socket.emit("unirse-sala", datos, respuesta => { clearTimeout(timer); resolve(respuesta) })
})

let sockets = []
try {
  const ping = await fetch(`${servidor}/ping`, { signal: AbortSignal.timeout(3000) })
  const info = await ping.json()
  registrar("Servidor identificable", ping.ok && info.app === "selah-live", JSON.stringify(info))

  const traversal = await fetch(`${servidor}/imagenes/..%2Festado.json`)
  registrar("La galería bloquea rutas manipuladas", traversal.status === 400, `HTTP ${traversal.status}`)

  const borrarGrande = await fetch(`${servidor}/api/imagenes/eliminar`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "X".repeat(12_000) }),
  })
  registrar("El servidor limita solicitudes grandes", borrarGrande.status === 413, `HTTP ${borrarGrande.status}`)

  const archivoRaro = new FormData()
  archivoRaro.append("archivo", new Blob(["QA"], { type: "application/octet-stream" }), "prueba-qa.exe")
  const formato = await fetch(`${servidor}/api/imagenes/guardar`, { method: "POST", body: archivoRaro })
  registrar("La galería rechaza extensiones extrañas", formato.status === 415, `HTTP ${formato.status}`)

  const [controlA, controlB, proyector, aislado, pinMalo, intruso] = await Promise.all(
    Array.from({ length: 6 }, conectar)
  )
  sockets = [controlA, controlB, proyector, aislado, pinMalo, intruso]

  await unir(proyector, { sala, pantalla: "proyectar" })
  await unir(controlA, { sala, pantalla: "control", pin })
  await unir(controlB, { sala, pantalla: "control", pin })
  await unir(aislado, { sala: otraSala, pantalla: "proyectar" })
  await unir(intruso, { sala, pantalla: "musicos" })

  const pinInvalidoP = eventoEn(pinMalo, "pin-invalido")
  const unionMalaP = unir(pinMalo, { sala, pantalla: "control", pin: "0000" })
  const pinInvalido = await pinInvalidoP
  const unionMala = await unionMalaP
  registrar("PIN incorrecto rechazado", pinInvalido.recibido && unionMala?.error === "pin_invalido")

  const recibeB = eventoEn(controlB, "cambiar-parte")
  const recibeProyector = eventoEn(proyector, "cambiar-parte")
  const recibeEmisor = eventoEn(controlA, "cambiar-parte", 500)
  const recibeAislado = eventoEn(aislado, "cambiar-parte", 500)
  controlA.emit("cambiar-parte", 3)
  const [b, p, eco, fuga] = await Promise.all([recibeB, recibeProyector, recibeEmisor, recibeAislado])
  registrar("Dos controles se sincronizan", b.recibido && b.data === 3)
  registrar("El proyector recibe el cambio", p.recibido && p.data === 3)
  registrar("El servidor confirma al emisor", eco.recibido && eco.data === 3)
  registrar("Las iglesias quedan aisladas", !fuga.recibido)

  const inyeccionP = eventoEn(proyector, "mostrar-banner-urgente", 700)
  intruso.emit("mostrar-banner-urgente", "PRUEBA QA NO DEBE APARECER")
  const inyeccion = await inyeccionP
  registrar("Un rol músico no puede proyectar", !inyeccion.recibido,
    inyeccion.recibido ? "VULNERABILIDAD: el servidor aceptó el comando" : "comando bloqueado")

  const bridgeP = eventoEn(proyector, "mostrar-estado", 700)
  intruso.emit("bridge-nube", { evento: "mostrar-estado", data: { tipo: "negro" } })
  const bridge = await bridgeP
  registrar("Un rol músico no puede usar el puente nube", !bridge.recibido)

  // ── Modo caos: dos operadores escriben casi al mismo tiempo ─────────────
  const partesQa = Array.from({ length: 6 }, (_, i) => ({ tipo: `Parte ${i + 1}`, texto: `QA ${i + 1}` }))
  const cargaP = eventoEn(proyector, "cargar-cancion")
  controlA.emit("cargar-cancion", { titulo: "QA CAOS", partes: partesQa, index: 0 })
  await cargaP

  let ultimoA = 0, ultimoB = 0, ultimoP = 0
  controlA.on("cambiar-parte", valor => { ultimoA = valor })
  controlB.on("cambiar-parte", valor => { ultimoB = valor })
  proyector.on("cambiar-parte", valor => { ultimoP = valor })
  for (let i = 0; i < 20; i++) {
    controlA.emit("cambiar-parte", 1)
    controlB.emit("cambiar-parte", 4)
  }
  await esperar(500)
  const estadoP = eventoEn(proyector, "estado-actual")
  proyector.emit("get-estado")
  const estadoCaos = await estadoP
  const indiceServidor = estadoCaos.data?.data?.index
  registrar("Comandos simultáneos convergen", ultimoA === indiceServidor && ultimoB === indiceServidor && ultimoP === indiceServidor,
    `A=${ultimoA} B=${ultimoB} P=${ultimoP} servidor=${indiceServidor}`)

  // Un índice fuera de los límites de la canción no debe corromper el estado.
  const antesInvalido = indiceServidor
  controlA.emit("cambiar-parte", -99)
  await esperar(150)
  const estadoInvalidoP = eventoEn(proyector, "estado-actual")
  proyector.emit("get-estado")
  const estadoInvalido = await estadoInvalidoP
  registrar("Índices inválidos son rechazados", estadoInvalido.data?.data?.index === antesInvalido)

  // Un Control que vuelve después de un corte debe recibir el estado vigente.
  controlB.close()
  controlA.emit("cambiar-parte", 2)
  await esperar(100)
  const reconectado = await conectar()
  sockets.push(reconectado)
  const restauradoP = eventoEn(reconectado, "restaurar-estado-control")
  const unionReconectada = await unir(reconectado, { sala, pantalla: "control", pin })
  const restaurado = await restauradoP
  registrar("Un control reconectado recupera el estado", unionReconectada?.ok && restaurado.recibido && restaurado.data?.index === 2)

  const bannerLargoP = eventoEn(proyector, "mostrar-banner-urgente")
  controlA.emit("mostrar-banner-urgente", "X".repeat(1000))
  const bannerLargo = await bannerLargoP
  registrar("Los mensajes urgentes tienen límite", bannerLargo.recibido && bannerLargo.data.length === 200)
} catch (error) {
  registrar("Laboratorio conectado", false, error?.message || String(error))
} finally {
  sockets.forEach(socket => socket.close())
}

const fallos = resultados.filter(r => !r.ok)
console.log(`\n${resultados.length - fallos.length}/${resultados.length} pruebas aprobadas`)
if (fallos.length) process.exitCode = 1
