"use client"

import { useState } from "react"
import { supabase } from "../../lib/supabase"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const register = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
      return
    }

    alert("Cuenta creada 🔥")
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Registro</h1>

      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <button onClick={register}>Crear cuenta</button>
    </div>
  )
}