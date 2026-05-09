import { supabase } from "@/lib/supabase"

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
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Error obteniendo iglesia:", error)
    return null
  }

  return data?.iglesia_id || null
}