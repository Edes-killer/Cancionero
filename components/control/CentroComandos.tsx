"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type CancionComando = { id: string; titulo: string; tono?: string; numero?: number }
type ItemComando = { titulo?: string; tipo?: string }
type RecursoComando = { url: string; nombre: string; local: boolean; carpeta: string; video: boolean }
type CultoComando = { id: string; nombre?: string; fecha?: string }

interface Props {
  abierto: boolean
  canciones: CancionComando[]
  lista: ItemComando[]
  favoritos: string[]
  recientes: string[]
  recursos: RecursoComando[]
  cultos: CultoComando[]
  cultoActivoId: string | null
  onCerrar: () => void
  onProyectar: (id: string) => void
  onAgregar: (cancion: CancionComando) => void
  onProyectarLista: (indice: number) => void
  onFavorito: (id: string) => void
  onRecurso: (recurso: RecursoComando, agregar: boolean) => void
  onAbrirCulto: (id: string) => Promise<boolean>
  tieneLogo: boolean
  onMensaje: (texto: string, agregar: boolean) => void
  onBiblia: (referencia: string, agregar: boolean) => void
  onAccion: (accion: "espera" | "negro" | "revision" | "guardar") => void
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

export default function CentroComandos({ abierto, canciones, lista, favoritos, recientes, recursos, cultos, cultoActivoId, tieneLogo, onCerrar, onProyectar, onAgregar, onProyectarLista, onFavorito, onRecurso, onAbrirCulto, onMensaje, onBiblia, onAccion }: Props) {
  const [q, setQ] = useState("")
  const [vista, setVista] = useState<"sugeridas" | "favoritas" | "recientes">("sugeridas")
  const [mensajeAbierto, setMensajeAbierto] = useState(false)
  const [textoMensaje, setTextoMensaje] = useState("")
  const [bibliaAbierta, setBibliaAbierta] = useState(false)
  const [referenciaBiblia, setReferenciaBiblia] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierto) return
    setQ("")
    setVista("sugeridas")
    setMensajeAbierto(false)
    setBibliaAbierta(false)
    requestAnimationFrame(() => inputRef.current?.focus())
    const cerrarConEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar() }
    document.addEventListener("keydown", cerrarConEscape)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", cerrarConEscape)
      document.body.style.overflow = overflowAnterior
    }
  }, [abierto])

  const resultados = useMemo(() => {
    const nq = normalizar(q.trim())
    const base = nq
      ? canciones.filter(c => normalizar(`${c.numero || ""} ${c.titulo} ${c.tono || ""}`).includes(nq))
      : canciones.filter(c => vista === "favoritas" ? favoritos.includes(c.id) : vista === "recientes" ? recientes.includes(c.id) : true).sort((a, b) => {
          const fa = favoritos.includes(a.id) ? 1 : 0, fb = favoritos.includes(b.id) ? 1 : 0
          if (fa !== fb) return fb - fa
          const ra = recientes.indexOf(a.id), rb = recientes.indexOf(b.id)
          return (ra < 0 ? 9999 : ra) - (rb < 0 ? 9999 : rb)
        })
    return base.slice(0, 12)
  }, [q, canciones, favoritos, recientes, vista])
  const recursosEncontrados = useMemo(() => {
    const nq = normalizar(q.trim())
    if (!nq) return []
    return recursos.filter(r => normalizar(`${r.nombre} ${r.carpeta || ""} ${r.video ? "video" : "imagen"}`).includes(nq)).slice(0, 6)
  }, [q, recursos])
  const cultosEncontrados = useMemo(() => {
    const nq = normalizar(q.trim())
    if (!nq) return []
    return cultos.filter(c => normalizar(c.nombre || "Sin nombre").includes(nq)).slice(0, 5)
  }, [q, cultos])

  if (!abierto) return null
  return (
    <div className="selah-centro-fondo" role="dialog" aria-modal="true" aria-label="Buscador universal" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }} style={{
      position:"fixed", inset:0, zIndex:3000, background:"rgba(2,6,23,.78)", backdropFilter:"blur(7px)",
      display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"min(11vh,90px) 12px 24px"
    }}>
      <style>{`
        .selah-centro-acciones{display:grid;grid-template-columns:repeat(6,minmax(0,1fr))}
        .selah-centro-fila{display:flex}
        .selah-centro-pie{display:flex}
        @media(max-width:600px){
          .selah-centro-fondo{padding:12px!important;align-items:center!important}
          .selah-centro-panel{max-height:92dvh!important;border-radius:15px!important}
          .selah-centro-acciones{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .selah-centro-fila{flex-wrap:wrap!important}
          .selah-centro-fila .selah-comando-titulo{flex-basis:calc(100% - 48px)!important}
          .selah-centro-pie{display:none!important}
        }
      `}</style>
      <div className="selah-centro-panel" style={{ width:"min(720px,100%)", maxHeight:"78vh", overflow:"hidden", borderRadius:18, background:"#0f1a2d", border:"1px solid rgba(148,163,184,.24)", boxShadow:"0 30px 90px rgba(0,0,0,.65)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:14, borderBottom:"1px solid rgba(255,255,255,.08)" }}>
          <span style={{ fontSize:20 }}>⌕</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Escape") onCerrar(); if (e.key === "Enter" && resultados[0]) { onProyectar(resultados[0].id); onCerrar() } }} placeholder="Busca una canción, número o tono…" style={{ flex:1, minWidth:0, border:0, outline:0, background:"transparent", color:"white", fontSize:17, fontWeight:650 }} />
          <kbd style={{ padding:"4px 7px", borderRadius:6, background:"rgba(255,255,255,.07)", color:"#94a3b8", fontSize:11 }}>ESC</kbd>
        </div>

        {!q && <div className="selah-centro-acciones" style={{ gap:7, padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
          <button onClick={() => { onAccion("espera"); onCerrar() }} style={{ padding:"10px 6px", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>⏳</span><span style={{ fontSize:11 }}>{tieneLogo ? "Espera con logo" : "Espera"}</span></button>
          <button onClick={() => { onAccion("negro"); onCerrar() }} style={{ padding:"10px 6px", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>⚫</span><span style={{ fontSize:11 }}>Apagar</span></button>
          <button onClick={() => { setMensajeAbierto(v => !v); setBibliaAbierta(false) }} style={{ padding:"10px 6px", borderRadius:10, border:`1px solid ${mensajeAbierto ? "rgba(96,165,250,.45)" : "rgba(255,255,255,.08)"}`, background:mensajeAbierto ? "rgba(37,99,235,.15)" : "rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>💬</span><span style={{ fontSize:11 }}>Mensaje</span></button>
          <button onClick={() => { setBibliaAbierta(v => !v); setMensajeAbierto(false) }} style={{ padding:"10px 6px", borderRadius:10, border:`1px solid ${bibliaAbierta ? "rgba(96,165,250,.45)" : "rgba(255,255,255,.08)"}`, background:bibliaAbierta ? "rgba(37,99,235,.15)" : "rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>📖</span><span style={{ fontSize:11 }}>Palabra</span></button>
          <button onClick={() => { onAccion("revision"); onCerrar() }} style={{ padding:"10px 6px", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>✓</span><span style={{ fontSize:11 }}>Revisar</span></button>
          <button onClick={() => { onAccion("guardar"); onCerrar() }} style={{ padding:"10px 6px", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.045)", color:"white", cursor:"pointer", fontWeight:750 }}><span style={{ display:"block", fontSize:17 }}>💾</span><span style={{ fontSize:11 }}>Guardar</span></button>
        </div>}

        {!q && mensajeAbierto && <div style={{ padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,.07)", background:"rgba(37,99,235,.06)" }}>
          <textarea autoFocus value={textoMensaje} onChange={e => setTextoMensaje(e.target.value)} placeholder="Escribe el mensaje que verá la iglesia…" rows={2} style={{ width:"100%", resize:"vertical", boxSizing:"border-box", borderRadius:10, border:"1px solid rgba(148,163,184,.25)", background:"#091426", color:"white", padding:"10px 11px", outline:"none", fontFamily:"inherit", fontSize:14 }} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:7, marginTop:8 }}>
            <button disabled={!textoMensaje.trim()} onClick={() => { onMensaje(textoMensaje.trim(), true); onCerrar() }} style={{ padding:"8px 11px", borderRadius:8, border:"1px solid rgba(96,165,250,.3)", background:"rgba(37,99,235,.1)", color:"#bfdbfe", fontWeight:800, cursor:textoMensaje.trim() ? "pointer" : "not-allowed", opacity:textoMensaje.trim() ? 1 : .4 }}>+ Lista</button>
            <button disabled={!textoMensaje.trim()} onClick={() => { onMensaje(textoMensaje.trim(), false); onCerrar() }} style={{ padding:"8px 13px", borderRadius:8, border:0, background:"#2563eb", color:"white", fontWeight:850, cursor:textoMensaje.trim() ? "pointer" : "not-allowed", opacity:textoMensaje.trim() ? 1 : .4 }}>▶ Mostrar ahora</button>
          </div>
        </div>}

        {!q && bibliaAbierta && <div style={{ padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,.07)", background:"rgba(37,99,235,.06)" }}>
          <input autoFocus value={referenciaBiblia} onChange={e => setReferenciaBiblia(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && referenciaBiblia.trim()) { onBiblia(referenciaBiblia.trim(), false); onCerrar() } }} placeholder="Ejemplo: Juan 3:16 o Salmos 23" style={{ width:"100%", boxSizing:"border-box", borderRadius:10, border:"1px solid rgba(148,163,184,.25)", background:"#091426", color:"white", padding:"11px", outline:"none", fontFamily:"inherit", fontSize:14 }} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:7, marginTop:8 }}>
            <button disabled={!referenciaBiblia.trim()} onClick={() => { onBiblia(referenciaBiblia.trim(), true); onCerrar() }} style={{ padding:"8px 11px", borderRadius:8, border:"1px solid rgba(96,165,250,.3)", background:"rgba(37,99,235,.1)", color:"#bfdbfe", fontWeight:800, cursor:referenciaBiblia.trim() ? "pointer" : "not-allowed", opacity:referenciaBiblia.trim() ? 1 : .4 }}>+ Lista</button>
            <button disabled={!referenciaBiblia.trim()} onClick={() => { onBiblia(referenciaBiblia.trim(), false); onCerrar() }} style={{ padding:"8px 13px", borderRadius:8, border:0, background:"#2563eb", color:"white", fontWeight:850, cursor:referenciaBiblia.trim() ? "pointer" : "not-allowed", opacity:referenciaBiblia.trim() ? 1 : .4 }}>📖 Proyectar</button>
          </div>
        </div>}

        <div style={{ overflowY:"auto", maxHeight:"55vh", padding:10 }}>
          {q && lista.map((it, i) => ({...it, i})).filter(it => normalizar(it.titulo || "").includes(normalizar(q))).slice(0,4).map(it => (
            <button key={`lista-${it.i}`} onClick={() => { onProyectarLista(it.i); onCerrar() }} style={{ width:"100%", display:"flex", gap:10, alignItems:"center", textAlign:"left", padding:"10px 12px", marginBottom:5, borderRadius:10, border:"1px solid rgba(34,197,94,.2)", background:"rgba(34,197,94,.07)", color:"white", cursor:"pointer" }}><span>📋</span><span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.titulo || "Elemento del culto"}</span><small style={{ color:"#86efac" }}>En la lista · Proyectar</small></button>
          ))}
          {q && cultosEncontrados.length > 0 && <>
            <div style={{ padding:"7px 8px 5px", color:"#64748b", fontSize:10, fontWeight:900, letterSpacing:1 }}>CULTOS GUARDADOS</div>
            {cultosEncontrados.map(c => <button key={c.id} onClick={async () => { if (await onAbrirCulto(c.id)) onCerrar() }} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, textAlign:"left", padding:"10px 12px", marginBottom:4, borderRadius:10, border:`1px solid ${c.id === cultoActivoId ? "rgba(96,165,250,.38)" : "rgba(255,255,255,.08)"}`, background:c.id === cultoActivoId ? "rgba(37,99,235,.13)" : "rgba(255,255,255,.035)", color:"white", cursor:"pointer" }}>
              <span>📂</span><span style={{ flex:1, minWidth:0 }}><b style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nombre || "Sin nombre"}</b>{c.fecha && <small style={{ color:"#94a3b8" }}>{new Date(c.fecha).toLocaleDateString("es-CL")}</small>}</span><small style={{ color:c.id === cultoActivoId ? "#93c5fd" : "#94a3b8" }}>{c.id === cultoActivoId ? "ABIERTO" : "Abrir"}</small>
            </button>)}
          </>}
          {q && recursosEncontrados.length > 0 && <>
            <div style={{ padding:"7px 8px 5px", color:"#64748b", fontSize:10, fontWeight:900, letterSpacing:1 }}>GALERÍA</div>
            {recursosEncontrados.map(r => <div className="selah-centro-fila" key={r.url} style={{ alignItems:"center", gap:8, padding:"7px 8px", borderRadius:11, background:"rgba(168,85,247,.055)", marginBottom:4 }}>
              <div style={{ width:42, height:32, borderRadius:7, overflow:"hidden", background:"#020617", flexShrink:0, display:"grid", placeItems:"center" }}>{r.video ? <span>🎬</span> : <img src={r.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />}</div>
              <div className="selah-comando-titulo" style={{ flex:1, minWidth:0 }}><b style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:12.5 }}>{r.nombre}</b><small style={{ color:"#94a3b8" }}>{r.video ? "Video" : "Imagen"}{r.carpeta ? ` · ${r.carpeta}` : ""}</small></div>
              <button onClick={() => { onRecurso(r, true); onCerrar() }} style={{ padding:"7px 9px", borderRadius:8, border:"1px solid rgba(196,181,253,.25)", background:"rgba(124,58,237,.11)", color:"#ddd6fe", fontWeight:800, cursor:"pointer" }}>+ Lista</button>
              <button onClick={() => { onRecurso(r, false); onCerrar() }} style={{ width:38, height:35, borderRadius:8, border:0, background:"#7c3aed", color:"white", cursor:"pointer" }}>▶</button>
            </div>)}
          </>}
          {!q && <div style={{ display:"flex", gap:6, padding:"3px 5px 9px" }}>
            {([['sugeridas','Sugeridas'],['favoritas',`★ Favoritas (${favoritos.length})`],['recientes','Recientes']] as const).map(([id,label]) => <button key={id} onClick={() => setVista(id)} style={{ padding:"6px 9px", borderRadius:999, border:`1px solid ${vista === id ? 'rgba(96,165,250,.45)' : 'rgba(255,255,255,.08)'}`, background:vista === id ? 'rgba(37,99,235,.16)' : 'transparent', color:vista === id ? '#bfdbfe' : '#94a3b8', fontSize:11, fontWeight:800, cursor:'pointer' }}>{label}</button>)}
          </div>}
          <div style={{ padding:"5px 8px", color:"#64748b", fontSize:10, fontWeight:900, letterSpacing:1 }}>{q ? "CANCIONES" : vista === "favoritas" ? "TUS FAVORITAS" : vista === "recientes" ? "USADAS RECIENTEMENTE" : "FAVORITAS Y RECIENTES"}</div>
          {resultados.map(c => {
            const fav = favoritos.includes(c.id), reciente = recientes.includes(c.id)
            return <div className="selah-centro-fila" key={c.id} style={{ alignItems:"center", gap:7, padding:"7px 8px", borderRadius:11, background:"rgba(255,255,255,.025)", marginBottom:4 }}>
              <button onClick={() => onFavorito(c.id)} aria-label={fav ? "Quitar de favoritos" : "Agregar a favoritos"} title={fav ? "Quitar de favoritos" : "Guardar como favorita"} style={{ width:32, height:32, border:0, background:"transparent", color:fav ? "#fbbf24" : "#64748b", fontSize:18, cursor:"pointer" }}>{fav ? "★" : "☆"}</button>
              <button className="selah-comando-titulo" onClick={() => { onProyectar(c.id); onCerrar() }} style={{ flex:1, minWidth:0, border:0, background:"transparent", color:"white", textAlign:"left", cursor:"pointer" }}>
                <span style={{ fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{c.numero ? `${c.numero}. ` : ""}{c.titulo}</span>
                <small style={{ color:"#94a3b8" }}>{c.tono ? `Tono ${c.tono}` : "Sin tono"}{reciente ? " · Usada recientemente" : ""}</small>
              </button>
              <button onClick={() => { onAgregar(c); onCerrar() }} title="Agregar al final de la lista del culto" style={{ padding:"7px 10px", borderRadius:8, border:"1px solid rgba(96,165,250,.25)", background:"rgba(37,99,235,.12)", color:"#bfdbfe", cursor:"pointer", fontWeight:750 }}>+ Lista</button>
              <button onClick={() => { onProyectar(c.id); onCerrar() }} title="Proyectar ahora" style={{ width:38, height:36, borderRadius:9, border:0, background:"#2563eb", color:"white", cursor:"pointer" }}>▶</button>
            </div>
          })}
          {!resultados.length && !recursosEncontrados.length && !cultosEncontrados.length && <div style={{ padding:28, textAlign:"center", color:"#94a3b8" }}>{q ? `No encontré canciones, recursos ni cultos con “${q}”.` : vista === "favoritas" ? "Todavía no has marcado canciones favoritas." : "Todavía no hay canciones recientes."}</div>}
        </div>
        <div className="selah-centro-pie" style={{ gap:12, padding:"9px 14px", borderTop:"1px solid rgba(255,255,255,.07)", color:"#64748b", fontSize:10 }}><span>↵ proyectar primera</span><span>★ favorita</span><span>+ Lista prepara sin proyectar</span></div>
      </div>
    </div>
  )
}
