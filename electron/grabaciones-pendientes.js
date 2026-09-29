const fs = require("fs")
const path = require("path")

function datosSegmento(nombre) {
  const match = /^(.*?)(?: \((\d+)\))?\.mkv$/i.exec(nombre)
  if (!match) return null
  return { base: match[1], indice: match[2] ? Number(match[2]) : 1 }
}

function buscarGrabacionesPendientes(carpeta, excluirRutas = []) {
  const excluidas = new Set(excluirRutas.map(ruta => path.resolve(ruta)))
  const grupos = new Map()
  let nombres = []
  try { nombres = fs.readdirSync(carpeta) } catch { return [] }

  for (const nombreArchivo of nombres) {
    const datos = datosSegmento(nombreArchivo)
    if (!datos) continue
    const ruta = path.join(carpeta, nombreArchivo)
    if (excluidas.has(path.resolve(ruta))) continue
    let stat
    try { stat = fs.statSync(ruta) } catch { continue }
    if (!stat.isFile() || stat.size <= 0) continue
    const grupo = grupos.get(datos.base) || { id: datos.base, nombre: datos.base, archivos: [], bytes: 0, modificadoEn: 0 }
    grupo.archivos.push({ ruta, indice: datos.indice })
    grupo.bytes += stat.size
    grupo.modificadoEn = Math.max(grupo.modificadoEn, stat.mtimeMs)
    grupos.set(datos.base, grupo)
  }

  return [...grupos.values()]
    .map(grupo => ({ ...grupo, archivos: grupo.archivos.sort((a, b) => a.indice - b.indice).map(a => a.ruta) }))
    .sort((a, b) => b.modificadoEn - a.modificadoEn)
}

function lineaConcat(ruta) {
  const normalizada = path.resolve(ruta).replace(/\\/g, "/").replace(/'/g, "'\\''")
  return `file '${normalizada}'`
}

function crearPlanRecuperacion(archivos, salida, lista = null) {
  if (!Array.isArray(archivos) || archivos.length === 0) throw new Error("No hay segmentos para recuperar.")
  const comunes = ["-n", "-fflags", "+genpts", "-err_detect", "ignore_err"]
  if (archivos.length === 1) {
    return { args: [...comunes, "-i", archivos[0], "-c", "copy", "-movflags", "+faststart", salida], contenidoLista: null }
  }
  if (!lista) throw new Error("La recuperación de varios segmentos necesita un archivo de lista.")
  return {
    args: [...comunes, "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", salida],
    contenidoLista: archivos.map(lineaConcat).join("\n"),
  }
}

module.exports = { datosSegmento, buscarGrabacionesPendientes, crearPlanRecuperacion }
