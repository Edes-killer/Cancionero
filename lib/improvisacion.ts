// ── Modo improvisación ───────────────────────────────────────────────────────
// A partir del TONO de una canción, sugiere las escalas para improvisar encima.
// Puro (sin React) para poder testearlo. Notas en español o americano.

const NOTAS_ES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"]
const NOTAS_EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// Token de nota (español/americano, sostenidos y bemoles) → índice cromático 0-11.
const IDX: Record<string, number> = {
  "do": 0, "c": 0, "do#": 1, "c#": 1, "reb": 1, "db": 1,
  "re": 2, "d": 2, "re#": 3, "d#": 3, "mib": 3, "eb": 3,
  "mi": 4, "e": 4, "fa": 5, "f": 5, "fa#": 6, "f#": 6, "solb": 6, "gb": 6,
  "sol": 7, "g": 7, "sol#": 8, "g#": 8, "lab": 8, "ab": 8,
  "la": 9, "a": 9, "la#": 10, "a#": 10, "sib": 10, "bb": 10,
  "si": 11, "b": 11,
}
const CLAVES = Object.keys(IDX).sort((a, b) => b.length - a.length) // más largas primero

// Intervalos (semitonos desde la tónica) de cada escala.
const DEF = {
  mayor:    [0, 2, 4, 5, 7, 9, 11],
  menorNat: [0, 2, 3, 5, 7, 8, 10],
  pentaMay: [0, 2, 4, 7, 9],
  pentaMen: [0, 3, 5, 7, 10],
  blues:    [0, 3, 5, 6, 7, 10],
}

export type Escala = { nombre: string; notas: string[]; clases: number[]; raiz: number; cuando: string }
export type Improvisacion = { root: number; esMenor: boolean; tonoNombre: string; escalas: Escala[] }

// Parsea el tono ("Sol", "La menor", "Lam", "Re#", "F#m", "Bb"…) → raíz + menor.
export function parseTono(tono: string): { root: number; esMenor: boolean } | null {
  const t = (tono || "").trim().toLowerCase()
  if (!t) return null
  const clave = CLAVES.find(k => t.startsWith(k))
  if (clave === undefined) return null
  const resto = t.slice(clave.length).trim()
  const esMenor = /^m(?!aj)/.test(resto) || /\bmenor\b|\bmin\b/.test(resto)
  return { root: IDX[clave], esMenor }
}

const notasDe = (raiz: number, intervalos: number[], americano: boolean) => {
  const arr = americano ? NOTAS_EN : NOTAS_ES
  return intervalos.map(i => arr[(raiz + i) % 12])
}

// Devuelve las escalas sugeridas para el tono (aplicando la transposición).
export function improvisar(tono: string, pasos = 0, americano = false): Improvisacion | null {
  const p = parseTono(tono)
  if (!p) return null
  const root = ((p.root + pasos) % 12 + 12) % 12
  const arr = americano ? NOTAS_EN : NOTAS_ES
  const tonoNombre = arr[root] + (p.esMenor ? " menor" : " mayor")

  const mk = (nombre: string, intervalos: number[], cuando: string, raiz = root): Escala => ({
    nombre, cuando, raiz,
    clases: intervalos.map(i => (raiz + i) % 12),
    notas: notasDe(raiz, intervalos, americano),
  })

  const escalas: Escala[] = p.esMenor
    ? [
        mk("Pentatónica menor", DEF.pentaMen, "La más usada — casi todo suena bien encima."),
        mk("Escala menor", DEF.menorNat, "Completa, para armar melodías."),
        mk("Blues", DEF.blues, "Agrega la “nota azul” para darle sabor."),
        mk("Relativa mayor", DEF.mayor, "Mismas notas, un color más brillante.", (root + 3) % 12),
      ]
    : [
        mk("Pentatónica mayor", DEF.pentaMay, "La más segura para empezar a improvisar."),
        mk("Escala mayor", DEF.mayor, "Completa, para armar melodías."),
        mk("Pentatónica menor relativa", DEF.pentaMen, "Sonido bluesy sobre el tono mayor.", (root + 9) % 12),
        mk("Blues", DEF.blues, "Con sabor, sobre la relativa menor.", (root + 9) % 12),
      ]

  return { root, esMenor: p.esMenor, tonoNombre, escalas }
}
