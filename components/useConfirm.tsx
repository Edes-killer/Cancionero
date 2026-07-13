"use client"
import { useState, useCallback } from "react"

// Modal de confirmación reutilizable con estilo propio (reemplaza el
// window.confirm() nativo, que en Electron sale con el estilo feo del sistema).
//
// Uso:
//   const { confirmar, ConfirmUI } = useConfirm()
//   ...
//   if (!(await confirmar("¿Seguro?", { textoOk: "Eliminar", peligro: true }))) return
//   ...
//   return (<>{ConfirmUI}<div>...</div></>)

interface OpcionesConfirm { textoOk?: string; textoCancelar?: string; peligro?: boolean }

interface EstadoConfirm extends OpcionesConfirm {
  mensaje: string
  resolver: (ok: boolean) => void
}

export function useConfirm() {
  const [estado, setEstado] = useState<EstadoConfirm | null>(null)

  const confirmar = useCallback((mensaje: string, opciones: OpcionesConfirm = {}) => {
    return new Promise<boolean>(resolver => setEstado({ mensaje, resolver, ...opciones }))
  }, [])

  const cerrar = (ok: boolean) => {
    if (estado) estado.resolver(ok)
    setEstado(null)
  }

  const ConfirmUI = estado ? (
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
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, marginBottom: 20 }}>
          {estado.mensaje}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => cerrar(false)} style={{
            padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer"
          }}>{estado.textoCancelar || "Cancelar"}</button>
          <button onClick={() => cerrar(true)} style={{
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: estado.peligro ? "#dc2626" : "#2563eb",
            color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>{estado.textoOk || "Aceptar"}</button>
        </div>
      </div>
    </div>
  ) : null

  return { confirmar, ConfirmUI }
}
