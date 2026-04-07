

"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { io } from "socket.io-client"


import { CSSProperties } from "react"

export default function ControlPage() {
  const [socket, setSocket] = useState<any>(null)
  const [canciones, setCanciones] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [lista, setLista] = useState<any[]>([])
  const [activaId, setActivaId] = useState<string | null>(null)
  const [cultos, setCultos] = useState<any[]>([])
  const [listaIdActual, setListaIdActual] = useState<string | null>(null)
  const [filtroTono, setFiltroTono] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [nombreCulto, setNombreCulto] = useState("")
  const [partes, setPartes] = useState<any[]>([])
  const [indiceLista, setIndiceLista] = useState<number | null>(null)
  const [autoPlay, setAutoPlay] = useState(false)
  const esCoro = partes[index]?.tipo === "Coro"
  const [loopCoro, setLoopCoro] = useState(false)
  

 useEffect(() => {
  const check = async () => {
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
      window.location.href = "/login"
    }
  }

  check()
}, []) 
  
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
  const intervalo = setInterval(() => {
    cargarCanciones()
  }, 3000)

  return () => clearInterval(intervalo)
}, [])

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


const [isMobile, setIsMobile] = useState(true)

useEffect(() => {
  setIsMobile(window.innerWidth < 768)
}, [])

const cargarLista = async () => {
  if (!listaIdActual) return

  const { data, error } = await supabase
    .from("items_lista")
    .select("*, canciones(*)")
    .eq("lista_id", listaIdActual)
    .order("orden")

  if (error) {
    console.error("Error cargando lista:", error)
    return
  }

  if (data) {
    // 🔥 formatear bien los datos
    const listaFormateada = data.map(item => item.canciones)
    setLista(listaFormateada)
  }
}

useEffect(() => {
  if (listaIdActual) {
    cargarLista()
  }
}, [listaIdActual])

useEffect(() => {
  if (!listaIdActual) return

  const intervalo = setInterval(() => {
    cargarLista()
  }, 2000)

  return () => clearInterval(intervalo)
}, [listaIdActual])

const proyectar = async (id: string) => {
  if (!socket) return

  setActivaId(id)
  setIndiceLista(null) // viene de canciones sueltas

  const { data } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", id)
    .order("orden")

  setPartes(data || [])
  setIndex(0)

  socket.emit("cargar-cancion", {
    partes: data,
    index: 0
  })

  socket.emit("cancion-activa", { id })
}


const siguiente = async () => {
  if (loopCoro && esCoro) return
  if (!socket) return

  const ultimo = index >= partes.length - 1

  if (!ultimo) {
    const nuevo = index + 1
    setIndex(nuevo)
    socket.emit("cambiar-parte", nuevo)
    return
  }

  // 🔥 SI TERMINÓ LA CANCIÓN
  if (indiceLista !== null && lista[indiceLista + 1]) {
    const siguienteIndex = indiceLista + 1
    const siguienteCancion = lista[siguienteIndex]

    setIndiceLista(siguienteIndex)

    const { data } = await supabase
      .from("partes_cancion")
      .select("*")
      .eq("cancion_id", siguienteCancion.id)
      .order("orden")

    setPartes(data || [])
    setIndex(0)
    setActivaId(siguienteCancion.id)
    
    socket.emit("cargar-cancion", {
      partes: data,
      index: 0
    })

    socket.emit("cancion-activa", {
      id: siguienteCancion.id
    })
  }
}

const anterior = () => {
  if (!socket) return

  if (index > 0) {
    const nuevo = index - 1
    setIndex(nuevo)
    socket.emit("cambiar-parte", nuevo)
  }
}



const agregarALista = (cancion: any) => {
  if (listaIdActual) {
    alert("⚠️ Estás editando un culto guardado. Presiona 'Nuevo' para crear otro.")
    return
  }

  const existe = lista.some(c => c.id === cancion.id)

  if (existe) {
    alert("⚠️ Esta canción ya está en la lista")
    return
  }

  setLista(prev => [...prev, {
    id: cancion.id,
    titulo: cancion.titulo
  }])
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
const culto = cultos.find(c => c.id === id)
setNombreCulto(culto?.nombre || "")
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
  const listaOrdenada = items.map(item => {
  const cancion = canciones.find(c => c.id === item.cancion_id)

  return {
    id: cancion?.id || item.cancion_id,
    titulo: cancion?.titulo || "⚠️ Sin título"
  }
})
console.log("ITEMS:", items)
console.log("CANCIONES:", canciones)
  setLista([...listaOrdenada])
}
const proyectarDesdeLista = async (i: number) => {
  if (!socket) return

  const item = lista[i]
  const id = item?.id
  if (!id) return

  setIndiceLista(i) // 🔥 IMPORTANTE
  setActivaId(id)

  const { data } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", id)
    .order("orden")

  setPartes(data || [])
  setIndex(0)

  socket.emit("cargar-cancion", {
    partes: data,
    index: 0
  })

  socket.emit("cancion-activa", { id })
}

const nombreTono = (tono?: string) => {
  const mapa: Record<string, string> = {
    C: "Do",
    Cm: "Do menor",
    D: "Re",
    Dm: "Re menor",
    E: "Mi",
    F: "Fa",
    G: "Sol",
    A: "La",
    B: "Si"
  }

  if (!tono) return ""
  return mapa[tono] || tono
}

useEffect(() => {
  if (!autoPlay) return

  const intervalo = setInterval(() => {
    siguiente()
  }, 5000) // cada 5 segundos

  return () => clearInterval(intervalo)
}, [autoPlay, index, partes])



const container: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "15px",
  padding: "10px",
  background: "#0f172a",
  color: "white",
  minHeight: "100vh"
}

const controles: CSSProperties = {
  gridColumn: "span 2",
  display: "flex",
  justifyContent: "center",
  gap: "14px"
}

const seccion: CSSProperties = {
  background: "#1e293b",
  padding: "15px",
  borderRadius: "12px",
  boxShadow: "0 0 10px rgba(0,0,0,0.3)",
  maxHeight: "80vh",
  overflowY: "auto"
}

const titulo: CSSProperties = {
  fontSize: "20px",
  marginBottom: "10px"
}

const card: CSSProperties = {
  background: "#334155",
  padding: "10px",
  borderRadius: "8px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
}

const acciones: CSSProperties = {
  display: "flex",
  gap: "8px"
}

const btn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer"
}

const btnGrande: CSSProperties = {
  padding: "14px 14px",
  fontSize: "20px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer"
}

const input: CSSProperties = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "none",
  background: "#1e293b",
}

const gridDesktop: CSSProperties = {
  
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "15px"
  
}

return (
  <div style={container}>
    
    {/* CONTROLES */}
    <div style={controles}>
      <button disabled={!socket} style={btnGrande} onClick={anterior}>⬅️</button>
      <button disabled={!socket} style={btnGrande} onClick={siguiente}>➡️</button>
      <button disabled={!socket}  style={btnGrande} onClick={() => setAutoPlay(a => !a)}>{autoPlay ? "⏹️ Detener" : "▶️ Auto"}</button>
      <button disabled={!socket} style={btnGrande} onClick={() => setLoopCoro(l => !l)}>  🔁 Coro</button>
    </div>

    {/* CANCIONES */}
    <div style={seccion}>
      <h2 style={titulo}>🎵 Canciones</h2>

      <input
        placeholder="Buscar canción..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={input}
      />

      <select
        value={filtroTono}
        onChange={(e) => setFiltroTono(e.target.value)}
        style={input}
      >
        <option value="">Todos los tonos</option>
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

      {canciones
  .filter(c =>
    c.titulo.toLowerCase().includes(busqueda.toLowerCase())
  )
  .filter(c => !filtroTono || c.tono === filtroTono)
  .map((c, i) => (
    <div
      key={c.id}
      style={{
        ...card,
        background: c.id === activaId ? "#16a34a" : "#334155"
      }}
    >
      <div>
        <strong>{c.titulo}</strong>
        <div style={{ fontSize: "12px", opacity: 0.7 }}>
          {c.autor || ""} {c.tono ? `• ${nombreTono(c.tono)}` : ""}
        </div>
      </div>

      <div style={acciones}>
        <button disabled={!socket} style={btn} onClick={() => proyectar(c.id)}>
          ▶️
        </button>
        <button disabled={!socket} style={btn} onClick={() => agregarALista(c)}>
          ➕
        </button>
      </div>
    </div>
  ))}
    </div>
{/* GUARDAR CULTO */}

<div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
  <button disabled={!socket} style={btn} onClick={guardarCulto}>
    💾 Guardar Culto
  </button>

  <button disabled={!socket}
    style={{ ...btn, background: "#16a34a" }}
    onClick={() => {
      const ok = confirm("¿Crear nuevo culto? Se perderá la lista actual")
      if (!ok) return

      setLista([])
      setListaIdActual(null)
      setNombreCulto("")
      setActivaId(null)
    }}
  >
    🆕 Nuevo
  </button>
</div>
<div style={seccion}>
  <h2 style={titulo}>💾 Cultos Guardados</h2>
<h2 style={titulo}>
</h2>
  {cultos.map((c) => (
    <div key={c.id} style={card}>
      <span>{c.nombre}</span>

      <div style={acciones}>
        <button disabled={!socket} style={btn} onClick={() => cargarListaDesdeBD(c.id)}>
          📂
        </button>

        <button disabled={!socket}
          style={{ ...btn, background: "#dc2626" }}
          onClick={async () => {
            const ok = confirm("¿Eliminar este culto completo?")
            if (!ok) return

            // 🔥 1. BORRAR ITEMS PRIMERO
            await supabase
              .from("items_lista")
              .delete()
              .eq("lista_id", c.id)

            // 🔥 2. BORRAR LISTA
            await supabase
              .from("listas_culto")
              .delete()
              .eq("id", c.id)

            cargarCultos()
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  ))}
</div>



    {/* LISTA DE CULTO */}
<div style={seccion}>
  📋 Lista de Culto {nombreCulto && `- ${nombreCulto}`}

  {lista.length === 0 && (
    <p style={{ opacity: 0.6 }}>No hay canciones aún</p>
  )}

  {lista.map((c, i) => (
    <div
      key={i}
      style={{
        ...card,
        background: c.id === activaId ? "#16a34a" : "#334155"
      }}
    >
      <span>
        {i + 1}. {c?.titulo || "Sin título"}
      </span>

      <div style={acciones}>
        <button style={btn} disabled={!socket} onClick={() => proyectarDesdeLista(i)}>
          ▶️
        </button>

        <button disabled={!socket}
          style={{ ...btn, background: "#dc2626" }}
          onClick={() => {
            const ok = confirm("¿Eliminar esta alabanza de la lista?")
            if (ok) eliminarDeLista(i)
          }}
        >
          ❌
        </button>
      </div>
    </div>
  ))}
</div>

  </div>
)
}

