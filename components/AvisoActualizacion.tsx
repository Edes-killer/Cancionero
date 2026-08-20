"use client"

// Aviso de "hay una versión nueva" — SOLO en la APK. Al abrir, consulta la versión
// publicada en la web (Vercel: /version.json) y, si es mayor a la instalada, muestra
// un banner. No auto-actualiza (eso requeriría un plugin nativo); solo AVISA. El
// usuario puede posponer una versión concreta con la ✕ (no vuelve a molestar por ella).

import { useEffect, useState } from "react"

// Se lee de GitHub (raw) en vez de la web/Vercel: se actualiza al instante con cada
// push y no depende de que Vercel despliegue. Es el mismo public/version.json del repo.
const URL_VERSION = process.env.NEXT_PUBLIC_UPDATE_URL
  || "https://raw.githubusercontent.com/Edes-killer/Cancionero/main/public/version.json"

// ¿a > b? (semver simple X.Y.Z)
const esMayor = (a: string, b: string): boolean => {
  const pa = a.split(".").map(n => parseInt(n, 10) || 0)
  const pb = b.split(".").map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

export default function AvisoActualizacion() {
  const [nueva, setNueva] = useState<string | null>(null)
  const [apkUrl, setApkUrl] = useState("")

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).Capacitor) return  // solo APK
    const actual = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0"
    fetch(`${URL_VERSION}?t=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then((d: any) => {
        if (!d?.version || !esMayor(d.version, actual)) return
        let ignorada = ""
        try { ignorada = localStorage.getItem("aviso-version-ignorada") || "" } catch {}
        if (ignorada === d.version) return   // ya la pospuso
        setNueva(d.version); setApkUrl(d.apkUrl || "")
      })
      .catch(() => {})
  }, [])

  if (!nueva) return null

  const posponer = () => { try { localStorage.setItem("aviso-version-ignorada", nueva) } catch {}; setNueva(null) }
  const actualizar = async () => {
    if (!apkUrl) return
    // Abrir en el navegador (Custom Tab) → el gestor de descargas de Android baja el
    // APK; al tocarlo, Android pide permiso de "instalar apps desconocidas" (normal).
    try {
      const { Browser } = await import("@capacitor/browser")
      await Browser.open({ url: apkUrl })
    } catch { window.open(apkUrl, "_blank") }
  }

  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 4000,
      background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff",
      borderRadius: 14, padding: "12px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", gap: 12, fontFamily: "system-ui, sans-serif"
    }}>
      <span style={{ fontSize: 22 }}>🔄</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Hay una versión nueva ({nueva})</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {apkUrl ? "Toca “Actualizar” para descargarla." : "Pídele la app actualizada al encargado."}
        </div>
      </div>
      {apkUrl && (
        <button onClick={actualizar} style={{
          background: "#fff", color: "#4f46e5", border: "none", borderRadius: 10,
          padding: "8px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0
        }}>Actualizar</button>
      )}
      <button onClick={posponer} aria-label="Posponer" style={{
        background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: 10,
        width: 32, height: 32, fontSize: 16, cursor: "pointer", flexShrink: 0
      }}>✕</button>
    </div>
  )
}
