import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://dkufqtrfvduonsubmwka.supabase.co"
const supabaseKey = "sb_publishable__mXNWhVZ9ZUWHjs1YWkpjw_CLMV2TLu"

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: "implicit",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})