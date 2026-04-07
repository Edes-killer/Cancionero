import { supabase } from "./supabase"

export const getUser = async () => {
  const { data } = await supabase.auth.getUser()
  return data.user
}