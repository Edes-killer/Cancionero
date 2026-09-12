const MIN_MS = 1000
const MAX_MS = 60 * 60 * 1000
const PREDETERMINADO_MS = 15000

const esDuracionValida = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= MIN_MS && valor <= MAX_MS

/** Preserva los índices de parte; descarta datos corruptos sin desplazar tiempos. */
export function normalizarTiempos(valor: unknown): number[] {
  if (!Array.isArray(valor)) return []
  const tiempos = valor.slice(0, 500).map(t => esDuracionValida(t) ? t : 0)
  while (tiempos.length && tiempos[tiempos.length - 1] === 0) tiempos.pop()
  return tiempos
}

export function duracionParte(tiempos: number[], indice: number): number {
  if (esDuracionValida(tiempos[indice])) return tiempos[indice]
  for (let i = tiempos.length - 1; i >= 0; i--) {
    if (esDuracionValida(tiempos[i])) return tiempos[i]
  }
  return PREDETERMINADO_MS
}
