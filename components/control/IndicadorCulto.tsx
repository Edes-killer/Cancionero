"use client"

import type { Cancion } from "@/lib/modelosCulto"

interface IndicadorCultoProps {
  isMobile: boolean
  tituloActual: string
  cancion?: Pick<Cancion, "numero" | "tono">
  mostrarCancion: boolean
  etiquetaParte: string
  parteEsCoro: boolean
  aprendiendo: boolean
  autoAvanceActivo: boolean
  tiemposAprendidos: number
  contadorAuto: number
  siguienteTitulo?: string
}

/** Resumen operativo de lo que está al aire y del siguiente ítem del culto. */
export default function IndicadorCulto({
  isMobile,
  tituloActual,
  cancion,
  mostrarCancion,
  etiquetaParte,
  parteEsCoro,
  aprendiendo,
  autoAvanceActivo,
  tiemposAprendidos,
  contadorAuto,
  siguienteTitulo,
}: IndicadorCultoProps) {
  return (
    <div style={{
      flexShrink: 0,
      background: "rgba(15,23,42,0.97)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: isMobile ? "6px 14px" : "8px 20px",
      fontSize: isMobile ? 12 : 13,
      fontWeight: 700,
      opacity: 0.85,
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      flexWrap: "wrap",
    }}>
      {mostrarCancion && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#93c5fd", fontWeight: 800 }}>
            🎵 {cancion?.numero ? `${cancion.numero}. ` : ""}{tituloActual}
          </span>
          {cancion?.tono && (
            <span style={{
              fontSize: isMobile ? 10 : 11,
              fontWeight: 700,
              padding: "1px 7px",
              borderRadius: 99,
              background: "rgba(255,255,255,0.07)",
              opacity: 0.8,
            }}>
              Tono: {cancion.tono}
            </span>
          )}
          <span style={{ opacity: 0.35 }}>·</span>
        </span>
      )}

      <span style={{ color: parteEsCoro ? "#fbbf24" : undefined, fontWeight: parteEsCoro ? 900 : undefined }}>
        {etiquetaParte}
      </span>

      {aprendiendo && !autoAvanceActivo && tiemposAprendidos === 0 && (
        <span style={{
          fontSize: 9,
          padding: "1px 5px",
          borderRadius: 4,
          background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.15)",
          color: "rgba(251,191,36,0.5)",
          fontWeight: 600,
        }}>⏱</span>
      )}

      {tiemposAprendidos > 0 && !autoAvanceActivo && (
        <span style={{
          fontSize: 9,
          padding: "1px 5px",
          borderRadius: 4,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.2)",
          color: "#4ade80",
          fontWeight: 600,
        }}>✓ {tiemposAprendidos}p</span>
      )}

      {autoAvanceActivo && (
        <span style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 5,
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#fca5a5",
          fontWeight: 700,
        }}>⏹ {contadorAuto}s</span>
      )}

      {siguienteTitulo && (
        <span title={`Siguiente elemento: ${siguienteTitulo}`} style={{
          marginLeft: isMobile ? 2 : 10,
          paddingLeft: isMobile ? 7 : 12,
          borderLeft: "1px solid rgba(255,255,255,.14)",
          color: "rgba(255,255,255,.52)",
          fontSize: isMobile ? 9.5 : 11,
          fontWeight: 700,
          maxWidth: isMobile ? 145 : 320,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          SIGUE · {siguienteTitulo}
        </span>
      )}
    </div>
  )
}
