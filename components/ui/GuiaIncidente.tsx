import { explicarIncidente, type ContextoIncidente } from "@/lib/incidentes"

interface Props {
  mensaje: string
  contexto: ContextoIncidente
  compacto?: boolean
  onReintentar?: () => void
  textoReintentar?: string
}

export default function GuiaIncidente({ mensaje, contexto, compacto = false, onReintentar, textoReintentar = "Reintentar" }: Props) {
  const guia = explicarIncidente(mensaje, contexto)
  const critico = guia.prioridad === "critico"
  return <div role="alert" style={{
    borderRadius:12, padding:compacto ? "10px 12px" : "13px 14px",
    background:critico ? "rgba(127,29,29,.34)" : "rgba(120,53,15,.30)",
    border:`1px solid ${critico ? "rgba(248,113,113,.42)" : "rgba(251,191,36,.38)"}`,
    color:"#fff", wordBreak:"break-word",
  }}>
    <div style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
      <span aria-hidden style={{ fontSize:18 }}>{critico ? "⛔" : "⚠️"}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:compacto ? 13 : 14, fontWeight:850 }}>{guia.titulo}</div>
        {!compacto && <div style={{ marginTop:4, fontSize:12, opacity:.78 }}>{guia.resumen}</div>}
        <div style={{ marginTop:6, fontSize:compacto ? 11.5 : 12, lineHeight:1.45 }}><b>Qué hacer:</b> {guia.accion}</div>
        {!compacto && <div style={{ marginTop:4, fontSize:11.5, opacity:.62 }}><b>Se conserva:</b> {guia.conserva}</div>}
        <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:9.5, opacity:.46, letterSpacing:.5 }}>CÓDIGO {guia.codigo}</span>
          {onReintentar && <button type="button" onClick={onReintentar} style={{ marginLeft:"auto", border:"1px solid rgba(255,255,255,.22)", borderRadius:8, padding:"6px 10px", background:"rgba(255,255,255,.1)", color:"#fff", fontSize:11.5, fontWeight:800, cursor:"pointer" }}>{textoReintentar}</button>}
        </div>
      </div>
    </div>
  </div>
}
