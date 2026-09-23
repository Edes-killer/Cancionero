// Mide la separación de inicios de destello y tono en una señal de prueba negra/blanca.
// No mide sincronía labial de dispositivos físicos.
function medirPulsos(log, tolerancia = 0.2, duracion = null) {
  // Los detectores pueden cerrar un tramo negro/silencioso al EOF: no es un pulso.
  const inicioValido = t => duracion === null || t < duracion - 0.5
  const video = [...log.matchAll(/black_end:\s*([\d.]+)/g)].map(m=>+m[1]).filter(inicioValido)
  const audio = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map(m=>+m[1]).filter(inicioValido)
  const esperados = duracion === null ? null : Math.max(0, Math.ceil((duracion - 3) / 5))
  const pares = Math.min(video.length,audio.length)
  const desfases = Array.from({length:pares},(_,i)=>audio[i]-video[i])
  const maximo = pares ? Math.max(...desfases.map(Math.abs)) : null
  return { ok: pares >= 2 && video.length === audio.length && (esperados === null || pares === esperados) && maximo <= tolerancia,
    esperados,
    pulsosVideo:video.length, pulsosAudio:audio.length, desfasesMs:desfases.map(n=>Math.round(n*1000)), maximoMs:maximo===null?null:Math.round(maximo*1000) }
}
module.exports={medirPulsos}
