"use client"

import { CSSProperties, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"

export default function ConfiguracionPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)

  const [iglesiaId, setIglesiaId] = useState("")
  const [nombre, setNombre] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoNombre, setLogoNombre] = useState("")

  const [flash, setFlash] = useState<{ msg: string; tipo: "ok" | "error" | "info" } | null>(null)

  const mostrarFlash = (msg: string, tipo: "ok" | "error" | "info" = "ok") => {
    setFlash({ msg, tipo })
    setTimeout(() => setFlash(null), 3000)
  }

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.replace("/login"); return }

      const id = await getIglesiaId()
      if (!id) { router.replace("/crear-iglesia"); return }

      setIglesiaId(id)

      const { data, error } = await supabase
        .from("iglesias")
        .select("nombre, localidad, logo_url, logo_nombre")
        .eq("id", id)
        .single()

      if (error) {
        mostrarFlash("No se pudo cargar la configuración", "error")
        setCargando(false)
        return
      }

      setNombre(data?.nombre || "")
      setLocalidad(data?.localidad || "")
      setLogoUrl(data?.logo_url || "")
      setLogoNombre(data?.logo_nombre || "")
      setCargando(false)
    }

    cargar()
  }, [router])

  // ── Optimizador de logo: elimina fondo blanco con flood-fill ─────────────────
  //  ✅ FIX: esta función ahora sí se llama en subirArchivoLogo
  const optimizarLogoTransparente = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = () => { img.src = reader.result as string }
      reader.onerror = reject

      img.onload = () => {
        const maxSize = 1200
        const scale = Math.min(1, maxSize / img.width, maxSize / img.height)
        const newWidth = Math.round(img.width * scale)
        const newHeight = Math.round(img.height * scale)

        const canvas = document.createElement("canvas")
        canvas.width = newWidth
        canvas.height = newHeight

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) { reject(new Error("No se pudo crear canvas")); return }

        ctx.clearRect(0, 0, newWidth, newHeight)
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        const imageData = ctx.getImageData(0, 0, newWidth, newHeight)
        const data = imageData.data

        const esFondoClaro = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return false
          const idx = (y * newWidth + x) * 4
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3]
          if (a < 10) return true
          const max = Math.max(r, g, b)
          const diferencia = max - Math.min(r, g, b)
          return max > 215 && diferencia < 32
        }

        const visitado = new Uint8Array(newWidth * newHeight)
        const cola: Array<[number, number]> = []

        const agregar = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return
          const pos = y * newWidth + x
          if (visitado[pos] || !esFondoClaro(x, y)) return
          visitado[pos] = 1
          cola.push([x, y])
        }

        // Flood-fill desde los 4 bordes para no eliminar blancos internos
        for (let x = 0; x < newWidth; x++) { agregar(x, 0); agregar(x, newHeight - 1) }
        for (let y = 0; y < newHeight; y++) { agregar(0, y); agregar(newWidth - 1, y) }

        while (cola.length > 0) {
          const [x, y] = cola.shift()!
          const idx = (y * newWidth + x) * 4
          data[idx + 3] = 0
          agregar(x + 1, y); agregar(x - 1, y)
          agregar(x, y + 1); agregar(x, y - 1)
        }

        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("No se pudo generar WebP")); return }
            const nombreBase = file.name.replace(/\.[^/.]+$/, "")
            resolve(new File([blob], `${nombreBase}.webp`, { type: "image/webp" }))
          },
          "image/webp",
          0.92
        )
      }

      img.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ── Subir logo ───────────────────────────────────────────────────────────────
  const subirArchivoLogo = async (file: File) => {
    if (!iglesiaId) return

    try {
      setSubiendoLogo(true)
      mostrarFlash("Procesando imagen...", "info")

      // ✅ FIX: ahora sí se usa optimizarLogoTransparente
      let archivoFinal: File
      try {
        archivoFinal = await optimizarLogoTransparente(file)
      } catch {
        // Si falla la optimización, usamos el archivo original
        archivoFinal = file
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "")
      const nombreAmigable = baseName.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
      const extension = archivoFinal.name.split(".").pop()?.toLowerCase() || "webp"
      const nombreArchivo = `logos/${iglesiaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

      const { error: errorUpload } = await supabase.storage
        .from("imagenes-culto")
        .upload(nombreArchivo, archivoFinal, {
          cacheControl: "3600",
          upsert: false,
          contentType: archivoFinal.type
        })

      if (errorUpload) {
        mostrarFlash(`No se pudo subir el logo: ${errorUpload.message}`, "error")
        return
      }

      const { data } = supabase.storage.from("imagenes-culto").getPublicUrl(nombreArchivo)
      const nuevaUrl = data.publicUrl
      const nuevoNombre = nombreAmigable || "Logo de iglesia"

      const { error: errorUpdate } = await supabase
        .from("iglesias")
        .update({ logo_url: nuevaUrl, logo_nombre: nuevoNombre })
        .eq("id", iglesiaId)

      if (errorUpdate) {
        mostrarFlash("El logo se subió pero no se pudo guardar", "error")
        return
      }

      setLogoUrl(nuevaUrl)
      setLogoNombre(nuevoNombre)
      mostrarFlash("✅ Logo actualizado correctamente")
    } catch (error) {
      console.error("Error procesando logo:", error)
      mostrarFlash("No se pudo procesar el logo", "error")
    } finally {
      setSubiendoLogo(false)
    }
  }

  // ── Guardar datos ────────────────────────────────────────────────────────────
  const guardarDatos = async () => {
    if (!iglesiaId) return
    if (!nombre.trim()) { mostrarFlash("El nombre no puede quedar vacío", "error"); return }

    setGuardando(true)
    const { error } = await supabase
      .from("iglesias")
      .update({ nombre: nombre.trim(), localidad: localidad.trim() || null })
      .eq("id", iglesiaId)

    setGuardando(false)

    if (error) { mostrarFlash("No se pudo guardar la configuración", "error"); return }

    mostrarFlash("✅ Configuración guardada")
    router.refresh()
  }

  // ── Quitar logo ──────────────────────────────────────────────────────────────
  const quitarLogo = async () => {
    if (!iglesiaId) return

    const { error } = await supabase
      .from("iglesias")
      .update({ logo_url: null, logo_nombre: null })
      .eq("id", iglesiaId)

    if (error) { mostrarFlash("No se pudo quitar el logo", "error"); return }

    setLogoUrl("")
    setLogoNombre("")
    setConfirmarQuitar(false)
    mostrarFlash("Logo eliminado")
  }

  // ── Estilos ──────────────────────────────────────────────────────────────────
  const card: CSSProperties = {
    background: "rgba(15,23,42,0.94)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "24px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.30)"
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#020617",
    color: "white",
    outline: "none",
    fontSize: "16px", // ✅ evita zoom automático en iOS
    boxSizing: "border-box"
  }

  const labelStyle: CSSProperties = {
    fontSize: "12px",
    fontWeight: 800,
    opacity: 0.6,
    marginBottom: "8px",
    display: "block",
    letterSpacing: "0.07em",
    textTransform: "uppercase"
  }

  const btnPrincipal: CSSProperties = {
    border: "none",
    borderRadius: "14px",
    padding: "13px 18px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(37,99,235,0.22)",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px"
  }

  const btnSecundario: CSSProperties = {
    ...btnPrincipal,
    background: "rgba(30,41,59,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "none"
  }

  const btnRojo: CSSProperties = {
    ...btnSecundario,
    background: "rgba(220,38,38,0.15)",
    color: "#fca5a5",
    border: "1px solid rgba(239,68,68,0.25)"
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.08)",
          borderTopColor: "#3b82f6",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ opacity: 0.5, fontSize: 15 }}>Cargando configuración...</div>
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(34,197,94,0.14), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
      color: "white",
      padding: "14px 12px 40px",
      boxSizing: "border-box",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflowX: "hidden"
    }}>

      {/* Flash mensaje */}
      {flash && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          background: flash.tipo === "ok" ? "rgba(34,197,94,0.15)"
            : flash.tipo === "error" ? "rgba(239,68,68,0.15)"
            : "rgba(59,130,246,0.15)",
          border: `1px solid ${flash.tipo === "ok" ? "rgba(34,197,94,0.35)"
            : flash.tipo === "error" ? "rgba(239,68,68,0.35)"
            : "rgba(59,130,246,0.35)"}`,
          color: "white", padding: "11px 24px", borderRadius: 12,
          fontSize: 14, fontWeight: 600, zIndex: 999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap"
        }}>
          {flash.msg}
        </div>
      )}

      <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* Header */}
        <div style={{ ...card, padding: "22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 900, opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Ajustes de iglesia
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 40px)", lineHeight: 1, fontWeight: 900 }}>
              ⚙️ Configuración
            </h1>
          </div>
          <button style={btnSecundario} onClick={() => router.push("/")}>
            ← Volver al inicio
          </button>
        </div>

        {/* Grid principal */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>

          {/* ── Datos generales ── */}
          <div style={{ ...card, padding: "24px" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              🏛️ Datos generales
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Nombre de la iglesia *</label>
                <input
                  style={inputStyle}
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: IEP La Ligua"
                />
              </div>

              <div>
                <label style={labelStyle}>Localidad / ciudad</label>
                <input
                  style={inputStyle}
                  value={localidad}
                  onChange={e => setLocalidad(e.target.value)}
                  placeholder="Ej: La Ligua, Renca, Santiago..."
                />
              </div>

              {/* Vista previa */}
              <div style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)"
              }}>
                <div style={{ fontSize: 11, opacity: 0.45, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                  Vista previa
                </div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{nombre || "Nombre de la iglesia"}</div>
                <div style={{ opacity: 0.45, fontSize: 13, marginTop: 3 }}>{localidad || "Sin localidad"}</div>
              </div>

              <button
                style={{ ...btnPrincipal, opacity: guardando ? 0.6 : 1, cursor: guardando ? "not-allowed" : "pointer" }}
                disabled={guardando}
                onClick={guardarDatos}
              >
                {guardando ? "⏳ Guardando..." : "💾 Guardar cambios"}
              </button>
            </div>
          </div>

          {/* ── Logo ── */}
          <div style={{ ...card, padding: "24px" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              🖼️ Logo de iglesia
            </h2>

            {/* Preview logo */}
            <div style={{
              padding: "18px",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "20px"
            }}>
              <div style={{
                width: 92, height: 92,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0
              }}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 38 }}>⛪</span>
                }
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {logoNombre || "Sin logo configurado"}
                </div>
                <div style={{ marginTop: 5, fontSize: 13, opacity: 0.55, lineHeight: 1.4 }}>
                  {logoUrl
                    ? "Logo activo — se elimina el fondo blanco automáticamente"
                    : "Sube una imagen PNG, JPG o SVG. Se optimiza automáticamente."}
                </div>
                {subiendoLogo && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>
                    ⏳ Procesando y subiendo...
                  </div>
                )}
              </div>
            </div>

            {/* Acciones logo */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <label style={{
                ...btnPrincipal,
                opacity: subiendoLogo ? 0.6 : 1,
                cursor: subiendoLogo ? "not-allowed" : "pointer"
              }}>
                {subiendoLogo ? "Subiendo..." : "📁 Subir / cambiar logo"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={subiendoLogo}
                  onChange={async e => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    await subirArchivoLogo(file)
                    ;(e.target as HTMLInputElement).value = ""
                  }}
                />
              </label>

              {logoUrl && !confirmarQuitar && (
                <button style={btnRojo} onClick={() => setConfirmarQuitar(true)}>
                  ❌ Quitar logo
                </button>
              )}

              {/* Confirmación inline en vez de confirm() */}
              {confirmarQuitar && (
                <div style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap"
                }}>
                  <span style={{ fontSize: 13, color: "#fca5a5", flex: 1 }}>
                    ¿Seguro que quieres quitar el logo?
                  </span>
                  <button onClick={quitarLogo} style={{ ...btnRojo, padding: "7px 14px", fontSize: 13 }}>
                    Sí, quitar
                  </button>
                  <button onClick={() => setConfirmarQuitar(false)} style={{ ...btnSecundario, padding: "7px 14px", fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.15)",
              fontSize: 12,
              opacity: 0.7,
              lineHeight: 1.5
            }}>
              ℹ️ El logo se muestra en el dashboard y puede usarse en pantallas de espera. El fondo blanco se elimina automáticamente al subir.
            </div>
          </div>
        </div>

        {/* Links rápidos */}
        <div style={{ ...card, padding: "20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>
            Accesos rápidos
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { href: "/control", label: "🎛️ Control", desc: "Operar el culto" },
              { href: "/canciones", label: "🎵 Canciones", desc: "Gestionar repertorio" },
              { href: "/", label: "⌂ Dashboard", desc: "Estadísticas" },
            ].map(({ href, label, desc }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                style={{
                  ...btnSecundario,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "12px 16px",
                  minWidth: 130
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 14 }}>{label}</span>
                <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}