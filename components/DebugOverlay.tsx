'use client'
import { useEffect, useState } from "react"
import { debugLeer, debugLimpiar } from "@/lib/debugTrail"

// 🔍 DIAGNÓSTICO TEMPORAL -- muestra el diario de eventos (lib/debugTrail) como
// texto fijo siempre visible en pantalla. Sobrevive a las recargas porque lee
// de localStorage. Pensado para diagnosticar el loop de recargas sin depender
// de la consola de Chrome ni del cable USB -- basta sacarle una foto.
// BORRAR antes de una versión real para usuarios.
export function DebugOverlay() {
  const [texto, setTexto] = useState("")
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const refrescar = () => setTexto(debugLeer())
    refrescar()
    const id = setInterval(refrescar, 300)
    return () => clearInterval(id)
  }, [])

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{ position: "fixed", bottom: 4, left: 4, zIndex: 2147483647,
          background: "#f00", color: "#fff", border: "none", borderRadius: 4,
          fontSize: 11, padding: "2px 6px" }}
      >log</button>
    )
  }

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 2147483647,
      maxHeight: "45vh", overflowY: "auto",
      background: "rgba(0,0,0,0.9)", color: "#7CFC00",
      fontFamily: "monospace", fontSize: 10, lineHeight: 1.35,
      padding: "6px 8px 8px", whiteSpace: "pre-wrap", wordBreak: "break-all",
      borderTop: "2px solid #7CFC00"
    }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <button onClick={() => { debugLimpiar(); setTexto("") }}
          style={{ background: "#333", color: "#fff", border: "1px solid #666", borderRadius: 3, fontSize: 10, padding: "2px 8px" }}>
          limpiar
        </button>
        <button onClick={() => setVisible(false)}
          style={{ background: "#333", color: "#fff", border: "1px solid #666", borderRadius: 3, fontSize: 10, padding: "2px 8px" }}>
          ocultar
        </button>
      </div>
      {texto || "(sin eventos todavía)"}
    </div>
  )
}
