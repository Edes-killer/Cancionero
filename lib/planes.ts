// ── Planes y límites (modelo freemium) ───────────────────────────────────────
// El plan de cada iglesia vive en iglesias.plan ('gratis' | 'pro' | 'premium').
// Los límites del plan GRATIS son cupos livianos (para que la iglesia chica
// nunca los toque) que empujan a Pro/Premium cuando crece.
//
// Nota: los límites de nube del plan gratis son por CANTIDAD (1 video + 10
// imágenes) — un "probador" del servicio. Pro/Premium son ilimitados en
// cantidad; su tope real es el tamaño del bucket en Supabase (2 GB / 10 GB).

export type Plan = "gratis" | "pro" | "premium"

export interface LimitesPlan {
  canciones: number     // canciones propias de la iglesia (el himnario global NO cuenta)
  videosNube: number    // videos en la nube
  imagenesNube: number  // imágenes en la nube
  usuarios: number      // miembros de la iglesia
}

const INF = Number.POSITIVE_INFINITY

export const LIMITES_PLAN: Record<Plan, LimitesPlan> = {
  gratis:  { canciones: 200, videosNube: 1,   imagenesNube: 10,  usuarios: 15 },
  pro:     { canciones: INF, videosNube: INF, imagenesNube: INF, usuarios: INF },
  premium: { canciones: INF, videosNube: INF, imagenesNube: INF, usuarios: INF },
}

export function limitesDe(plan?: string | null): LimitesPlan {
  return LIMITES_PLAN[(plan as Plan)] ?? LIMITES_PLAN.gratis
}

export function nombrePlan(plan?: string | null): string {
  return ({ gratis: "Gratis", pro: "Pro", premium: "Premium" } as Record<string, string>)[plan || "gratis"] || "Gratis"
}

export function esIlimitado(n: number): boolean {
  return !Number.isFinite(n)
}
