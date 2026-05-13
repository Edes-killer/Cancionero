"use client"

import { CSSProperties, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"

export default function ConfiguracionPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  const [iglesiaId, setIglesiaId] = useState("")
  const [nombre, setNombre] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoNombre, setLogoNombre] = useState("")

  useEffect(() => {
    const cargar = async () => {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        router.replace("/login")
        return
      }

      const id = await getIglesiaId()

      if (!id) {
        router.replace("/crear-iglesia")
        return
      }

      setIglesiaId(id)

      const { data, error } = await supabase
        .from("iglesias")
        .select("nombre, localidad, logo_url, logo_nombre")
        .eq("id", id)
        .single()

      if (error) {
        console.error("Error cargando iglesia:", error)
        alert("No se pudo cargar la configuración de la iglesia.")
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

  const optimizarLogoTransparente = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = () => {
      img.src = reader.result as string
    }

    reader.onerror = reject

    img.onload = () => {
      const maxSize = 1200

      let { width, height } = img

      const scale = Math.min(1, maxSize / width, maxSize / height)
      const newWidth = Math.round(width * scale)
      const newHeight = Math.round(height * scale)

      const canvas = document.createElement("canvas")
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext("2d", { willReadFrequently: true })

      if (!ctx) {
        reject(new Error("No se pudo crear canvas"))
        return
      }

      // Importante: NO pintar fondo blanco.
      ctx.clearRect(0, 0, newWidth, newHeight)
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      const imageData = ctx.getImageData(0, 0, newWidth, newHeight)
      const data = imageData.data

      const esFondoClaro = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return false

        const idx = (y * newWidth + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const a = data[idx + 3]

        if (a < 10) return true

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const diferencia = max - min

        // Blanco / gris claro / cuadriculado pegado al borde
        return max > 215 && diferencia < 32
      }

      const visitado = new Uint8Array(newWidth * newHeight)
      const cola: Array<[number, number]> = []

      const agregar = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return

        const pos = y * newWidth + x
        if (visitado[pos]) return

        if (!esFondoClaro(x, y)) return

        visitado[pos] = 1
        cola.push([x, y])
      }

      // Empezar desde los bordes para borrar solo el fondo exterior,
      // no los blancos internos como la paloma, Biblia o letras.
      for (let x = 0; x < newWidth; x++) {
        agregar(x, 0)
        agregar(x, newHeight - 1)
      }

      for (let y = 0; y < newHeight; y++) {
        agregar(0, y)
        agregar(newWidth - 1, y)
      }

      while (cola.length > 0) {
        const [x, y] = cola.shift()!

        const idx = (y * newWidth + x) * 4
        data[idx + 3] = 0

        agregar(x + 1, y)
        agregar(x - 1, y)
        agregar(x, y + 1)
        agregar(x, y - 1)
      }

      ctx.putImageData(imageData, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo optimizar el logo"))
            return
          }

          const nombreBase = file.name.replace(/\.[^/.]+$/, "")

          const archivoOptimizado = new File(
            [blob],
            `${nombreBase}.webp`,
            { type: "image/webp" }
          )

          resolve(archivoOptimizado)
        },
        "image/webp",
        0.92
      )
    }

    img.onerror = reject
    reader.readAsDataURL(file)
  })
}

  const subirArchivoLogo = async (file: File) => {
    if (!iglesiaId) return

    try {
      setSubiendoLogo(true)

      const archivoOptimizado = file

      const baseName = file.name.replace(/\.[^/.]+$/, "")
      const nombreAmigable = baseName
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()

      const extension = file.name.split(".").pop()?.toLowerCase() || "png"

      const nombreArchivo = `logos/${iglesiaId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`

      const { error: errorUpload } = await supabase.storage
        .from("imagenes-culto")
        .upload(nombreArchivo, archivoOptimizado, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        })

      if (errorUpload) {
        console.error("Error subiendo logo:", errorUpload)
        alert(`No se pudo subir el logo: ${errorUpload.message}`)
        return
      }

      const { data } = supabase.storage
        .from("imagenes-culto")
        .getPublicUrl(nombreArchivo)

      const nuevaUrl = data.publicUrl
      const nuevoNombre = nombreAmigable || "Logo de iglesia"

      const { error: errorUpdate } = await supabase
        .from("iglesias")
        .update({
          logo_url: nuevaUrl,
          logo_nombre: nuevoNombre
        })
        .eq("id", iglesiaId)

      if (errorUpdate) {
        console.error("Error guardando logo:", errorUpdate)
        alert("El logo se subió, pero no se pudo guardar en la iglesia.")
        return
      }

      setLogoUrl(nuevaUrl)
      setLogoNombre(nuevoNombre)
      alert("✅ Logo actualizado")
    } catch (error) {
      console.error("Error procesando logo:", error)
      alert("No se pudo procesar el logo.")
    } finally {
      setSubiendoLogo(false)
    }
  }

  const guardarDatos = async () => {
    if (!iglesiaId) return

    if (!nombre.trim()) {
      alert("El nombre de la iglesia no puede quedar vacío.")
      return
    }

    try {
      setGuardando(true)

      const { error } = await supabase
        .from("iglesias")
        .update({
          nombre: nombre.trim(),
          localidad: localidad.trim() || null
        })
        .eq("id", iglesiaId)

      if (error) {
        console.error("Error guardando iglesia:", error)
        alert("No se pudo guardar la configuración.")
        return
      }

      alert("✅ Configuración guardada")
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  const quitarLogo = async () => {
    if (!iglesiaId) return

    const ok = confirm("¿Quitar el logo de esta iglesia?")
    if (!ok) return

    const { error } = await supabase
      .from("iglesias")
      .update({
        logo_url: null,
        logo_nombre: null
      })
      .eq("id", iglesiaId)

    if (error) {
      console.error("Error quitando logo:", error)
      alert("No se pudo quitar el logo.")
      return
    }

    setLogoUrl("")
    setLogoNombre("")
  }

  const card: CSSProperties = {
    background: "rgba(15,23,42,0.94)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "24px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.30)"
  }

  const input: CSSProperties = {
    width: "100%",
    padding: "14px 15px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#020617",
    color: "white",
    outline: "none",
    fontSize: "15px",
    boxSizing: "border-box"
  }

  const label: CSSProperties = {
    fontSize: "13px",
    fontWeight: 800,
    opacity: 0.72,
    marginBottom: "7px"
  }

  const btnPrincipal: CSSProperties = {
    border: "none",
    borderRadius: "16px",
    padding: "14px 18px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 14px 32px rgba(37,99,235,0.22)"
  }

  const btnSecundario: CSSProperties = {
    ...btnPrincipal,
    background: "rgba(30,41,59,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "none"
  }

  const btnRojo: CSSProperties = {
    ...btnSecundario,
    background: "rgba(220,38,38,0.88)"
  }

  if (cargando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          fontWeight: 900
        }}
      >
        Cargando configuración...
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(34,197,94,0.14), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "white",
        padding: "22px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}
      >
        <div
          style={{
            ...card,
            padding: "22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap"
          }}
        >
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                opacity: 0.62,
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              Ajustes de iglesia
            </div>

            <h1
              style={{
                margin: "6px 0 0",
                fontSize: "clamp(28px, 4vw, 44px)",
                lineHeight: 1
              }}
            >
              Configuración
            </h1>
          </div>

          <button style={btnSecundario} onClick={() => router.push("/")}>
            ← Volver al inicio
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "18px"
          }}
        >
          <div
            style={{
              ...card,
              padding: "22px"
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "22px" }}>
              Datos generales
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={label}>Nombre de la iglesia</div>
                <input
                  style={input}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre de la iglesia"
                />
              </div>

              <div>
                <div style={label}>Localidad / ciudad</div>
                <input
                  style={input}
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  placeholder="Ej: La Ligua, Renca, Santiago..."
                />
              </div>

              <button
                style={{
                  ...btnPrincipal,
                  opacity: guardando ? 0.6 : 1,
                  cursor: guardando ? "not-allowed" : "pointer"
                }}
                disabled={guardando}
                onClick={guardarDatos}
              >
                {guardando ? "Guardando..." : "💾 Guardar cambios"}
              </button>
            </div>
          </div>

          <div
            style={{
              ...card,
              padding: "22px"
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "22px" }}>
              Logo de iglesia
            </h2>

            <div
              style={{
                padding: "18px",
                borderRadius: "20px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "16px"
              }}
            >
              <div
                style={{
                  width: "92px",
                  height: "92px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo iglesia"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "999px",
                      transform: "scale(1)",
                      display: "block"
                    }}
                  />
                ) : (
                  <span style={{ fontSize: "40px" }}>⛪</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "17px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                  title={logoNombre || "Sin logo"}
                >
                  {logoNombre || "Sin logo configurado"}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "13px",
                    opacity: 0.62,
                    lineHeight: 1.35
                  }}
                >
                  Sube una imagen desde tu computador. La app la optimiza
                  automáticamente antes de guardarla.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap"
              }}
            >
              <label
                style={{
                  ...btnPrincipal,
                  opacity: subiendoLogo ? 0.6 : 1,
                  cursor: subiendoLogo ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {subiendoLogo ? "Subiendo..." : "🖼️ Subir / cambiar logo"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={subiendoLogo}
                  onChange={async (e) => {
                    const inputFile = e.target as HTMLInputElement
                    const file = inputFile.files?.[0]
                    if (!file) return

                    await subirArchivoLogo(file)
                    inputFile.value = ""
                  }}
                />
              </label>

              {logoUrl && (
                <button style={btnRojo} onClick={quitarLogo}>
                  ❌ Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            ...card,
            padding: "20px",
            display: "flex",
            alignItems: "center",
            gap: "14px"
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "18px",
              background: "rgba(37,99,235,0.16)",
              border: "1px solid rgba(37,99,235,0.30)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              flexShrink: 0
            }}
          >
            ℹ️
          </div>

          <div style={{ opacity: 0.72, lineHeight: 1.45, fontSize: "14px" }}>
            El logo queda guardado en la iglesia activa. Se podrá usar en el
            Inicio, pantallas de espera y más adelante como marca opcional en el
            Proyector.
          </div>
        </div>
      </div>
    </div>
  )
}