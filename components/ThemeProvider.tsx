"use client"
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const saved = (localStorage.getItem("selah-theme") as Theme) || "dark"
    setTheme(saved)
    aplicarTema(saved)
  }, [])

  const aplicarTema = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t)
    // ✅ CSS filter para invertir toda la UI sin cambiar inline styles
    const main = document.getElementById("selah-main")
    if (main) {
      main.style.filter = t === "light" ? "invert(1) hue-rotate(180deg)" : ""
    }
    // Las imágenes se re-invierten para verse normales en modo claro
    const style = document.getElementById("selah-theme-style") || (() => {
      const s = document.createElement("style"); s.id = "selah-theme-style"; document.head.appendChild(s); return s
    })()
    style.textContent = t === "light"
      ? `[data-theme="light"] img, [data-theme="light"] video { filter: invert(1) hue-rotate(180deg); }`
      : ""
  }

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("selah-theme", next)
    aplicarTema(next)
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <div id="selah-main" style={{ minHeight: "100dvh" }}>
        {children}
      </div>
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)

export function ThemeToggle({ style = {} }: { style?: React.CSSProperties }) {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      style={{ padding: "5px 9px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 15, cursor: "pointer", ...style }}>
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  )
}
