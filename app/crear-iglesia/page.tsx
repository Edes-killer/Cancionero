"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function CrearIglesia() {
  const [nombre, setNombre] = useState("")
  const router = useRouter()

  const crear = async () => {
    if (!nombre.trim()) {
      alert("Escribe un nombre")
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user

    if (!user) {
      router.replace("/login")
      return
    }

    const { data: iglesia, error } = await supabase
      .from("iglesias")
      .insert({
        nombre,
      })
      .select()
      .single()

    if (error || !iglesia) {
      alert("Error al crear iglesia")
      return
    }

    await supabase.from("usuarios_iglesia").insert({
      user_id: user.id,
      iglesia_id: iglesia.id,
    })

    router.replace("/")
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Crear tu iglesia</h1>

      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la iglesia"
        style={{
          padding: 10,
          width: "100%",
          maxWidth: 400,
          marginTop: 20,
        }}
      />

      <button
        onClick={crear}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Crear
      </button>
    </div>
  )
}