import { supabase } from "@/lib/supabase"

const KEY_IGLESIA_ACTIVA = "cancionero_iglesia_activa_id"

// ── Guardar iglesia activa en localStorage ────────────────────────────────────
export const setIglesiaActivaId = (iglesiaId: string) => {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY_IGLESIA_ACTIVA, iglesiaId)
}

// ── Limpiar iglesia activa (al cerrar sesión) ─────────────────────────────────
export const limpiarIglesiaActivaId = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY_IGLESIA_ACTIVA)
}

// ── Obtener iglesia_id del usuario autenticado ────────────────────────────────
//
//  Flujo:
//  1. Obtiene el user_id del usuario logueado
//  2. Busca todas las iglesias asociadas a ese usuario en usuarios_iglesia
//  3. Si hay una iglesia guardada en localStorage y el usuario tiene acceso → la usa
//  4. Si no → usa la primera iglesia asociada y la guarda en localStorage
//
export const getIglesiaId = async (): Promise<string | null> => {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    console.warn("⚠️ getIglesiaId: usuario no autenticado")
    return null
  }

  const userId = userData.user.id

  const { data, error } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: true })

  if (error) {
    console.error("❌ getIglesiaId: error consultando usuarios_iglesia:", error)
    return null
  }

  const relaciones = data || []

  if (relaciones.length === 0) {
    console.warn("⚠️ getIglesiaId: el usuario no tiene iglesias asociadas")
    return null
  }

  const idsPermitidos: string[] = relaciones
    .map((r: any) => r.iglesia_id)
    .filter(Boolean)

  // ¿Hay una iglesia guardada localmente que el usuario pueda usar?
  const guardada = typeof window !== "undefined"
    ? localStorage.getItem(KEY_IGLESIA_ACTIVA)
    : null

  if (guardada && idsPermitidos.includes(guardada)) {
    return guardada
  }

  // Usar la primera y guardarla
  const primera = idsPermitidos[0]
  if (primera && typeof window !== "undefined") {
    localStorage.setItem(KEY_IGLESIA_ACTIVA, primera)
  }

  return primera ?? null
}

// ── Cambiar iglesia activa (útil si el usuario pertenece a más de una) ────────
export const cambiarIglesiaActiva = async (iglesiaId: string): Promise<boolean> => {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return false

  const { data } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id")
    .eq("user_id", userData.user.id)
    .eq("iglesia_id", iglesiaId)
    .single()

  if (!data) {
    console.warn("⚠️ cambiarIglesiaActiva: el usuario no tiene acceso a esa iglesia")
    return false
  }

  setIglesiaActivaId(iglesiaId)
  return true
}
