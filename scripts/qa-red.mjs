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
  registrar("El emisor no recibe eco", !eco.recibido)
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
} catch (error) {
  registrar("Laboratorio conectado", false, error?.message || String(error))
} finally {
  sockets.forEach(socket => socket.close())
}

const fallos = resultados.filter(r => !r.ok)
console.log(`\n${resultados.length - fallos.length}/${resultados.length} pruebas aprobadas`)
if (fallos.length) process.exitCode = 1
