"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function CallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const completarLogin = async () => {
      const hash = window.location.hash

      if (!hash.includes("access_token")) {
        router.replace("/login?error=no_token")
        return
      }

      const params = new URLSearchParams(hash.replace("#", ""))

      const access_token = params.get("access_token")
      const refresh_token = params.get("refresh_token")

      if (!access_token || !refresh_token) {
        router.replace("/login?error=no_session")
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (error) {
        console.error("Error setSession:", error)
        router.replace("/login?error=session")
        return
      }

      router.replace("/")
    }

    completarLogin()
  }, [router])

  return <p style={{ padding: 20 }}>Entrando...</p>
}