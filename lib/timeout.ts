// lib/timeout.ts
// ✅ Envuelve cualquier promesa (típicamente una llamada a Supabase) con un
// límite de tiempo -- sin esto, una consulta colgada en red mala (datos
// móviles) deja pantallas enteras trabadas en "Cargando..." para siempre,
// sin ningún error visible. Mejor seguir adelante (con datos vacíos/en
// caché) que trabar a alguien por un error de red transitorio.
export const conTimeout = <T,>(promesa: Promise<T>, ms: number): Promise<T | "timeout"> =>
  Promise.race([promesa, new Promise<"timeout">(resolve => setTimeout(() => resolve("timeout"), ms))])
