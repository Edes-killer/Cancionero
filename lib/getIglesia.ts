import { supabase } from "./supabase"

export const getIglesiaId = async () => {
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user

  if (!user) return null

  const { data, error } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id")
    .eq("user_id", user.id)
    .single()

  if (error || !data) return null

  return data.iglesia_id
}