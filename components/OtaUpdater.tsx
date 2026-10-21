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
import { Capacitor } from "@capacitor/core"
import type { BundleInfo, CapacitorUpdaterPlugin } from "@capgo/capacitor-updater"
import { logCatch } from "@/lib/Errorlogger"

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

interface ManifiestoOta {
  version: string
  url: string
  minApk?: string
}

type FaseActualizacion = "descargando" | "verificando" | "lista" | "aplicando" | "error"
interface EstadoActualizacion {
  fase: FaseActualizacion
  porcentaje: number
  detalle: string
}

const esManifiestoOta = (valor: unknown): valor is ManifiestoOta => {
  if (!valor || typeof valor !== "object") return false
  const candidato = valor as Record<string, unknown>
  return typeof candidato.version === "string"
    && typeof candidato.url === "string"
    && (candidato.minApk === undefined || typeof candidato.minApk === "string")
}

export default function OtaUpdater() {
  const [bundleListo, setBundleListo] = useState<BundleInfo | null>(null)
  const [version, setVersion] = useState("")
  const [updater, setUpdater] = useState<CapacitorUpdaterPlugin | null>(null)
  const [estado, setEstado] = useState<EstadoActualizacion | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return
    let cancelado = false
    let listenerDescarga: { remove: () => Promise<void> } | null = null
    ;(async () => {
      let Updater: CapacitorUpdaterPlugin
      try { ({ CapacitorUpdater: Updater } = await import("@capgo/capacitor-updater")) } catch { return }
      setUpdater(Updater)
      try {
        const listener = await Updater.addListener("download", ({ percent }) => {
          if (cancelado) return
          const porcentaje = Math.max(0, Math.min(100, Math.round(percent || 0)))
          setEstado(anterior => anterior ? {
            fase: porcentaje >= 100 ? "verificando" : "descargando",
            porcentaje: Math.max(anterior.porcentaje, porcentaje),
            detalle: porcentaje >= 100 ? "Comprobando que el paquete esté completo…" : "Puedes seguir usando Selah mientras termina.",
          } : anterior)
        })
        if (cancelado) await listener.remove()
        else listenerDescarga = listener
      } catch {}
      // 1) Confirmar que esta versión arrancó bien (evita el rollback de Capgo).
      try { await Updater.notifyAppReady() } catch {}
      // 2) Chequear manifiesto.
      try {
        const r = await fetch(`${MANIFEST}?t=${Date.now()}`, { cache: "no-store" })
        if (!r.ok) throw new Error(`Manifiesto OTA respondió HTTP ${r.status}`)
        const man: unknown = await r.json()
        if (cancelado || !esManifiestoOta(man)) return
        // No aplicar código web que dependa de cambios nativos ausentes. La
        // versión de App.getInfo() es la APK realmente instalada y no cambia
        // cuando se aplica un bundle OTA.
        if (man.minApk) {
          const { App } = await import("@capacitor/app")
          const info = await App.getInfo()
          if (esMayor(man.minApk, info.version || "0.0.0")) return
        }
        // Versión efectiva actual: la del bundle OTA si es válida; si no, la del APK.
        const actual = await Updater.current().catch(() => null)
        const otaV = actual?.bundle?.version
        const base = typeof otaV === "string" && esSemver(otaV)
          ? otaV
          : (process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0")
        if (!esMayor(man.version, base)) return
        setVersion(man.version)
        // 3) ¿Ya lo bajamos antes? (para no re-descargar en cada apertura).
        const lista = await Updater.list().catch(() => null)
        const yaBajado = lista?.bundles?.find(bundle => bundle.version === man.version)
        if (yaBajado) {
          if (!cancelado) {
            setBundleListo(yaBajado)
            setEstado({ fase:"lista", porcentaje:100, detalle:"La descarga terminó y fue verificada." })
          }
          return
        }
        // Si no, descargar en segundo plano.
        setEstado({ fase:"descargando", porcentaje:0, detalle:"Preparando la descarga segura…" })
        const bundle = await Updater.download({ url: man.url, version: man.version })
        if (cancelado || !bundle?.id) return
        setBundleListo(bundle)
        setEstado({ fase:"lista", porcentaje:100, detalle:"La descarga terminó y fue verificada." })
      } catch (e) {
        // Una caída de internet al abrir no es un error de la app. Sí dejamos
        // rastro de respuestas/manifiestos inválidos para poder diagnosticar OTA.
        if (navigator.onLine) logCatch(e, "No se pudo preparar la actualización OTA", { pagina: "ota", tipo: "general" })
        if (!cancelado) setEstado(anterior => anterior ? {
          fase:"error",
          porcentaje:anterior.porcentaje,
          detalle:"No se pudo completar la descarga. Selah puede seguir usándose normalmente.",
        } : anterior)
      }
    })()
    return () => {
      cancelado = true
      if (listenerDescarga) void listenerDescarga.remove()
    }
  }, [])

  if (!estado || !updater) return null

  const aplicar = async () => {
    if (!bundleListo) return
    setEstado({ fase:"aplicando", porcentaje:100, detalle:"Reiniciando Selah con la versión nueva…" })
    try { await updater.set(bundleListo) }
    catch (e) {
      logCatch(e, "No se pudo aplicar la actualización OTA", { pagina: "ota", tipo: "general" })
      setEstado({ fase:"error", porcentaje:100, detalle:"No se pudo aplicar. La versión anterior sigue intacta." })
    }
  }
  const posponer = () => { setBundleListo(null); setEstado(null) }
  const titulo = estado.fase === "descargando" ? `Descargando actualización ${version}`
    : estado.fase === "verificando" ? "Verificando actualización"
    : estado.fase === "lista" ? `Actualización lista (${version})`
    : estado.fase === "aplicando" ? "Aplicando actualización"
    : "No se pudo actualizar"
  const color = estado.fase === "error" ? "#ef4444" : estado.fase === "lista" ? "#22c55e" : "#38bdf8"

  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 4000, maxWidth:520, margin:"0 auto",
      background: "#0f172a", color: "#fff", border:`1px solid ${color}66`,
      borderRadius: 16, padding: "14px 16px", boxShadow: "0 14px 42px rgba(0,0,0,0.55)",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:22 }}>{estado.fase === "error" ? "⚠️" : estado.fase === "lista" ? "✅" : "⬇️"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:850, fontSize:14 }}>{titulo}</div>
          <div style={{ fontSize:12, color:"#cbd5e1", marginTop:2 }}>{estado.detalle}</div>
        </div>
        <strong style={{ color, fontVariantNumeric:"tabular-nums", fontSize:15 }}>{estado.porcentaje}%</strong>
      </div>
      <div role="progressbar" aria-label="Progreso de actualización" aria-valuemin={0} aria-valuemax={100} aria-valuenow={estado.porcentaje}
        style={{ height:8, borderRadius:99, overflow:"hidden", background:"rgba(255,255,255,.12)", marginTop:12 }}>
        <div style={{ width:`${estado.porcentaje}%`, height:"100%", borderRadius:99, background:color, transition:"width .2s ease" }} />
      </div>
      {(estado.fase === "lista" || estado.fase === "error") && <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
        <button onClick={posponer} style={{ background:"rgba(255,255,255,.08)", color:"#e2e8f0", border:"1px solid rgba(255,255,255,.12)", borderRadius:9, padding:"8px 12px", fontWeight:750, cursor:"pointer" }}>
          {estado.fase === "error" ? "Cerrar" : "Después"}
        </button>
        {estado.fase === "lista" && <button onClick={aplicar} style={{ background:"#fff", color:"#4338ca", border:"none", borderRadius:9, padding:"8px 14px", fontWeight:850, cursor:"pointer" }}>Aplicar ahora</button>}
      </div>}
    </div>
  )
}
