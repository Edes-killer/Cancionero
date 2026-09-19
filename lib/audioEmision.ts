export interface CadenaAudioEmision {
  entrada: GainNode
  entradaMedidor: AnalyserNode
  retardo: DelayNode
  volumen: GainNode
  proteccion: DynamicsCompressorNode
  silencio: GainNode
  salida: AnalyserNode
  monitor: GainNode
}

export function crearCadenaAudioEmision(ctx: BaseAudioContext): CadenaAudioEmision {
  const entrada = ctx.createGain()
  const entradaMedidor = ctx.createAnalyser()
  const retardo = ctx.createDelay(2)
  const volumen = ctx.createGain()
  const proteccion = ctx.createDynamicsCompressor()
  const silencio = ctx.createGain()
  const salida = ctx.createAnalyser()
  const monitor = ctx.createGain()
  monitor.gain.value = 0
  entradaMedidor.fftSize = salida.fftSize = 2048
  // Compresión de picos, no reparación de una señal que ya llega recortada.
  proteccion.threshold.value = -3
  proteccion.knee.value = 0
  proteccion.ratio.value = 20
  proteccion.attack.value = 0.003
  proteccion.release.value = 0.15
  entrada.connect(entradaMedidor)
  entradaMedidor.connect(retardo)
  retardo.connect(volumen)
  volumen.connect(proteccion)
  proteccion.connect(silencio)
  silencio.connect(salida)
  salida.connect(monitor)
  return { entrada, entradaMedidor, retardo, volumen, proteccion, silencio, salida, monitor }
}

export function ajustarAudioEmision(
  cadena: CadenaAudioEmision, ctx: BaseAudioContext,
  volumen: number, retardoMs: number, silenciar: boolean,
) {
  const volumenSeguro = Number.isFinite(volumen) ? Math.max(0, Math.min(150, volumen)) : 100
  const retardoSeguro = Number.isFinite(retardoMs) ? Math.max(0, Math.min(2000, retardoMs)) : 0
  cadena.volumen.gain.setTargetAtTime(volumenSeguro / 100, ctx.currentTime, 0.01)
  cadena.retardo.delayTime.setTargetAtTime(retardoSeguro / 1000, ctx.currentTime, 0.01)
  // El silencio queda después del retardo y del compresor: nada pendiente se filtra en Espera.
  cadena.silencio.gain.cancelScheduledValues(ctx.currentTime)
  cadena.silencio.gain.setValueAtTime(silenciar ? 0 : 1, ctx.currentTime)
}

export function medirAudio(muestras: Float32Array): { picoDb: number; rmsDb: number } {
  let pico = 0, suma = 0
  for (const valor of muestras) { pico = Math.max(pico, Math.abs(valor)); suma += valor * valor }
  const db = (valor: number) => valor > 0 ? Math.max(-96, 20 * Math.log10(valor)) : -96
  return { picoDb: db(pico), rmsDb: db(Math.sqrt(suma / Math.max(1, muestras.length))) }
}
