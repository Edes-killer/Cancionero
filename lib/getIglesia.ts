import { supabase } from "@/lib/supabase"

const KEY_IGLESIA_ACTIVA = "cancionero_iglesia_activa_id"

export const setIglesiaActivaId = (iglesiaId: string) => {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY_IGLESIA_ACTIVA, iglesiaId)
}

export const limpiarIglesiaActivaId = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY_IGLESIA_ACTIVA)
}

export const getIglesiaId = async () => {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) {
    console.error("Error obteniendo usuario:", userError)
    return null
  }

  const userId = userData.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: true })

  if (error) {
    console.error("Error obteniendo iglesia:", error)
    return null
  }

  const relaciones = data || []
  if (relaciones.length === 0) return null

  const idsPermitidos = relaciones
    .map((r: any) => r.iglesia_id)
    .filter(Boolean)

  const guardada =
    typeof window !== "undefined"
      ? localStorage.getItem(KEY_IGLESIA_ACTIVA)
      : null

  if (guardada && idsPermitidos.includes(guardada)) {
    return guardada
  }

  const primera = idsPermitidos[0] || null

  if (primera && typeof window !== "undefined") {
    localStorage.setItem(KEY_IGLESIA_ACTIVA, primera)
  }

  return primera
}