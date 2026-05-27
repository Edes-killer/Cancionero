"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"

const LINKS = [
  { href: "/",            label: "Inicio",    icon: "⌂"  },
  { href: "/canciones",   label: "Canciones", icon: "🎵"  },
  { href: "/control",     label: "Control",   icon: "🎛️"  },
  { href: "/configuracion", label: "Config",  icon: "⚙️"  },
]

const RUTAS_SIN_NAVBAR = ["/proyectar", "/musicos"]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => { setMenuAbierto(false) }, [pathname])

  if (RUTAS_SIN_NAVBAR.includes(pathname)) return null

  const cerrarSesion = async () => {
    setCerrando(true)
    await supabase.auth.signOut()
    router.push("/login")
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <>
      <nav style={{
        background: "rgba(6,13,26,0.97)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        // ✅ Evita que la navbar se desborde en pantallas pequeñas
        overflow: "hidden"
      }}>
        <div style={{
          padding: "0 12px",
          display: "flex", alignItems: "center",
          height: 52, gap: 6,
          // ✅ Contenido no se desborda
          minWidth: 0, overflow: "hidden"
        }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
            }}>🎵</div>
            {!isMobile && (
              <span style={{ color: "white", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
                Cancionero
              </span>
            )}
          </Link>

          {/* Links desktop */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflow: "hidden" }}>
              {LINKS.map(({ href, label, icon }) => {
                const activo = isActive(href)
                return (
                  <Link key={href} href={href} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 8,
                    textDecoration: "none", fontSize: 13,
                    fontWeight: activo ? 700 : 500,
                    color: activo ? "white" : "rgba(255,255,255,0.5)",
                    background: activo ? "rgba(59,130,246,0.15)" : "transparent",
                    border: activo ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                    whiteSpace: "nowrap"
                  }}>
                    <span style={{ fontSize: 13 }}>{icon}</span>{label}
                  </Link>
                )
              })}
            </div>
          )}

          {isMobile && <div style={{ flex: 1 }} />}

          {/* Proyector siempre visible — compacto en móvil */}
          <Link href="/proyectar" target="_blank" style={{
            padding: isMobile ? "5px 8px" : "5px 10px",
            borderRadius: 7,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)",
            textDecoration: "none",
            fontSize: isMobile ? 10 : 11,
            fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0
          }}>
            {isMobile ? "🖥️" : "🖥️ Proyector"}
          </Link>

          {/* Cerrar sesión */}
          <button onClick={cerrarSesion} disabled={cerrando} style={{
            background: "rgba(239,68,68,0.12)",
            color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: isMobile ? "6px 8px" : "6px 12px",
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700, cursor: cerrando ? "not-allowed" : "pointer",
            opacity: cerrando ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0
          }}>
            {cerrando ? "..." : "Salir"}
          </button>

          {/* Hamburger mobile */}
          {isMobile && (
            <button onClick={() => setMenuAbierto(v => !v)} style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "5px 9px",
              color: "white", cursor: "pointer", fontSize: 15, flexShrink: 0
            }}>
              {menuAbierto ? "✕" : "☰"}
            </button>
          )}
        </div>

        {/* Menú mobile */}
        {isMobile && menuAbierto && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "8px 12px 12px",
            display: "flex", flexDirection: "column", gap: 4
          }}>
            {LINKS.map(({ href, label, icon }) => {
              const activo = isActive(href)
              return (
                <Link key={href} href={href} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", borderRadius: 10,
                  textDecoration: "none", fontSize: 15,
                  fontWeight: activo ? 700 : 500,
                  color: activo ? "white" : "rgba(255,255,255,0.6)",
                  background: activo ? "rgba(59,130,246,0.12)" : "transparent",
                  border: activo ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
                }}>
                  <span>{icon}</span>{label}
                </Link>
              )
            })}
            <Link href="/musicos" target="_blank" style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 10,
              textDecoration: "none", fontSize: 15,
              color: "rgba(255,255,255,0.4)", fontWeight: 500
            }}>
              <span>🎸</span> Músicos
            </Link>
          </div>
        )}
      </nav>

      {/* Breadcrumb mínimo */}
      {pathname !== "/" && (
        <div style={{
          background: "rgba(6,13,26,0.6)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          padding: "5px 14px", fontSize: 11,
          color: "rgba(255,255,255,0.3)",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>
          ⌂ {LINKS.find(l => l.href !== "/" && pathname.startsWith(l.href))?.label || pathname}
        </div>
      )}
    </>
  )
}
