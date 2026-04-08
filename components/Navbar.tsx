"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState("")

  const ocultar = pathname === "/login" || pathname === "/auth/callback"

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email || "")
    })
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (ocultar) return null

  return (
    <div
      style={{
        background: "#000",
        color: "white",
        padding: "10px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: 16 }}>
        <span style={{ cursor: "pointer" }} onClick={() => router.push("/")}>
          Inicio
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => router.push("/canciones")}>
          Canciones
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => router.push("/control")}>
          Control
        </span>
        <span style={{ cursor: "pointer" }} onClick={() => router.push("/musicos")}>
          Músicos
        </span>
      </div>

      <div>
        👤 {email}{" "}
        <button
          onClick={logout}
          style={{
            marginLeft: 12,
            background: "#dc2626",
            color: "white",
            border: "none",
            padding: "6px 10px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}