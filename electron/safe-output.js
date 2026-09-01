const MARCA = Symbol.for("selah.salida.protegida")

function protegerSalida(stream) {
  if (!stream || typeof stream.on !== "function" || stream[MARCA]) return
  stream[MARCA] = true
  stream.on("error", (error) => {
    // Una salida de consola no es parte del funcionamiento de Selah. EPIPE es
    // normal si se cierra PowerShell/CMD, si un test termina o si Electron se
    // desacopla de quien lo inició. El proceso principal debe seguir vivo.
    if (error?.code === "EPIPE") return
    // Tampoco relanzar otros errores del canal de diagnóstico: hacerlo abriría
    // el mismo diálogo que intentamos evitar y no aportaría recuperación.
  })
}

module.exports = { protegerSalida }
