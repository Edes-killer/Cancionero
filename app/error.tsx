"use client"

import { useEffect } from "react"

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Error atrapado por el error boundary:", error)
  }, [error])

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#060d1a",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 24,
      boxSizing: "border-box"
    }}>
      <div style={{
        background: "rgba(17,27,46,0.96)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 22,
        padding: "36px 32px",
        textAlign: "center",
        maxWidth: 380,
        width: "100%"
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
          Algo falló al cargar esta pantalla
        </div>
        <div style={{ fontSize: 14, opacity: 0.6, lineHeight: 1.6, marginBottom: 24 }}>
          No se pudo mostrar el contenido correctamente. Podés intentar de nuevo sin salir de la app.
        </div>
        <button
          onClick={reset}
          style={{
            padding: "12px 24px",
            background: "linear-gradient(135deg, #2563eb, #6366f1)",
            color: "white", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: "pointer"
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
