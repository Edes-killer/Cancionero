const GIB = 1024 ** 3
const MINIMO_BYTES = 1 * GIB
const RECOMENDADO_BYTES = 8 * GIB

function evaluarEspacioGrabacion(libresBytes) {
  const libres = Number(libresBytes)
  if (!Number.isFinite(libres) || libres < 0) {
    return { nivel: "desconocido", libresBytes: null, puedeGrabar: true, detalle: "No se pudo medir el espacio libre." }
  }
  const libresGB = libres / GIB
  if (libres < MINIMO_BYTES) {
    return {
      nivel: "bloqueado",
      libresBytes: libres,
      puedeGrabar: false,
      detalle: `Solo quedan ${libresGB.toFixed(1)} GB. Libera espacio antes de grabar.`,
    }
  }
  if (libres < RECOMENDADO_BYTES) {
    return {
      nivel: "advertencia",
      libresBytes: libres,
      puedeGrabar: true,
      detalle: `Quedan ${libresGB.toFixed(1)} GB. Para un culto largo se recomiendan al menos 8 GB libres.`,
    }
  }
  return {
    nivel: "ok",
    libresBytes: libres,
    puedeGrabar: true,
    detalle: `${libresGB.toFixed(1)} GB disponibles para grabaciones.`,
  }
}

module.exports = { evaluarEspacioGrabacion, MINIMO_BYTES, RECOMENDADO_BYTES }
