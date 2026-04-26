"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"

export default function Navbar() {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

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
        padding: isMobile ? "8px 10px" : "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px"
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: isMobile ? "10px" : "16px",
          alignItems: "center"
        }}
      >
        <Link href="/" style={linkStyle}>Inicio</Link>
        <Link href="/canciones" style={linkStyle}>Canciones</Link>
        <Link href="/control" style={linkStyle}>Control</Link>
      </div>

      <button
        onClick={cerrarSesion}
        style={{
          background: "#dc2626",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: isMobile ? "6px 10px" : "7px 11px",
          fontSize: isMobile ? "12px" : "13px",
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0
        }}
      >
        Salir
      </button>
    </nav>
  )
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  whiteSpace: "nowrap"
}