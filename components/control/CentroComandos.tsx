"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type CancionComando = { id: string; titulo: string; tono?: string; numero?: number }
type ItemComando = { titulo?: string; tipo?: string }

interface Props {
  abierto: boolean
  canciones: CancionComando[]
  lista: ItemComando[]
  favoritos: string[]
  recientes: string[]
  onCerrar: () => void
  onProyectar: (id: string) => void
  onAgregar: (cancion: CancionComando) => void
  onProyectarLista: (indice: number) => void
  onFavorito: (id: string) => void
  onAccion: (accion: "espera" | "negro" | "mensaje" | "revision") => void
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

export default function CentroComandos({ abierto, canciones, lista, favoritos, recientes, onCerrar, onProyectar, onAgregar, onProyectarLista, onFavorito, onAccion }: Props) {
  const [q, setQ] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierto) return
    setQ("")
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [abierto])

  const resultados = useMemo(() => {
    const nq = normalizar(q.trim())
    const base = nq
      ? canciones.filter(c => normalizar(`${c.numero || ""} ${c.titulo} ${c.tono || ""}`).includes(nq))
      : [...canciones].sort((a, b) => {
          const fa = favoritos.includes(a.id) ? 1 : 0, fb = favoritos.includes(b.id) ? 1 : 0
          if (fa !== fb) return fb - fa
          const ra = recientes.indexOf(a.id), rb = recientes.indexOf(b.id)
          return (ra < 0 ? 9999 : ra) - (rb < 0 ? 9999 : rb)
        })
    return base.slice(0, 12)
  }, [q, canciones, favoritos, recientes])

  if (!abierto) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Buscador universal" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }} style={{
      position:"fixed", inset:0, zIndex:3000, background:"rgba(2,6,23,.78)", backdropFilter:"blur(7px)",
      display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"min(11vh,90px) 12px 24px"
    }}>
      <div style={{ width:"min(720px,100%)", maxHeight:"78vh", overflow:"hidden", borderRadius:18, background:"#0f1a2d", border:"1px solid rgba(148,163,184,.24)", boxShadow:"0 30px 90px rgba(0,0,0,.65)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:14, borderBottom:"1px solid rgba(255,255,255,.08)" }}>
          <span style={{ fontSize:20 }}>⌕</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Escape") onCerrar(); if (e.key === "Enter" && resultados[0]) { onProyectar(resultados[0].id); onCerrar() } }} placeholder="Busca una canción, número o tono…" style={{ flex:1, minWidth:0, border:0, outline:0, background:"transparent", color:"white", fontSize:17, fontWeight:650 }} />
          <kbd style={{ padding:"4px 7px", borderRadius:6, background:"rgba(255,255,255,.07)", color:"#94a3b8", fontSize:11 }}>ESC</kbd>
        </div>

        {!q && <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:7, padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
          {([
            ["⏳", "Espera", "espera"], ["⚫", "Apagar", "negro"], ["💬", "Mensaje", "mensaje"], ["✓", "Revisar", "revision"]
          ] as const).map(([ico, label, accion]) => <button key={accion} onClick={() => { onAccion(accion); onCerrar() }} style={{ padding:"10px 6px", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>{ico}</span><span style={{ fontSize:11 }}>{label}</span></button>)}
        </div>}

        <div style={{ overflowY:"auto", maxHeight:"55vh", padding:10 }}>
          {q && lista.map((it, i) => ({...it, i})).filter(it => normalizar(it.titulo || "").includes(normalizar(q))).slice(0,4).map(it => (
            <button key={`lista-${it.i}`} onClick={() => { onProyectarLista(it.i); onCerrar() }} style={{ width:"100%", display:"flex", gap:10, alignItems:"center", textAlign:"left", padding:"10px 12px", marginBottom:5, borderRadius:10, border:"1px solid rgba(34,197,94,.2)", background:"rgba(34,197,94,.07)", color:"white", cursor:"pointer" }}><span>📋</span><span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.titulo || "Elemento del culto"}</span><small style={{ color:"#86efac" }}>En la lista · Proyectar</small></button>
          ))}
          <div style={{ padding:"5px 8px", color:"#64748b", fontSize:10, fontWeight:900, letterSpacing:1 }}>{q ? "CANCIONES" : "FAVORITAS Y RECIENTES"}</div>
          {resultados.map(c => {
            const fav = favoritos.includes(c.id), reciente = recientes.includes(c.id)
            return <div key={c.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 8px", borderRadius:11, background:"rgba(255,255,255,.025)", marginBottom:4 }}>
              <button onClick={() => onFavorito(c.id)} aria-label={fav ? "Quitar de favoritos" : "Agregar a favoritos"} title={fav ? "Quitar de favoritos" : "Guardar como favorita"} style={{ width:32, height:32, border:0, background:"transparent", color:fav ? "#fbbf24" : "#64748b", fontSize:18, cursor:"pointer" }}>{fav ? "★" : "☆"}</button>
              <button onClick={() => { onProyectar(c.id); onCerrar() }} style={{ flex:1, minWidth:0, border:0, background:"transparent", color:"white", textAlign:"left", cursor:"pointer" }}>
                <span style={{ fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{c.numero ? `${c.numero}. ` : ""}{c.titulo}</span>
                <small style={{ color:"#94a3b8" }}>{c.tono ? `Tono ${c.tono}` : "Sin tono"}{reciente ? " · Usada recientemente" : ""}</small>
              </button>
              <button onClick={() => onAgregar(c)} title="Agregar al final de la lista del culto" style={{ padding:"7px 10px", borderRadius:8, border:"1px solid rgba(96,165,250,.25)", background:"rgba(37,99,235,.12)", color:"#bfdbfe", cursor:"pointer", fontWeight:750 }}>+ Lista</button>
              <button onClick={() => { onProyectar(c.id); onCerrar() }} title="Proyectar ahora" style={{ width:38, height:36, borderRadius:9, border:0, background:"#2563eb", color:"white", cursor:"pointer" }}>▶</button>
            </div>
          })}
          {!resultados.length && <div style={{ padding:28, textAlign:"center", color:"#94a3b8" }}>No encontré canciones con “{q}”.</div>}
        </div>
        <div style={{ display:"flex", gap:12, padding:"9px 14px", borderTop:"1px solid rgba(255,255,255,.07)", color:"#64748b", fontSize:10 }}><span>↵ proyectar primera</span><span>★ favorita</span><span>+ Lista prepara sin proyectar</span></div>
      </div>
    </div>
  )
}
