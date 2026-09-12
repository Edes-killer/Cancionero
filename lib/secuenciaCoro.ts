export interface ParteConTipo { tipo?: string | null }

export const esParteCoro = (parte: ParteConTipo | null | undefined): boolean =>
  /coro|estribillo|chorus/i.test(parte?.tipo || "")

/** Secuencia de índices: el coro puede estar en cualquier posición del himno. */
export function construirSecuenciaCoro(partes: ParteConTipo[], intercalar: boolean): number[] {
  const indices = partes.map((_, i) => i)
  const coro = partes.findIndex(esParteCoro)
  if (!intercalar || coro < 0) return indices
  const versos = indices.filter(i => !esParteCoro(partes[i]))
  if (versos.length === 0) return indices // un himno compuesto solo por coros no debe quedar vacío
  return versos.flatMap(verso => [verso, coro])
}

/** Mantiene el recorrido después de un clic directo o de un cambio remoto. */
export function resincronizarPosicion(seq: number[], parteActual: number, posicion: number): number {
  if (seq[posicion] === parteActual) return posicion
  for (let i = Math.max(0, posicion); i < seq.length; i++) if (seq[i] === parteActual) return i
  for (let i = 0; i < seq.length; i++) if (seq[i] === parteActual) return i
  return 0
}
