"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"

export default function CancionesPage() {
  const [socket, setSocket] = useState<any>(null)
  const [titulo, setTitulo] = useState("")
  const [tono, setTono] = useState("")
  const [activaId, setActivaId] = useState<string | null>(null)
  const [partes, setPartes] = useState<any[]>([{ tipo: "Verso", texto: "" }])
  const [canciones, setCanciones] = useState<any[]>([])
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
    { tipo: "Verso", texto: "" }
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
  // 🔥 generar texto completo
  const textoCompleto = partes.map(p => p.texto).join(" ")

  // 🔥 detectar tono automático
  const tonoDetectado = normalizarAcorde(tono || detectarTono(textoCompleto) || "")

  
  // 🔥 guardar canción
  const { data: cancion, error } = 
  await supabase
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

  // 🔥 guardar partes
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

  // 🔥 limpiar
  setTitulo("")
  setTono("")
  setPartes([{ tipo: "Verso", texto: "" }])
  cargarCanciones()

  alert("Guardado OK 🔥")
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
  
// 🎯 NORMALIZAR TEXTO (para mayúsculas/minúsculas)
const normalizar = (txt: string) => txt.toLowerCase()

// 🎯 MAPAS DE TONOS
const mapaLatino: any = {
  do: "Do", re: "Re", mi: "Mi", fa: "Fa",
  sol: "Sol", la: "La", si: "Si"
}

const mapaAmericano: any = {
  c: "C", d: "D", e: "E", f: "F",
  g: "G", a: "A", b: "B"
}

// 🎯 DETECTAR TONO AUTOMÁTICO
const detectarTono = (texto: string) => {
  const palabras = texto.split(/\s+/)

  for (const palabra of palabras) {
    const limpia = palabra.replace(/[^a-zA-Z#b]/g, "")
    const normalizada = normalizarAcorde(limpia)

    const match = normalizada.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?m?$/i)
    if (match) {
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

          <textarea style={{ width: "100%",height:"150px" ,background: "#333",padding: "10px",
    borderRadius: "8px",
    marginTop: "10px",}}
  placeholder={`Opciones:
1) Solo letra:
Mi alma te alaba Señor

2) Línea de acordes:
Sol      Re
Mi alma te alaba Señor

3) Corchetes:
[Sol]Mi alma te alaba [Re]Señor`}
  value={p.texto}
  onChange={(e) =>
    actualizarParte(i, "texto", e.target.value)
  }
/>
        </div>
      ))}

      

      <button onClick={agregarParte} style={btn}>
        + Parte
      </button>

      <button onClick={guardarCancion} style={btnPrimary}>
        💾 Guardar
      </button>
      <button
  onClick={() => {
  setPartes(prev =>
    prev.map(p => ({
      ...p,
      texto: convertirAcordesAutomatico(p.texto)
    }))
  )
}}
  style={btn}
>
  ⚡ Auto Formato
</button>

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
    const nuevoTexto = convertirAcordesAutomatico(partes[0].texto)
    
    setPartes(prev => {
      const nuevas = [...prev]
      nuevas[0].texto = nuevoTexto
      return nuevas
    })
  }}
  style={btn}
>
  ⚡ Auto Formato Acordes
</button>
<button
  onClick={() => {
    const texto = partes[0].texto
    const ejemplo = `Sol       Re
Mi alma te alaba Señor`
    if (!texto.trim()) {
      setPartes(prev => {
        const nuevas = [...prev]
        nuevas[0].texto = ejemplo
        return nuevas
      })
    }
  }}
  style={btn}
>
  ✍️ Ejemplo acordes
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