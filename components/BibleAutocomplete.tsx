"use client"
import { useMemo, useRef, useState, useEffect } from "react"

const LIBROS = [
  "Génesis","Éxodo","Levítico","Números","Deuteronomio","Josué","Jueces","Rut",
  "1 Samuel","2 Samuel","1 Reyes","2 Reyes","1 Crónicas","2 Crónicas",
  "Esdras","Nehemías","Ester","Job","Salmos","Proverbios","Eclesiastés","Cantares",
  "Isaías","Jeremías","Lamentaciones","Ezequiel","Daniel",
  "Oseas","Joel","Amós","Abdías","Jonás","Miqueas","Nahum",
  "Habacuc","Sofonías","Hageo","Zacarías","Malaquías",
  "Mateo","Marcos","Lucas","Juan","Hechos","Romanos",
  "1 Corintios","2 Corintios","Gálatas","Efesios","Filipenses","Colosenses",
  "1 Tesalonicenses","2 Tesalonicenses","1 Timoteo","2 Timoteo",
  "Tito","Filemón","Hebreos","Santiago",
  "1 Pedro","2 Pedro","1 Juan","2 Juan","3 Juan","Judas","Apocalipsis"
]

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

// Extrae la parte del libro (texto antes de números de capítulo/versículo)
// Ej: "Juan 3:16" → { libro: "Juan ", resto: "3:16" }
// Ej: "1 ju"      → { libro: "1 ju", resto: "" }
const parsearInput = (val: string) => {
  // Detectar número de libro al inicio: "1 ", "2 ", "3 "
  const conNumero = val.match(/^(\d\s+)(.*?)(\s+\d.*)$/)
  if (conNumero) {
    return { libro: conNumero[1] + conNumero[2], resto: conNumero[3] }
  }
  // Sin número de libro
  const sinNumero = val.match(/^([^\d]*?)(\s+\d.*)?$/)
  if (sinNumero) {
    return { libro: sinNumero[1], resto: sinNumero[2] || "" }
  }
  return { libro: val, resto: "" }
}

const buscarSugerencia = (input: string): string | null => {
  if (!input.trim()) return null
  const { libro, resto } = parsearInput(input)
  if (resto) return null  // ya tiene capítulo/versículo → no completar
  const libroNorm = norm(libro.trim())
  if (!libroNorm) return null
  const match = LIBROS.find(l => norm(l).startsWith(libroNorm))
  if (!match) return null
  if (norm(match) === libroNorm) return null  // coincide exacto
  return match
}

interface Props {
  value: string
  onChange: (val: string) => void
  onSubmit?: () => void
  placeholder?: string
  style?: React.CSSProperties
  inputStyle?: React.CSSProperties
  autoFocus?: boolean
}

export default function BibleAutocomplete({
  value, onChange, onSubmit, placeholder, style, inputStyle, autoFocus
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const sugerencia = useMemo(() => buscarSugerencia(value), [value])

  // Sufijo ghost: lo que falta escribir del libro
  const ghostSuffix = sugerencia
    ? sugerencia.slice(norm(value.trim()).length) + " "
    : ""

  const aceptarSugerencia = () => {
    if (sugerencia) onChange(sugerencia + " ")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (sugerencia && (e.key === "Tab" || e.key === "ArrowRight")) {
      e.preventDefault()
      aceptarSugerencia()
      return
    }
    if (e.key === "Enter") {
      onSubmit?.()
    }
  }

  const base: React.CSSProperties = {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 15,
    padding: "11px 14px",
    letterSpacing: "normal",
    lineHeight: 1.5,
  }

  return (
    <div style={{ position: "relative", ...style }}>
      {/* ── Ghost text layer ── */}
      <div aria-hidden style={{
        ...base,
        position: "absolute", inset: 0,
        pointerEvents: "none", userSelect: "none",
        overflow: "hidden", whiteSpace: "nowrap",
        display: "flex", alignItems: "center",
        borderRadius: 10, border: "1px solid transparent",
      }}>
        {/* parte ya escrita → transparente (ocultada por el input real) */}
        <span style={{ color: "transparent", whiteSpace: "pre" }}>{value}</span>
        {/* sugerencia → gris */}
        <span style={{ color: "rgba(255,255,255,0.30)", whiteSpace: "pre" }}>{ghostSuffix}</span>
      </div>

      {/* ── Input real (encima) ── */}
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          ...base,
          position: "relative", zIndex: 1,
          width: "100%", boxSizing: "border-box",
          background: "transparent",
          outline: "none",
          color: "white",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          ...inputStyle,
        }}
      />

      {/* ── Chip de sugerencia (móvil: Tab no existe) ── */}
      {sugerencia && (
        <button
          onMouseDown={e => { e.preventDefault(); aceptarSugerencia() }}
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            padding: "3px 10px", borderRadius: 6, border: "none",
            background: "rgba(59,130,246,0.15)", color: "#93c5fd",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            zIndex: 2,
          }}
          title="Aceptar sugerencia (Tab o →)"
        >
          {sugerencia} ↵
        </button>
      )}
    </div>
  )
}
