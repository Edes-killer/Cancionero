"use client"
import { useState, useCallback, useRef, useEffect } from "react"

// Modal de entrada de texto reutilizable (reemplaza el window.prompt() nativo,
// que en Electron NO existe: devuelve null y ni siquiera muestra el diálogo,
// por lo que cualquier acción que dependa de prompt() fallaba en silencio).
//
// Uso:
//   const { pedirTexto, PromptUI } = usePrompt()
//   ...
//   const nombre = await pedirTexto("Nombre del culto", { valorInicial: nombreCulto, textoOk: "Guardar" })
//   if (!nombre) return
//   ...
//   return (<>{PromptUI}<div>...</div></>)

interface OpcionesPrompt {
  valorInicial?: string
  placeholder?: string
  textoOk?: string
  textoCancelar?: string
}

interface EstadoPrompt extends OpcionesPrompt {
  mensaje: string
  resolver: (valor: string | null) => void
}

export function usePrompt() {
  const [estado, setEstado] = useState<EstadoPrompt | null>(null)
  const [valor, setValor] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const pedirTexto = useCallback((mensaje: string, opciones: OpcionesPrompt = {}) => {
    setValor(opciones.valorInicial || "")
    return new Promise<string | null>(resolver => setEstado({ mensaje, resolver, ...opciones }))
  }, [])

  useEffect(() => {
    if (estado) {
      // Enfocar y seleccionar el texto al abrir
      const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
      return () => clearTimeout(t)
    }
  }, [estado])

  const cerrar = (aceptar: boolean) => {
    if (estado) estado.resolver(aceptar ? valor : null)
    setEstado(null)
  }

  const PromptUI = estado ? (
    <div onClick={() => cerrar(false)} style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#111b2e", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, padding: 24, maxWidth: 420, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)", color: "white"
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, marginBottom: 16 }}>
          {estado.mensaje}
        </div>
        <input
          ref={inputRef}
          value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); cerrar(true) }
            if (e.key === "Escape") { e.preventDefault(); cerrar(false) }
          }}
          placeholder={estado.placeholder || ""}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)", background: "#0a1525",
            color: "white", fontSize: 16, outline: "none", boxSizing: "border-box",
            marginBottom: 18
          }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => cerrar(false)} style={{
            padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer"
          }}>{estado.textoCancelar || "Cancelar"}</button>
          <button onClick={() => cerrar(true)} style={{
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: "#2563eb", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>{estado.textoOk || "Aceptar"}</button>
        </div>
      </div>
    </div>
  ) : null

  return { pedirTexto, PromptUI }
}
