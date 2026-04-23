"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Navbar() {
  const pathname = usePathname()

  if (pathname === "/proyectar" || pathname === "/musicos") {
  return null
}

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <nav
      style={{
        background: "#000",
        color: "white",
        padding: "8px 10px",
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexWrap: "wrap",
        fontSize: "14px",
        overflowX: "auto"
      }}
    >
      <Link href="/" style={linkStyle}>Inicio</Link>
      <Link href="/canciones" style={linkStyle}>Canciones</Link>
      <Link href="/control" style={linkStyle}>Control</Link>
      <Link href="/proyectar" style={linkStyle}>Proyectar</Link>
      <Link href="/musicos" style={linkStyle}>Músicos</Link>

      <button
        onClick={cerrarSesion}
        style={{
          marginLeft: "auto",
          background: "#dc2626",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "8px 10px",
          fontSize: "13px"
        }}
      >
        Cerrar sesión
      </button>
    </nav>
  )
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  whiteSpace: "nowrap"
}