// Obtiene la URL base del servidor según el entorno
// En APK: usa la IP guardada en configuración
// En browser: usa window.location.hostname (comportamiento actual)

export const getServidorBase = (): string => {
  if (typeof window === "undefined") return "http://localhost"

  // APK: IP configurada manualmente
  const ipGuardada = localStorage.getItem("servidor_ip")
  const puertoGuardado = localStorage.getItem("servidor_puerto") || "3000"

  if (ipGuardada) {
    return `http://${ipGuardada}:${puertoGuardado}`
  }

  // Browser web: usar hostname actual
  return `http://${window.location.hostname}:${window.location.port || "3000"}`
}

export const getSocketUrl = (): string => {
  if (typeof window === "undefined") return "http://localhost:4000"

  const ipGuardada = localStorage.getItem("servidor_ip")
  if (ipGuardada) return `http://${ipGuardada}:4000`

  return `http://${window.location.hostname}:4000`
}