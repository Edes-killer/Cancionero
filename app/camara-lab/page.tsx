"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { camaraNativaLab, laboratorioNativoDisponible } from "@/lib/camaraNativaLab"
import { copiarTexto } from "@/lib/copiar"
import { logError } from "@/lib/Errorlogger"
import { navegarSPA } from "@/lib/navegar"

export default function CamaraLab() {
  const router = useRouter()
  const [disponible, setDisponible] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [informe, setInforme] = useState("")
  const [aviso, setAviso] = useState("")
  const abriendo = useRef(false)
  useEffect(() => {
    let vigente = true
    const disponible = laboratorioNativoDisponible()
    setDisponible(disponible)
    if (disponible) void camaraNativaLab.ultimoInforme().then(r => {
      if (vigente) setInforme(r.informe)
    }).catch(() => { if (vigente) setAviso("No se pudo leer el informe anterior.") })
    return () => { vigente = false }
  }, [])

  async function abrir() {
    if (!disponible || abriendo.current) return
    abriendo.current = true; setOcupado(true); setAviso("")
    try {
      const r = await camaraNativaLab.abrir()
      setInforme(r.informe)
      setAviso("Informe guardado en este teléfono. Puedes copiarlo y volver a la cámara habitual.")
      if (/error|fallo|sin cuadros|denegado/i.test(r.informe)) {
        void logError("Laboratorio de cámara nativa: se detectaron incidencias", { pagina: "/camara-lab", detalle: { informe: r.informe.slice(-16000) } })
      }
    } catch (e) {
      setAviso("No se pudo abrir el laboratorio. La cámara habitual no fue reemplazada.")
      void logError("No se pudo abrir laboratorio CameraX", { pagina: "/camara-lab", detalle: { error: e instanceof Error ? e.message : String(e) } })
    } finally { abriendo.current = false; setOcupado(false) }
  }

  return <main style={{ maxWidth:640, margin:"0 auto", padding:20, color:"#e2e8f0" }}>
    <h1 style={{ fontSize:24 }}>Prueba de cámara nativa</h1>
    <p>Laboratorio de la APK debug. No transmite al PC, no usa micrófono y no guarda imágenes. La cámara habitual sigue siendo la opción de transmisión.</p>
    <p>Prueba frontal y trasera varias veces, toca para enfocar y gira el teléfono. Compara la fluidez y copia el informe al terminar.</p>
    {!disponible && <p role="status">Necesitas la nueva APK debug instalada. Este laboratorio no está incluido en la versión de producción.</p>}
    <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
      <button disabled={!disponible || ocupado} onClick={() => void abrir()} style={{ padding:14 }}>Abrir cámara nativa de prueba</button>
      <button disabled={ocupado} onClick={() => navegarSPA(router, "/camara")} style={{ padding:14 }}>Volver a cámara habitual</button>
    </div>
    {aviso && <p role="status">{aviso}</p>}
    {informe && <section style={{ marginTop:20 }}>
      <h2 style={{ fontSize:18 }}>Último informe local</h2>
      <button onClick={async () => setAviso(await copiarTexto(informe) ? "Informe copiado." : "No se pudo copiar. Selecciona el texto del informe.")}>Copiar informe</button>
      <textarea aria-label="Informe de cámara nativa" readOnly value={informe} style={{ width:"100%", height:260, marginTop:12, background:"#0f172a", color:"#e2e8f0", fontSize:12 }} />
    </section>}
  </main>
}
