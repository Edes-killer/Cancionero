"use client"
import { createContext, useContext, useEffect, useSyncExternalStore } from "react"

type Theme = "dark" | "light"
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} })
const EVENTO_TEMA = "selah-theme-change"

function temaGuardado(): Theme {
  return localStorage.getItem("selah-theme") === "light" ? "light" : "dark"
}

function suscribirTema(notificar: () => void) {
  window.addEventListener(EVENTO_TEMA, notificar)
  window.addEventListener("storage", notificar)
  return () => {
    window.removeEventListener(EVENTO_TEMA, notificar)
    window.removeEventListener("storage", notificar)
  }
}

function aplicarTema(t: Theme) {
  document.documentElement.setAttribute("data-theme", t)
  const main = document.getElementById("selah-main")
  if (main) main.style.filter = t === "light" ? "invert(1) hue-rotate(180deg)" : ""

  const existente = document.getElementById("selah-theme-style")
  const style = existente || (() => {
    const nuevo = document.createElement("style")
    nuevo.id = "selah-theme-style"
    document.head.appendChild(nuevo)
    return nuevo
  })()
  style.textContent = t === "light"
    ? `[data-theme="light"] img, [data-theme="light"] video { filter: invert(1) hue-rotate(180deg); }`
    : ""
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(suscribirTema, temaGuardado, () => "dark")

  useEffect(() => {
    aplicarTema(theme)
  }, [theme])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    localStorage.setItem("selah-theme", next)
    aplicarTema(next)
    window.dispatchEvent(new Event(EVENTO_TEMA))
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
