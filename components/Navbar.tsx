"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"

const LINKS = [
  { href: "/",              label: "Inicio",    icon: "⌂"  },
  { href: "/canciones",     label: "Canciones", icon: "🎵"  },
  { href: "/control",       label: "Control",   icon: "🎛️"  },
  { href: "/configuracion", label: "Config",    icon: "⚙️"  },
]

const RUTAS_SIN_NAVBAR = ["/proyectar", "/musicos", "/login", "/register"]

// ── Logo Selah Live ──────────────────────────────────────────────────────────
const SelahLogo = ({ size = 30 }: { size?: number }) => (
  <div style={{
    width: size, height: size,
    borderRadius: size * 0.27,
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: size * 0.13, position: "relative", flexShrink: 0
  }}>
    <div style={{ width: size * 0.16, height: size * 0.48, borderRadius: size * 0.08, background: "white" }} />
    <div style={{ width: size * 0.16, height: size * 0.48, borderRadius: size * 0.08, background: "white" }} />
    <div style={{
      position: "absolute", top: size * 0.1, right: size * 0.1,
      width: size * 0.26, height: size * 0.26,
      borderRadius: "50%", background: "#22c55e",
      border: `${size * 0.07}px solid white`
    }} />
  </div>
)

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

  if (RUTAS_SIN_NAVBAR.some(r => pathname.startsWith(r))) return null

  const cerrarSesion = async () => {
    setCerrando(true)
    await supabase.auth.signOut()
    router.push("/login")
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor

  return (
    <>
      <nav style={{
        background: "rgba(6,13,26,0.97)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: "hidden"
      }}>
        <div style={{
          padding: "0 12px",
          display: "flex", alignItems: "center",
          height: 52, gap: 6,
          minWidth: 0, overflow: "hidden"
        }}>

          {/* ── Logo Selah Live ── */}
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <SelahLogo size={30} />
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
                <span style={{ color: "white", fontWeight: 900, fontSize: 13, letterSpacing: "-0.02em" }}>
                  Selah <span style={{ color: "#3b82f6", fontWeight: 300, letterSpacing: "0.05em" }}>LIVE</span>
                </span>
              </div>
            )}
          </Link>

          {/* ── Links desktop ── */}
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
              {/* Músicos — visible en desktop también */}
              <button onClick={() => isCapacitor ? router.push("/musicos") : window.open(`${window.location.origin}/musicos`, "_blank", "noopener")} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                color: "rgba(255,255,255,0.5)",
                background: "transparent", border: "1px solid transparent",
                whiteSpace: "nowrap", cursor: "pointer"
              }}>
                <span style={{ fontSize: 13 }}>🎸</span>Músicos
              </button>
            </div>
          )}

          {isMobile && <div style={{ flex: 1 }} />}

          {/* ── Músicos (mobile) / Proyector (desktop) ── */}
          {isMobile ? (
            <button onClick={() => isCapacitor ? router.push("/musicos") : window.open(`${window.location.origin}/musicos`, "_blank", "noopener")} style={{
              padding: "5px 8px", borderRadius: 7,
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.2)",
              color: "#fbbf24",
              fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
              cursor: "pointer"
            }}>🎸</button>
          ) : (
            <button data-tour="btn-proyectar-nav" onClick={() => window.open(`${window.location.origin}/proyectar`, "_blank", "noopener")} style={{
              padding: "5px 10px", borderRadius: 7,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
              cursor: "pointer"
            }}>🖥️ Proyector</button>
          )}

          {/* ── Cerrar sesión ── */}
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

          {/* ── Hamburger mobile ── */}
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

        {/* ── Menú mobile ── */}
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
            <button onClick={() => isCapacitor ? router.push("/musicos") : window.open(`${window.location.origin}/musicos`, "_blank", "noopener")} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 10,
              fontSize: 15, color: "rgba(255,255,255,0.4)", fontWeight: 500,
              background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left"
            }}>
              <span>🎸</span> Músicos
            </button>
          </div>
        )}
      </nav>

      {/* ── Breadcrumb ── */}
      {pathname !== "/" && !pathname.startsWith("/control") && (
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
