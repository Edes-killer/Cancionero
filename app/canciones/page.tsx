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
    { tipo: "Verso", texto: "" }
  ])

  const [canciones, setCanciones] = useState<any[]>([])

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
    { tipo: "Verso", texto: "" }
  ])
}

  // EDITAR PARTE
  const actualizarParte = (index: number, campo: string, valor: string) => {
    const nuevas = [...partes]
    nuevas[index][campo] = valor
    setPartes(nuevas)
  }

  // GUARDAR
  const guardarCancion = async () => {
  const { data: cancion, error } = await supabase.from("canciones").insert({
  titulo,
  tono
})
    .select()
    .single()

  console.log("CANCION:", cancion)
  console.log("ERROR:", error)
  setTitulo("")
  setTono("")
  setPartes([{ tipo: "Verso", texto: "" }])
  cargarCanciones()

  if (error) {
    alert("Error al guardar canción")
    return
  }

  const partesInsert = partes.map((p, i) => ({
    cancion_id: cancion.id,
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

  alert("Guardado OK 🔥")
}

  const proyectar = async (cancionId: string) => {
  if (!socket) return

  setActivaId(cancionId)

  const { data } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", cancionId)
    .order("orden")

  // 🔥 PROYECTA
  socket.emit("cargar-cancion", {
    partes: data,
    index: 0
  })

  // 🔥 SINCRONIZA VERDE
  socket.emit("cancion-activa", {
    id: cancionId
  })
  console.log("🟢 EMITIENDO ACTIVA (canciones):", cancionId)

  socket.emit("cancion-activa", { id: cancionId })
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
  <option value="C">Do</option>
  <option value="Cm">Do menor</option>
  <option value="D">Re</option>
  <option value="Dm">Re menor</option>
  <option value="E">Mi</option>
  <option value="F">Fa</option>
  <option value="G">Sol</option>
  <option value="A">La</option>
  <option value="B">Si</option>
</select>

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

          <textarea
            placeholder="Texto"
            value={p.texto}
            onChange={(e) =>
              actualizarParte(i, "texto", e.target.value)
            }
            style={{
              padding: 10,
              width: "100%",
              height: 80,
              marginTop: 5
            }}
          />
        </div>
      ))}

      <button onClick={agregarParte} style={btn}>
        + Parte
      </button>

      <button onClick={guardarCancion} style={btnPrimary}>
        💾 Guardar
      </button>
    </div>

    {/* LISTA */}
    <h2>Canciones</h2>

    {canciones.map((c, i) => (
  <div
    key={c.id}
    style={{
      ...card,
      background: c.id === activaId ? "#16a34a" : "#334155"
    }}
  >
    <div>{c.titulo}</div>

    <button
      onClick={() => proyectar(c.id)}
      style={btnPrimary}
    >
      ▶ Proyectar
    </button>
  </div>
))}
  </div>
)
}