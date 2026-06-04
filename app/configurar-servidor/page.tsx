"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function ConfigurarServidor() {
  const [ip, setIp] = useState("")
  const [puerto, setPuerto] = useState("4000")
  const [estado, setEstado] = useState<"buscando" | "manual" | "encontrado">("buscando")
  const [progreso, setProgreso] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const ipGuardada = localStorage.getItem("servidor_ip")
    if (ipGuardada) setIp(ipGuardada)
    buscarServidor()
  }, [])

  const buscarServidor = async () => {
    setEstado("buscando")
    setProgreso(0)

    // Detectar subred desde la IP guardada o asumir 192.168.1
    const ipGuardada = localStorage.getItem("servidor_ip") || ""
    const partes = ipGuardada.split(".")
    const subred = partes.length === 4 ? `${partes[0]}.${partes[1]}.${partes[2]}` : "192.168.1"

    const rango = Array.from({ length: 254 }, (_, i) => i + 1)
    const LOTE = 20
    let encontrado = false

    for (let i = 0; i < rango.length && !encontrado; i += LOTE) {
      const lote = rango.slice(i, i + LOTE)
      setProgreso(Math.round((i / rango.length) * 100))

      await Promise.any(
        lote.map(n =>
          fetch(`http://${subred}.${n}:4000/ping`, { signal: AbortSignal.timeout(800) })
            .then(async r => {
              const json = await r.json()
              if (json?.app === "selah-live") {
                const ipEncontrada = `${subred}.${n}`
                localStorage.setItem("servidor_ip", ipEncontrada)
                localStorage.setItem("servidor_puerto", "4000")
                setIp(ipEncontrada)
                setEstado("encontrado")
                encontrado = true
                setTimeout(() => router.replace("/control"), 1500)
              }
            })
        )
      ).catch(() => {})
    }

    if (!encontrado) setEstado("manual")
  }

  const guardar = () => {
    if (!ip.trim()) return
    localStorage.setItem("servidor_ip", ip.trim())
    localStorage.setItem("servidor_puerto", puerto.trim() || "4000")
    router.replace("/control")
  }

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 20,
      background: "#060d1a", color: "white", padding: 24,
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, color: "#3b82f6" }}>■■</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Selah Live</h1>

      {estado === "buscando" && (
        <>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14, textAlign: "center" }}>
            Buscando servidor en tu red...
          </p>
          <div style={{ width: 200, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 99 }}>
            <div style={{ width: `${progreso}%`, height: "100%", background: "#3b82f6", borderRadius: 99, transition: "width 0.3s" }} />
          </div>
          <p style={{ margin: 0, opacity: 0.4, fontSize: 12 }}>{progreso}%</p>
          <button onClick={() => setEstado("manual")} style={{
            padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer"
          }}>
            Ingresar IP manualmente
          </button>
        </>
      )}

      {estado === "encontrado" && (
        <>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>¡Servidor encontrado!</p>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>{ip}</p>
          <p style={{ margin: 0, opacity: 0.4, fontSize: 12 }}>Conectando...</p>
        </>
      )}

      {estado === "manual" && (
        <>
          <p style={{ margin: 0, opacity: 0.5, fontSize: 14, textAlign: "center" }}>
            No se encontró el servidor automáticamente.{"\n"}Ingresa la IP manualmente.
          </p>
          <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={ip} onChange={e => setIp(e.target.value)}
              placeholder="192.168.1.5"
              style={{
                padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)", color: "white", fontSize: 16,
                outline: "none", width: "100%", boxSizing: "border-box"
              }}
            />
            <button onClick={guardar} style={{
              padding: "14px", borderRadius: 12, border: "none",
              background: "#2563eb", color: "white", fontSize: 16,
              fontWeight: 700, cursor: "pointer"
            }}>
              Conectar →
            </button>
            <button onClick={buscarServidor} style={{
              padding: "10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer"
            }}>
              Buscar de nuevo
            </button>
          </div>
        </>
      )}
    </div>
  )
}