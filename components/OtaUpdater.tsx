"use client"

// OTA (Over-The-Air): actualiza la parte WEB de la app (React/JS) SIN reinstalar el
// APK. Solo en la APK (Capacitor). Modo MANUAL con Capgo:
//   1. notifyAppReady() al arrancar → confirma que esta versión funciona (si no se
//      llama, Capgo REVIERTE al bundle anterior → red de seguridad ante bundles malos).
//   2. Lee el manifiesto (GitHub raw ota.json = {version, url}).
//   3. Si es más nuevo que el bundle actual, DESCARGA el zip en segundo plano.
//   4. Muestra un banner "aplicar" — NO recarga solo (la app se usa en vivo en cultos).
//
// Los cambios NATIVOS (plugins/permisos nuevos) NO van por acá: esos siguen
// necesitando un APK nuevo (lo avisa AvisoActualizacion con el campo minApk).

import { useEffect, useState } from "react"

const MANIFEST = process.env.NEXT_PUBLIC_OTA_MANIFEST
  || "https://raw.githubusercontent.com/Edes-killer/Cancionero/main/public/ota.json"

const esSemver = (v?: string) => /^\d+\.\d+\.\d+/.test(v || "")
const esMayor = (a: string, b: string): boolean => {
  const pa = a.split(".").map(n => parseInt(n, 10) || 0)
  const pb = b.split(".").map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

export default function OtaUpdater() {
  const [bundleListo, setBundleListo] = useState<any>(null)   // bundle descargado, listo para aplicar
  const [version, setVersion] = useState("")
  const [updater, setUpdater] = useState<any>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).Capacitor) return
    let cancelado = false
    ;(async () => {
      let Updater: any
      try { ({ CapacitorUpdater: Updater } = await import("@capgo/capacitor-updater")) } catch { return }
      setUpdater(Updater)
      // 1) Confirmar que esta versión arrancó bien (evita el rollback de Capgo).
      try { await Updater.notifyAppReady() } catch {}
      // 2) Chequear manifiesto.
      try {
        const r = await fetch(`${MANIFEST}?t=${Date.now()}`, { cache: "no-store" })
        const man = await r.json()
        if (cancelado || !man?.version || !man?.url) return
        // Versión efectiva actual: la del bundle OTA si es válida; si no, la del APK.
        const actual = await Updater.current().catch(() => null)
        const otaV = actual?.bundle?.version
        const base = esSemver(otaV) ? otaV : (process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0")
        if (!esMayor(man.version, base)) return
        // 3) ¿Ya lo bajamos antes? (para no re-descargar en cada apertura).
        const lista = await Updater.list().catch(() => null)
        const yaBajado = lista?.bundles?.find((b: any) => b.version === man.version)
        if (yaBajado) { if (!cancelado) { setBundleListo(yaBajado); setVersion(man.version) } return }
        // Si no, descargar en segundo plano.
        const bundle = await Updater.download({ url: man.url, version: man.version })
        if (cancelado || !bundle?.id) return
        setBundleListo(bundle); setVersion(man.version)
      } catch { /* sin conexión / manifiesto no disponible: no pasa nada */ }
    })()
    return () => { cancelado = true }
  }, [])

  if (!bundleListo || !updater) return null

  const aplicar = async () => {
    try { await updater.set(bundleListo) } catch {}   // aplica y recarga la app
  }
  const posponer = () => setBundleListo(null)

  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 4000,
      background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff",
      borderRadius: 14, padding: "12px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", gap: 12, fontFamily: "system-ui, sans-serif"
    }}>
      <span style={{ fontSize: 22 }}>✨</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Actualización lista ({version})</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>Se aplica al instante, sin reinstalar. Evita hacerlo en medio de un culto.</div>
      </div>
      <button onClick={aplicar} style={{
        background: "#fff", color: "#4f46e5", border: "none", borderRadius: 10,
        padding: "8px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0
      }}>Aplicar</button>
      <button onClick={posponer} aria-label="Después" style={{
        background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: 10,
        width: 32, height: 32, fontSize: 16, cursor: "pointer", flexShrink: 0
      }}>✕</button>
    </div>
  )
}
