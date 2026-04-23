"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"

export default function CancionesPage() {
  const [socket, setSocket] = useState<any>(null)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [activaId, setActivaId] = useState<string | null>(null)
  const [partes, setPartes] = useState<any[]>([
  { tipo: "Verso", texto: "", formato: "solo" }
])
  const [canciones, setCanciones] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState("")
const [filtroTono, setFiltroTono] = useState("")
  const [editandoId, setEditandoId] = useState<string | null>(null)
  // 🧠 NORMALIZAR ACORDES (soporta do, DO, mi, etc)
const normalizarAcorde = (acorde: string) => {
  const mapaBase: Record<string, string> = {
    do: "Do",
    re: "Re",
    mi: "Mi",
    fa: "Fa",
    sol: "Sol",
    la: "La",
    si: "Si",
    c: "Do",
    d: "Re",
    e: "Mi",
    f: "Fa",
    g: "Sol",
    a: "La",
    b: "Si"
  }

  const match = acorde.trim().match(/^(do|re|mi|fa|sol|la|si|c|d|e|f|g|a|b)(#|b)?(.*)$/i)
  if (!match) return acorde.trim()

  const base = mapaBase[match[1].toLowerCase()] || match[1]
  const alteracion = match[2] || ""
  const resto = match[3] || ""

  return `${base}${alteracion}${resto}`
}

// 🔍 detectar si una línea son acordes
const esLineaAcordes = (linea: string) => {
  const tokens = linea.trim().split(/\s+/)

  return tokens.every(t =>
    t.match(
      /^([A-G]|Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(m|maj|min|sus|dim|aug)?\d*(\/[A-G])?(\(.*?\))?$/i
    )
  )
}

// ⚡ convertir formato iglesia → corchetes
const convertirAcordesAutomatico = (texto: string) => {
  const lineas = texto.split("\n")
  const resultado: string[] = []

  for (let i = 0; i < lineas.length; i++) {
    const acordesLinea = lineas[i]
    const letraLinea = lineas[i + 1]

    if (esLineaAcordes(acordesLinea) && letraLinea) {
      let nuevaLinea = ""
      let j = 0

      while (j < letraLinea.length) {
        const char = letraLinea[j]

        // 🟢 Si hay acorde en esa posición
        const posibleAcorde = acordesLinea[j]

        if (posibleAcorde && posibleAcorde !== " ") {
          // leer acorde completo (SOL, RE, DO, etc)
          let acorde = ""
          let k = j

          while (acordesLinea[k] && acordesLinea[k] !== " ") {
            acorde += acordesLinea[k]
            k++
          }

          nuevaLinea += `[${normalizarAcorde(acorde)}]`
          j = k
          continue
        }

        nuevaLinea += char
        j++
      }

      resultado.push(nuevaLinea)
      i++ // saltar línea de letra
    } else {
      resultado.push(acordesLinea)
    }
  }

  return resultado.join("\n")
}

// 🎯 detectar tono automático

  
  // SOCKET
  useEffect(() => {
  const s = io("http://" + window.location.hostname + ":4000")

  s.on("connect", () => {
    console.log("🔥 SOCKET CONECTADO")
  })

  s.on("connect_error", (err) => {
    console.log("❌ ERROR SOCKET:", err)
  })

  setSocket(s)

  return () => {
    s.disconnect()  // ✅ ESTO ES CLAVE
  }
}, [])

  // CARGAR CANCIONES
  const cargarCanciones = async () => {
    const { data,error } = await supabase.from("canciones").select("*")
      console.log("DATOS:", data)
  console.log("ERROR:", error)
  
    setCanciones(data || [])
  }
  

useEffect(() => {
  if (!socket) {
  console.log("❌ SOCKET NO LISTO")
  return
}

  const handleActiva = (data: any) => {
    setActivaId(data.id)
  }

  socket.on("cancion-activa", handleActiva)

  return () => {
    socket.off("cancion-activa", handleActiva)
  }
}, [socket])

  useEffect(() => {
     console.log("🔥 CARGANDO CANCIONES...")
    cargarCanciones()
  }, [])

  // AGREGAR PARTE
  const agregarParte = () => {
  setPartes(prev => [
    ...prev,
    { tipo: "Verso", texto: "", formato: "solo" }
  ])
}

  // EDITAR PARTE
  const actualizarParte = (index: number, campo: string, valor: string) => {
    const nuevas = [...partes]
    nuevas[index][campo] = valor
    setPartes(nuevas)
  }
  useEffect(() => {
  const textoCompleto = partes.map(p => p.texto).join(" ")
  const auto = detectarTono(textoCompleto)

  if (auto && !tono) {
    setTono(auto)
  }
}, [partes])

  // GUARDAR
  
const guardarCancion = async () => {
  const textoCompleto = partes.map(p => p.texto).join(" ")
  const tonoDetectado = normalizarAcorde(tono || detectarTono(textoCompleto) || "")

  let cancionId = editandoId

  if (editandoId) {
    const { error } = await supabase
      .from("canciones")
      .update({
        titulo,
        tono: tonoDetectado
      })
      .eq("id", editandoId)

    if (error) {
      console.log(error)
      alert("Error al actualizar canción")
      return
    }

    const { error: errorDelete } = await supabase
      .from("partes_cancion")
      .delete()
      .eq("cancion_id", editandoId)

    if (errorDelete) {
      console.log(errorDelete)
      alert("Error actualizando partes")
      return
    }
  } else {
    const { data: cancion, error } = await supabase
      .from("canciones")
      .insert({
        titulo,
        tono: tonoDetectado
      })
      .select()
      .single()

    if (error || !cancion) {
      console.log(error)
      alert("Error al guardar canción")
      return
    }

    cancionId = cancion.id
  }

  const partesInsert = partes.map((p, i) => ({
    cancion_id: cancionId,
    tipo: p.tipo,
    texto: p.texto,
    orden: i
  }))

  const { error: errorPartes } = await supabase
    .from("partes_cancion")
    .insert(partesInsert)

  if (errorPartes) {
    console.log(errorPartes)
    alert("Error guardando partes")
    return
  }

  setTitulo("")
  setTono("")
  setPartes([{ tipo: "Verso", texto: "", formato: "solo" }])
  setEditandoId(null)
  cargarCanciones()

  alert(editandoId ? "Canción actualizada ✅" : "Guardado OK 🔥")
}


const proyectar = async (cancionId: string) => {
  if (!socket) return

  const { data } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", cancionId)
    .order("orden")

  const cancion = canciones.find(c => c.id === cancionId)

  // 🔥 EMITIR TODO CORRECTAMENTE
  socket.emit("cargar-cancion", {
    partes: data,
    index: 0,
    titulo: cancion?.titulo,
    tono: cancion?.tono
  })

  socket.emit("cancion-activa", { id: cancionId })
}
  
const inferirFormato = (texto: string) => {
  if (texto.includes("[")) return "corchetes"

  const lineas = texto.split("\n")
  for (let i = 0; i < lineas.length - 1; i++) {
    if (esLineaAcordes(lineas[i]) && lineas[i + 1]?.trim()) {
      return "linea"
    }
  }

  return "solo"
}

const editarCancion = async (cancionId: string) => {
  const cancion = canciones.find(c => c.id === cancionId)
  if (!cancion) return

  const { data, error } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", cancionId)
    .order("orden")

  if (error) {
    console.log(error)
    alert("No se pudo cargar la canción")
    return
  }

  setEditandoId(cancionId)
  setTitulo(cancion.titulo || "")
  setTono(cancion.tono || "")
  setPartes(
    (data || []).map((p: any) => ({
      ...p,
      formato: inferirFormato(p.texto)
    }))
  )

  window.scrollTo({ top: 0, behavior: "smooth" })
}

const eliminarCancion = async (cancionId: string) => {
  const ok = confirm("¿Eliminar esta canción? Esta acción no se puede deshacer.")
  if (!ok) return

  const { error: errorPartes } = await supabase
    .from("partes_cancion")
    .delete()
    .eq("cancion_id", cancionId)

  if (errorPartes) {
    console.log(errorPartes)
    alert("Error eliminando partes de la canción")
    return
  }

  const { error: errorCancion } = await supabase
    .from("canciones")
    .delete()
    .eq("id", cancionId)

  if (errorCancion) {
    console.log(errorCancion)
    alert("Error eliminando canción")
    return
  }

  if (editandoId === cancionId) {
    setEditandoId(null)
    setTitulo("")
    setTono("")
    setPartes([{ tipo: "Verso", texto: "", formato: "solo" }])
  }

  cargarCanciones()
  alert("Canción eliminada ✅")
}


// 🎯 DETECTAR TONO AUTOMÁTICO
const detectarTono = (texto: string) => {
  const palabras = texto.split(/\s+/)

  for (const palabra of palabras) {
    const limpia = palabra.replace(/[^a-zA-Z#b]/g, "")
    const normalizada = normalizarAcorde(limpia)

    if (normalizada.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?m?$/i)) {
      return normalizada
    }
  }

  return ""
}


  const btn = {
  padding: 12,
  marginRight: 10,
  marginTop: 10,
  background: "#333",
  color: "white",
  border: "none"
}

const btnPrimary = {
  ...btn,
  background: "#0070f3"
}

const card = {
  padding: 15,
  marginTop: 10,
  background: "#222",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
}

const placeholderSegunFormato = (formato?: string) => {
  if (formato === "linea") {
    return `Ejemplo con acordes arriba:
C                    F            C
Hay una senda que el mundo no conoce
        G7                       C
Hay una senda que yo pude encontrar`
  }

  if (formato === "corchetes") {
    return `[Do]Hay una senda que el mundo [Fa]no conoce
[Sol7]Hay una senda que yo pude [Do]encontrar`
  }

  return `Ejemplo solo letra:
Hay una senda que el mundo no conoce
Hay una senda que yo pude encontrar`
}


const ejemploSegunFormato = (formato?: string) => {
  if (formato === "linea") {
    return `C                    F            C
Hay una senda que el mundo no conoce
        G7                       C
Hay una senda que yo pude encontrar`
  }

  if (formato === "corchetes") {
    return `[Do]Hay una senda que el mundo [Fa]no conoce
[Sol7]Hay una senda que yo pude [Do]encontrar`
  }

  return `Hay una senda que el mundo no conoce
Hay una senda que yo pude encontrar`
}

  return (
  <div
    style={{
      padding: 20,
      background: "#111",
      color: "white",
      minHeight: "100vh"
    }}
  >
    <h1 style={{ fontSize: 28 }}>🎶 Cancionero</h1>

    {/* CREAR */}
    <div style={{ marginBottom: 30 }}>
      <h2>Crear Canción</h2>
      {editandoId && (
        <div style={{ marginBottom: 10, opacity: 0.8 }}>
          Editando canción actual
        </div>
      )}
      <input
        placeholder="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        style={{ padding: 10, width: "100%", marginBottom: 10 ,background: "#333",}}
      />

      <select
  value={tono}
  onChange={(e) => setTono(e.target.value)}
  style={{
    padding: "10px",
    borderRadius: "8px",
    marginTop: "10px",
    background: "#333",
  }}
>
  <option value="">Tono</option>
<option value="Do">Do</option>
<option value="Dom">Do menor</option>
<option value="Do#">Do#</option>
<option value="Re">Re</option>
<option value="Rem">Re menor</option>
<option value="Re#">Re#</option>
<option value="Mi">Mi</option>
<option value="Mim">Mi menor</option>
<option value="Fa">Fa</option>
<option value="Fam">Fa menor</option>
<option value="Fa#">Fa#</option>
<option value="Sol">Sol</option>
<option value="Solm">Sol menor</option>
<option value="Sol#">Sol#</option>
<option value="La">La</option>
<option value="Lam">La menor</option>
<option value="La#">La#</option>
<option value="Si">Si</option>
<option value="Sim">Si menor</option>
</select>
{tono && (
  <div
    style={{
      marginTop: "8px",
      fontSize: "13px",
      opacity: 0.8
    }}
  >
    Tono actual: <strong>{tono}</strong>
  </div>
)}
      {partes.map((p, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <select
            value={p.tipo}
            onChange={(e) =>
              actualizarParte(i, "tipo", e.target.value)
            }
            style={{ width: "100%" ,background: "#333",padding: "10px",
    borderRadius: "8px",
    marginTop: "10px",}}
          >
            <option>Verso</option>
            <option>Coro</option>
            <option>Puente</option>
          </select>
          <select
  value={p.formato || "solo"}
  onChange={(e) => actualizarParte(i, "formato", e.target.value)}
  style={{
    width: "100%",
    background: "#333",
    padding: "10px",
    borderRadius: "8px",
    marginTop: "10px",
    color: "white"
  }}
>
  <option value="solo">Solo letra</option>
  <option value="linea">Acordes arriba</option>
  <option value="corchetes">Corchetes</option>
</select>
          <div
  style={{
    fontSize: "13px",
    opacity: 0.75,
    marginTop: "10px",
    marginBottom: "6px",
    lineHeight: 1.4
  }}
>
  Formato seleccionado:{" "}
  <strong>
    {p.formato === "linea"
      ? "Acordes arriba"
      : p.formato === "corchetes"
      ? "Corchetes"
      : "Solo letra"}
  </strong>
</div>    
          <textarea 
          style={{
  width: "100%",
  minHeight: "220px",
  background: "#333",
  padding: "12px",
  borderRadius: "8px",
  marginTop: "10px",
  color: "white",
  border: "1px solid rgba(255,255,255,0.08)",
  resize: "vertical",
  lineHeight: 1.5,
  fontSize: "15px",
  boxSizing: "border-box"
}}
  placeholder={placeholderSegunFormato(p.formato)}
  value={p.texto}
  onChange={(e) =>
    actualizarParte(i, "texto", e.target.value)
  }
/>

<div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
  <button
    onClick={() => {
      setPartes(prev => {
        const nuevas = [...prev]
        if (!nuevas[i]) return prev

        nuevas[i].texto = nuevas[i].texto.trim()
          ? nuevas[i].texto
          : ejemploSegunFormato(nuevas[i].formato)

        return nuevas
      })
    }}
    style={btn}
  >
    ✍️ Ejemplo de esta parte
  </button>
</div>
        </div>
      ))}

      

      <button onClick={agregarParte} style={btn}>
        + Parte
      </button>

      <button onClick={guardarCancion} style={btnPrimary}>
        💾 Guardar
      </button>
      {editandoId && (
          <button
            onClick={() => {
              setEditandoId(null)
              setTitulo("")
              setTono("")
              setPartes([{ tipo: "Verso", texto: "", formato: "solo" }])
            }}
            style={btn}
          >
            Cancelar edición
          </button>
        )}
     
<button
  onClick={() => {
  const textoCompleto = partes.map(p => p.texto).join(" ")
  const tonoDetectado = detectarTono(textoCompleto)
  if (tonoDetectado) setTono(tonoDetectado)
}}
  style={btn}
>
  
  🎯 Detectar tono
</button>

<button
  onClick={() => {
    setPartes(prev =>
      prev.map(p => ({
        ...p,
        texto: p.texto
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
      }))
    )
  }}
  style={btn}
>
  🧹 Limpiar saltos
</button>
    </div>

    {/* LISTA */}
    <h2>Canciones</h2>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
  <input
    placeholder="Buscar por título..."
    value={busqueda}
    onChange={(e) => setBusqueda(e.target.value)}
    style={{
      flex: "1 1 260px",
      padding: 10,
      background: "#333",
      color: "white",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "8px"
    }}
  />

  <select
    value={filtroTono}
    onChange={(e) => setFiltroTono(e.target.value)}
    style={{
      minWidth: "180px",
      padding: 10,
      background: "#333",
      color: "white",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "8px"
    }}
  >
    <option value="">Todos los tonos</option>
    <option value="Do">Do</option>
    <option value="Dom">Do menor</option>
    <option value="Do#">Do#</option>
    <option value="Re">Re</option>
    <option value="Rem">Re menor</option>
    <option value="Re#">Re#</option>
    <option value="Mi">Mi</option>
    <option value="Mim">Mi menor</option>
    <option value="Fa">Fa</option>
    <option value="Fam">Fa menor</option>
    <option value="Fa#">Fa#</option>
    <option value="Sol">Sol</option>
    <option value="Solm">Sol menor</option>
    <option value="Sol#">Sol#</option>
    <option value="La">La</option>
    <option value="Lam">La menor</option>
    <option value="La#">La#</option>
    <option value="Si">Si</option>
    <option value="Sim">Si menor</option>
  </select>
</div>
    {canciones
  .filter((c) =>
    c.titulo?.toLowerCase().includes(busqueda.toLowerCase())
  )
  .filter((c) => !filtroTono || c.tono === filtroTono)
  .map((c, i) => (
  <div
    key={c.id}
    style={{
      ...card,
      background: c.id === activaId ? "#16a34a" : "#334155"
    }}
  >
    <div>
  <div style={{ fontWeight: 700 }}>{c.titulo}</div>
  {c.tono && (
    <div style={{ fontSize: "12px", opacity: 0.75, marginTop: "4px" }}>
      Tono: {c.tono}
    </div>
  )}
</div>

    <div style={{ display: "flex", gap: 8 }}>
  <button
    onClick={() => editarCancion(c.id)}
    style={btn}
  >
    ✏️ Editar
  </button>

  <button
    onClick={() => proyectar(c.id)}
    style={btnPrimary}
  >
    ▶ Proyectar
  </button>

  <button
    onClick={() => eliminarCancion(c.id)}
    style={{ ...btn, background: "#dc2626" }}
  >
    🗑 Eliminar
  </button>
</div>
  </div>
))}
  </div>
)
}