"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { io } from "socket.io-client"

export default function ControlPage() {
  const [socket, setSocket] = useState<any>(null)
  const [canciones, setCanciones] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [lista, setLista] = useState<any[]>([])
  const [partes, setPartes] = useState<any[]>([])
  const [cultos, setCultos] = useState<any[]>([])
  const [listaIdActual, setListaIdActual] = useState<string | null>(null)
  const [activaIndex, setActivaIndex] = useState<number | null>(null)
  const [filtroTono, setFiltroTono] = useState("")
  const [busqueda, setBusqueda] = useState("")

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
    s.disconnect()   // ✅ correcto
  }
}, [])

useEffect(() => {
  window.scrollTo({ top: 0, behavior: "smooth" })
}, [index])

  const cargarCanciones = async () => {
  console.log("🔥 CARGANDO CANCIONES")

  const { data, error } = await supabase
    .from("canciones")
    .select("*")

  console.log("DATA:", data)
  console.log("ERROR:", error)

  if (data) setCanciones(data)
}

useEffect(() => {
  cargarCanciones()
}, [])

const cargarLista = async () => {
  const { data } = await supabase
    .from("items_lista")
    .select("*, canciones(*)")
    .order("orden")
}

useEffect(() => {
  cargarLista()
}, [])

useEffect(() => {
  const intervalo = setInterval(() => {
    cargarLista()
  }, 2000)

  return () => clearInterval(intervalo)
}, [])

const proyectar = async (id: string) => {
  if (!socket) return

  const { data } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", id)
    .order("orden")

  const partesData = data || []

  setPartes(partesData)   // 🔥 guardamos partes
  setIndex(0)             // 🔥 reiniciamos índice
console.log("PROYECTANDO ID:", id)
  socket.emit("cargar-cancion", {
    partes: partesData,
    index: 0
  })
}
const siguiente = () => {
  const nuevo = index + 1

  setIndex(nuevo)

  socket.emit("cambiar-parte", nuevo)
}

  const anterior = () => {
  if (!socket) return

  if (index <= 0) return

  const nuevo = index - 1
  setIndex(nuevo)

  socket.emit("cambiar-parte", nuevo)
}

const agregarALista = (cancion: any) => {
  const nueva = {
    id: cancion.id,
    titulo: cancion.titulo
  }

  setLista(prev => [...prev, nueva])
}

const eliminarDeLista = async (index: number) => {
  const item = lista[index]

  setLista(prev => prev.filter((_, i) => i !== index))

  if (listaIdActual) {
    await supabase
      .from("items_lista")
      .delete()
      .eq("lista_id", listaIdActual)
      .eq("cancion_id", item.id)
  }
}

const guardarCulto = async () => {
const nombre = prompt("Nombre del culto")

  if (!nombre) return 

  if (listaIdActual) {
    // 🔥 UPDATE (ya existe)
    await supabase
      .from("items_lista")
      .delete()
      .eq("lista_id", listaIdActual)

    await Promise.all(
      lista.map((c, i) =>
        supabase.from("items_lista").insert({
          lista_id: listaIdActual,
          cancion_id: c.id,
          orden: i
        })
      )
    )

    alert("✅ Culto actualizado")
  } else {
    // 🔥 NUEVO
    const { data, error } = await supabase
  .from("listas_culto")
  .insert({ nombre })
  .select()

if (error || !data || data.length === 0) {
  console.error("ERROR AL CREAR LISTA", error)
  return
}

const nuevaId = data[0].id
setListaIdActual(nuevaId)

    await Promise.all(
      lista.map((c, i) =>
        supabase.from("items_lista").insert({
          lista_id: nuevaId,
          cancion_id: c.id,
          orden: i
        })
      )
    )

    alert("✅ Culto guardado")
  }
}

const cargarCultos = async () => {
  const { data, error } = await supabase
    .from("listas_culto")
    .select("*")
    .order("fecha", { ascending: false })

  if (data) setCultos(data)
}
useEffect(() => {
  cargarCultos()
}, [])

const cargarListaDesdeBD = async (id: string) => {
  setListaIdActual(id)

  // 1. traer items
  const { data: items, error } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", id)
    .order("orden")

  if (error || !items) {
    console.error("Error items:", error)
    return
  }

  // 2. traer canciones por id
  const ids = items.map(i => i.cancion_id)

  const { data: canciones, error: error2 } = await supabase
    .from("canciones")
    .select("*")
    .in("id", ids)

  if (error2 || !canciones) {
    console.error("Error canciones:", error2)
    return
  }

  // 3. ordenar correctamente
  const listaOrdenada = items.map(item =>
    canciones.find(c => c.id === item.cancion_id)
  )

  setLista(listaOrdenada)
}
const proyectarDesdeLista = async (i: number) => {
  setIndex(0)

  const item = lista[i]

  console.log("ITEM LISTA:", item)

  const id =
    item?.id ||
    item?.cancion_id ||
    item?.canciones?.id ||
    item?.canciones?.[0]?.id

  if (!id) {
    console.error("No hay ID válido")
    return
  }

  console.log("PROYECTANDO ID:", id)

  // 🔥 TRAER PARTES DESDE BD
const { data, error } = await supabase
  .from("partes_cancion") // ✅ corregido
  .select("*")
  .eq("cancion_id", id)
  .order("orden")

  if (error) {
    console.error("Error cargando partes:", error)
    return
  }

  console.log("PARTES ENVIADAS:", data)

  // 🔥 ENVIAR PARTES CORRECTAS
  socket.emit("cargar-cancion", {
    partes: data,
    index: 0
  })
}


  return (
    <div style={container} >

  {/* 🎮 CONTROLES */}
  <section style={{ marginBottom: 30 }}>
    <h3>🎮 Control</h3>

    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={anterior} style={btnGrande}>⬅️Anterior</button>
      <button onClick={siguiente} style={btnGrande}>Siguiente➡️</button>
    </div>
  </section>

  {/* 🎵 LISTA */}
  <section style={{ marginBottom: 30 }}>
    <h3>🎵 Lista de Culto</h3>

   {lista.map((c, i) => (
  <div key={`${c?.id}-${i}`} style={{
            ...card,
            border: activaIndex === i ? "2px solid #22c55e" : "none"
          }}
>    
    <span>
      {i + 1}. {c?.titulo || "Sin título"}
    </span>

    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => proyectarDesdeLista(i)}>▶️</button>
      <button onClick={() => eliminarDeLista(i)}>❌</button>
    </div>

  </div>
))}

  </section>

  {/* 💾 GUARDAR */}
  <section style={{ marginBottom: 30 }}>
    <button onClick={guardarCulto} style={btnPrincipal}>
      💾 Guardar Culto
    </button>
  </section>
   {/* 💾 BUSCADOR */} 
<input
  type="text"
  placeholder="Buscar canción..."
  value={busqueda}
  onChange={(e) => setBusqueda(e.target.value)}
  style={{
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "8px"
  }}
/>
  {/* 🎶 CANCIONES */}

  <select
  value={filtroTono}
  onChange={(e) => setFiltroTono(e.target.value)}
  style={{ marginBottom: 10 }}
>
  <option value="">Todos</option>
  <option value="C">Do</option>
  <option value="D">Re</option>
  <option value="E">Mi</option>
  <option value="F">Fa</option>
  <option value="G">Sol</option>
  <option value="A">La</option>
  <option value="B">Si</option>
</select>

  <section style={{ marginBottom: 30 }}>
    <h3>🎶 Canciones</h3>

    {
    canciones
  .filter(c =>
    c.titulo.toLowerCase().includes(busqueda.toLowerCase())
  )
  .filter(c => !filtroTono || c.tono === filtroTono)
  .map(c => (
  <div key={c.id} style={card}>
   <span>{c.titulo} {c.tono}</span>

    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => proyectar(c.id)}>▶️</button> {/* 🔥 ESTE FALTABA */}
      <button onClick={() => agregarALista(c)}>➕</button>
    </div>
  </div>
))}
  </section>

  {/* 📂 CULTOS */}
  <section>
    <h3>📂 Cultos guardados</h3>

    {cultos.map((c) => (
      <div key={c.id} style={card}>
        <span>{c.nombre}</span>
        <button onClick={() => cargarListaDesdeBD(c.id)}>📥</button>
      </div>
    ))}
  </section>

</div>
  )
}

const container = {
  background: "#000",
  minHeight: "100vh",
  color: "white",
  padding: 20
}

const card = {
  background: "#111",
  padding: 10,
  borderRadius: 10,
  marginBottom: 8,
  display: "flex",
  justifyContent: "space-between"
}

const btnPrincipal = {
  background: "#2563eb",
  color: "white",
  padding: "10px",
  borderRadius: 8
}

const btnGrande = {
  padding: "20px",
  borderRadius: "8px",
  marginTop: "10px",
  background: "#333",
  color: "white",
  border: "none",
  
  fontSize: "40px"
}