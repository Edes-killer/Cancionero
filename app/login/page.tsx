"use client"

import { useState } from "react"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [enviado, setEnviado] = useState(false)

const APP_URL = "http://192.168.20.200:3000"

const getRedirectUrl = () => {
  return `${APP_URL}/auth/callback`
}


const loginGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getRedirectUrl(),
    },
  })

  if (error) {
    alert(error.message)
  }
}
const login = async () => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getRedirectUrl(),
    },
  })

  if (error) {
    alert("Error: " + error.message)
    return
  }

  setEnviado(true)
}
  return (
  <div
    style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#111",
      color: "white"
    }}
  >
    <div style={{ width: 320 }}>
      <h2>Iniciar sesión</h2>

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Al continuar, aceptas nuestras condiciones.
      </p>

      {/* 🔵 GOOGLE */}
      <button
        onClick={loginGoogle}
        style={{
          width: "100%",
          padding: 10,
          marginTop: 10,
          background: "#fff",
          color: "#000",
          borderRadius: 5,
          border: "none"
        }}
      >
        Continuar con Google
      </button>

      {/* DIVISOR */}
      <div style={{ textAlign: "center", margin: "15px 0" }}>O</div>

      {/* ✉️ EMAIL */}
      <input
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
          background: "#222",
          color: "white",
          border: "none"
        }}
      />

      <button
        onClick={login}
        style={{
          width: "100%",
          padding: 10,
          background: "#16a34a",
          border: "none",
          color: "white"
        }}
      >
        Enviar link por correo
      </button>
    </div>
  </div>
)
}