

"use client"

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react"

import { supabase } from "@/lib/supabase"
import { io } from "socket.io-client"
import { getIglesiaId } from "../../lib/getIglesia"

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
  const [inputBiblia, setInputBiblia] = useState("")
  const [indiceActivoLista, setIndiceActivoLista] = useState<number | null>(null)
  const [paginasBiblia, setPaginasBiblia] = useState<string[]>([])
  const [paginaBibliaActual, setPaginaBibliaActual] = useState(0)
  const [nombreIglesia, setNombreIglesia] = useState("")
  const listaRef = useRef(lista)
  const indiceListaRef = useRef(indiceLista)
  const indexRef = useRef(index)
  const partesRef = useRef(partes)
  const paginasBibliaRef = useRef(paginasBiblia)
  const paginaBibliaActualRef = useRef(paginaBibliaActual)
  const loopCoroRef = useRef(loopCoro)
  const siguienteRef = useRef<() => Promise<void>>(async () => {})
  const anteriorRef = useRef<() => Promise<void>>(async () => {})

  

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

  s.on("cancion-activa", (data: any) => {
    setActivaId(data.id)
  })

  const onSiguiente = async () => {
    await siguienteRef.current()
  }

  const onAnterior = async () => {
    await anteriorRef.current()
  }

  s.on("control-siguiente", onSiguiente)
  s.on("control-anterior", onAnterior)

  setSocket(s)

  return () => {
    s.off("control-siguiente", onSiguiente)
    s.off("control-anterior", onAnterior)
    s.disconnect()
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
  //console.log("🔥 CARGANDO CANCIONES")

  const { data, error } = await supabase
    .from("canciones")
    .select("*")

  console.log("DATA:", data)
  console.log("ERROR:", error)

  if (data) setCanciones(data)
}

useEffect(() => {
  listaRef.current = lista
  indiceListaRef.current = indiceLista
  indexRef.current = index
  partesRef.current = partes
  paginasBibliaRef.current = paginasBiblia
  paginaBibliaActualRef.current = paginaBibliaActual
  loopCoroRef.current = loopCoro
}, [lista, indiceLista, index, partes, paginasBiblia, paginaBibliaActual, loopCoro])

useEffect(() => {
  cargarCanciones()
}, [])

useEffect(() => {
  cargarCanciones()
  cargarCultos()
  cargarNombreIglesia()
}, [])

const [isMobile, setIsMobile] = useState(true)

useEffect(() => {
  setIsMobile(window.innerWidth < 768)
}, [])

const cargarLista = async () => {
  if (!listaIdActual) return
  await cargarListaDesdeBD(listaIdActual)
}

useEffect(() => {
  if (listaIdActual) {
    cargarLista()
  }
}, [listaIdActual])



const cargarNombreIglesia = async () => {
  const iglesiaId = await getIglesiaId()
  if (!iglesiaId) return

  const { data, error } = await supabase
    .from("iglesias")
    .select("nombre")
    .eq("id", iglesiaId)
    .single()

  if (error) {
    console.error("Error cargando iglesia:", error)
    return
  }

  setNombreIglesia(data?.nombre || "")
}

const proyectar = async (id: string) => {
  if (!socket) return

  const idxEnLista = lista.findIndex(
    item => item.tipo === "cancion" && item.id === id
  )

  if (idxEnLista !== -1) {
    await irAItemLista(idxEnLista, false)
    return
  }

  const cancion = canciones.find(c => c.id === id)

  const { data, error } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", id)
    .order("orden")

  if (error) {
    console.error(error)
    return
  }

  setActivaId(id)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  limpiarModoBiblia()

  setPartes(data || [])
  setIndex(0)

  socket.emit("cargar-cancion", {
    partes: data,
    index: 0,
    titulo: cancion?.titulo || "",
    tono: cancion?.tono || "",
    iglesia: ""
  })

  socket.emit("cancion-activa", { id })
}

const partirEnPaginasCliente = (texto: string, maxChars = 650) => {
  const limpio = texto
    .replace(/\/n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const palabras = limpio.split(" ")
  const paginas: string[] = []
  let actual = ""

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra

    if (candidato.length > maxChars) {
      if (actual) paginas.push(actual)
      actual = palabra
    } else {
      actual = candidato
    }
  }

  if (actual) paginas.push(actual)

  return paginas
}

const siguiente = async () => {
  if (!socket) return

  // Biblia proyectada directa, fuera de lista
  if (indiceLista === null && paginasBiblia.length > 0) {
    if (paginaBibliaActual < paginasBiblia.length - 1) {
      const nuevaPagina = paginaBibliaActual + 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
    }
    return
  }

  // Canción proyectada directa, fuera de lista
  if (indiceLista === null) {
    const ultimo = index >= partes.length - 1
    if (!ultimo) {
      if (loopCoro && esCoro) return
      const nuevo = index + 1
      setIndex(nuevo)
      socket.emit("cambiar-parte", nuevo)
    }
    return
  }

  const itemActual = lista[indiceLista]

  // Biblia dentro de la lista
  if (itemActual?.tipo === "biblia") {
    if (paginaBibliaActual < paginasBiblia.length - 1) {
      const nuevaPagina = paginaBibliaActual + 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
      return
    }
  }

  // Canción dentro de la lista
  if (itemActual?.tipo === "cancion") {
    const ultimo = index >= partes.length - 1
    if (!ultimo) {
      if (loopCoro && esCoro) return
      const nuevo = index + 1
      setIndex(nuevo)
      socket.emit("cambiar-parte", nuevo)
      return
    }
  }

  // Imagen, Biblia terminada, o canción terminada
  if (lista[indiceLista + 1]) {
  await irAItemLista(indiceLista + 1, false)
}
}

const anterior = async () => {
  if (!socket) return

  // Biblia proyectada directa, fuera de lista
  if (indiceLista === null && paginasBiblia.length > 0) {
    if (paginaBibliaActual > 0) {
      const nuevaPagina = paginaBibliaActual - 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
    }
    return
  }

  // Canción proyectada directa, fuera de lista
  if (indiceLista === null) {
    if (index > 0) {
      const nuevo = index - 1
      setIndex(nuevo)
      socket.emit("cambiar-parte", nuevo)
    }
    return
  }

  const itemActual = lista[indiceLista]

  // Biblia dentro de la lista
  if (itemActual?.tipo === "biblia") {
    if (paginaBibliaActual > 0) {
      const nuevaPagina = paginaBibliaActual - 1
      setPaginaBibliaActual(nuevaPagina)
      socket.emit("cambiar-pagina-biblia", nuevaPagina)
      return
    }
  }

  // Canción dentro de la lista
  if (itemActual?.tipo === "cancion" && index > 0) {
    const nuevo = index - 1
    setIndex(nuevo)
    socket.emit("cambiar-parte", nuevo)
    return
  }

  // Imagen, Biblia en página 0, o canción en parte 0
  if (indiceLista > 0) {
  await irAItemLista(indiceLista - 1, true)
  }
}

useEffect(() => {
  siguienteRef.current = siguiente
  anteriorRef.current = anterior
}, [siguiente, anterior])

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

  setLista(prev => [
    ...prev,
    {
      tipo: "cancion",
      id: cancion.id,
      titulo: cancion.titulo
    }
  ])
}

const eliminarDeLista = async (index: number) => {
  const item = lista[index]

  setLista(prev => prev.filter((_, i) => i !== index))

  if (!listaIdActual) return

  const { data: items } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", listaIdActual)
    .order("orden")

  const itemBD = items?.[index]
  if (!itemBD) return

  await supabase
    .from("items_lista")
    .delete()
    .eq("id", itemBD.id)
}

const guardarCulto = async () => {
  const nombre = prompt("Nombre del culto", nombreCulto || "")
  if (!nombre) return

  let listaIdFinal = listaIdActual

  if (listaIdActual) {
    // ACTUALIZAR CULTO EXISTENTE
    const { error: deleteError } = await supabase
      .from("items_lista")
      .delete()
      .eq("lista_id", listaIdActual)

    if (deleteError) {
      console.error("Error borrando items antiguos:", deleteError)
      alert("No se pudieron actualizar los items del culto")
      return
    }

    const inserts = lista.map((item, i) =>
      supabase.from("items_lista").insert({
        lista_id: listaIdActual,
        orden: i,
        cancion_id: item.tipo === "cancion" ? item.id : null,
        tipo: item.tipo,
        imagen_url: item.tipo === "imagen" ? item.url : null,
        referencia_biblica: item.tipo === "biblia" ? item.referencia : null,
        texto_biblico: item.tipo === "biblia" ? item.texto : null
      })
    )

    const resultados = await Promise.all(inserts)
    const errorInsert = resultados.find(r => r.error)

    if (errorInsert?.error) {
      console.error("Error insertando items:", errorInsert.error)
      alert("No se pudieron guardar todos los elementos del culto")
      return
    }

    setNombreCulto(nombre)
    alert("✅ Culto actualizado")
  } else {
    // CREAR CULTO NUEVO
    const iglesiaId = await getIglesiaId()

    const { data, error } = await supabase
      .from("listas_culto")
      .insert({
        nombre,
        iglesia_id: iglesiaId
      })
      .select()
      .single()

    if (error || !data) {
      console.error("Error creando culto:", error)
      alert("No se pudo crear el culto")
      return
    }

    const nuevaId = data.id
    listaIdFinal = nuevaId

    const inserts = lista.map((item, i) =>
      supabase.from("items_lista").insert({
        lista_id: nuevaId,
        orden: i,
        cancion_id: item.tipo === "cancion" ? item.id : null,
        tipo: item.tipo,
        imagen_url: item.tipo === "imagen" ? item.url : null,
        referencia_biblica: item.tipo === "biblia" ? item.referencia : null,
        texto_biblico: item.tipo === "biblia" ? item.texto : null
      })
    )

    const resultados = await Promise.all(inserts)
    const errorInsert = resultados.find(r => r.error)

    if (errorInsert?.error) {
      console.error("Error insertando items:", errorInsert.error)
      alert("El culto se creó, pero falló el guardado de elementos")
      return
    }

    setListaIdActual(nuevaId)
    setNombreCulto(nombre)
    alert("✅ Culto guardado")
  }
  setNombreCulto(nombre)
  await cargarCultos()

  if (listaIdFinal) {
    await cargarListaDesdeBD(listaIdFinal)
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

  const { data: items, error } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", id)
    .order("orden")

  if (error || !items) {
    console.error("Error items:", error)
    return
  }

  const ids = items
    .map(i => i.cancion_id)
    .filter(Boolean)

  let cancionesBD: any[] = []

  if (ids.length > 0) {
    const { data: canciones, error: error2 } = await supabase
      .from("canciones")
      .select("*")
      .in("id", ids)

    if (error2) {
      console.error("Error canciones:", error2)
      return
    }

    cancionesBD = canciones || []
  }

  const listaOrdenada = items.map(item => {
    if (item.tipo === "imagen") {
      return {
        tipo: "imagen",
        url: item.imagen_url,
        titulo: item.imagen_url?.split("/").pop() || "Imagen"
      }
    }

    if (item.tipo === "biblia") {
  const texto = item.texto_biblico || ""
  return {
    tipo: "biblia",
    referencia: item.referencia_biblica,
    texto,
    paginas: partirEnPaginasCliente(texto),
    titulo: `📖 ${item.referencia_biblica || "Palabra"}`
  }
  
}

    const cancion = cancionesBD.find(c => c.id === item.cancion_id)

    return {
      tipo: "cancion",
      id: cancion?.id || item.cancion_id,
      titulo: cancion?.titulo || "⚠️ Sin título"
    }
  })

  setLista(listaOrdenada)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setActivaId(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()
}


const irAItemLista = async (i: number, alFinal = false) => {
  if (!socket) return

  const item = lista[i]
  if (!item) return

  setIndiceLista(i)
  setIndiceActivoLista(i)

  if (item.tipo === "imagen") {
    setActivaId(null)
    setPartes([])
    setIndex(0)
    limpiarModoBiblia()

    socket.emit("mostrar-imagen", {
      url: item.url,
      iglesia: ""
    })
    return
  }

  if (item.tipo === "biblia") {
    setActivaId(null)
    setPartes([])
    setIndex(0)

    const paginas = item.paginas || [item.texto]
    const pagina = alFinal ? Math.max(0, paginas.length - 1) : 0

    setPaginasBiblia(paginas)
    setPaginaBibliaActual(pagina)

    socket.emit("mostrar-biblia", {
      referencia: item.referencia,
      texto: item.texto,
      paginas,
      pagina,
      iglesia: ""
    })
    return
  }

  const { data, error } = await supabase
    .from("partes_cancion")
    .select("*")
    .eq("cancion_id", item.id)
    .order("orden")

  if (error) {
    console.error(error)
    return
  }

  const partesCancion = data || []
  const parteInicial = alFinal ? Math.max(0, partesCancion.length - 1) : 0

  setActivaId(item.id)
  limpiarModoBiblia()
  setPartes(partesCancion)
  setIndex(parteInicial)

  const cancion = canciones.find(c => c.id === item.id)

  socket.emit("cargar-cancion", {
    partes: partesCancion,
    index: parteInicial,
    titulo: cancion?.titulo || item.titulo || "",
    tono: cancion?.tono || "",
    iglesia: ""
  })

  socket.emit("cancion-activa", { id: item.id })
}

const proyectarDesdeLista = async (i: number) => {
  await irAItemLista(i, false)
}

const proyectarDesdeListaAlFinal = async (i: number) => {
  await irAItemLista(i, true)
}

const limpiarModoBiblia = () => {
  setPaginasBiblia([])
  setPaginaBibliaActual(0)
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

const subirImagen = async (file: File) => {
  try {
    const extension = file.name.split(".").pop()
    const baseName = file.name.replace(/\.[^/.]+$/, "")
    const safeBaseName = baseName.replace(/\s+/g, " ").trim()
    const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

    const { error } = await supabase.storage
      .from("imagenes-culto")
      .upload(nombreArchivo, file, {
        cacheControl: "3600",
        upsert: false
      })

    if (error) {
      console.error("Error subiendo imagen:", error)
      alert(`Error subiendo imagen: ${error.message}`)
      return null
    }

    const { data } = supabase.storage
      .from("imagenes-culto")
      .getPublicUrl(nombreArchivo)

    return {
      url: data.publicUrl,
      nombre: safeBaseName || "Imagen"
    }
  } catch (e) {
    console.error(e)
    alert("Falló la subida de imagen")
    return null
  }
}

const buscarVersiculo = async (ref: string) => {
  const res = await fetch(`/api/biblia/buscar?ref=${encodeURIComponent(ref)}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || "No se pudo cargar el versículo")
  }

  return data
}

const proyectarBiblia = async (ref: string) => {
  if (!socket) return

  try {
    const data = await buscarVersiculo(ref)

    setActivaId(null)
    setIndiceLista(null)
    setIndiceActivoLista(null)
    setPartes([])
    setIndex(0)

    setPaginasBiblia(data.paginas || [data.texto])
    setPaginaBibliaActual(0)

    socket.emit("mostrar-biblia", {
    referencia: data.referencia,
    texto: data.texto,
    paginas: data.paginas || [data.texto],
    pagina: 0,
    iglesia: nombreIglesia || ""
  })
  } catch (error: any) {
    alert(error.message || "No se pudo cargar el versículo")
  }
}

const agregarBibliaALista = async (ref: string) => {
  if (!ref.trim()) return

  try {
    const data = await buscarVersiculo(ref)

    setLista(prev => [
      ...prev,
      {
        tipo: "biblia",
        referencia: data.referencia,
        texto: data.texto,
        paginas: data.paginas || [data.texto],
        titulo: `📖 ${data.referencia}`
      }
    ])
  } catch (error: any) {
    alert(error.message || "No se pudo agregar la cita")
  }
}

const sugerenciasBiblia = [
  "Génesis 1",
  "Éxodo 20",
  "Josué 1",
  "Salmos 1",
  "Salmos 23",
  "Salmos 91",
  "Proverbios 3",
  "Isaías 53",
  "Jeremías 29:11",
  "Mateo 5",
  "Mateo 6",
  "Juan 1",
  "Juan 3:16",
  "Juan 14",
  "Hechos 2",
  "Romanos 8",
  "1 Corintios 13",
  "2 Corintios 5:17",
  "Gálatas 5",
  "Efesios 6",
  "Filipenses 4:13",
  "Hebreos 11",
  "Santiago 1",
  "1 Pedro 1",
  "Apocalipsis 21"
]


const container: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
  color: "white",
  padding: isMobile ? "12px" : "18px",
  display: "flex",
  flexDirection: "column",
  gap: "14px"
}

const topbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "12px"
}

const controles: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "14px"
}

const seccion: CSSProperties = {
  background: "rgba(30, 41, 59, 0.96)",
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.22)"
}

const titulo: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  marginBottom: "12px"
}

const subtitulo: CSSProperties = {
  fontSize: "14px",
  opacity: 0.75,
  marginBottom: "10px"
}

const card: CSSProperties = {
  background: "#243449",
  padding: "12px",
  borderRadius: "12px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px"
}

const acciones: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap"
}

const btn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700
}

const btnSecundario: CSSProperties = {
  ...btn,
  background: "#334155"
}

const btnVerde: CSSProperties = {
  ...btn,
  background: "#16a34a"
}

const btnRojo: CSSProperties = {
  ...btn,
  background: "#dc2626"
}

const btnGrande: CSSProperties = {
  padding: isMobile ? "10px 12px" : "12px 16px",
  fontSize: isMobile ? "16px" : "18px",
  borderRadius: "12px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minWidth: isMobile ? "52px" : "64px"
}

const input: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  marginBottom: "10px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0f172a",
  color: "white",
  outline: "none",
  fontSize: "15px"
}

const fila: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  alignItems: "center"
}

const gridDesktop: CSSProperties = {
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
  gap: "16px",
  alignItems: "start"
}

const columna: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px"
}

return (
  <div style={container}>
    <div style={topbar}>
      <div>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Control de Culto</h1>
        {nombreCulto && (
          <div style={{ marginTop: "6px", opacity: 0.85, fontSize: "15px" }}>
            Culto actual: <strong>{nombreCulto}</strong>
          </div>
        )}
      </div>
    </div>

    <div style={controles}>
      <button disabled={!socket} style={btnGrande} onClick={anterior}>⬅️</button>
      <button disabled={!socket} style={btnGrande} onClick={siguiente}>➡️</button>
      <button
        disabled={!socket}
        style={btnGrande}
        onClick={() => setAutoPlay(a => !a)}
      >
        {autoPlay ? "⏹️" : "▶️"}
      </button>
      <button
        disabled={!socket}
        style={{
          ...btnGrande,
          background: loopCoro ? "#16a34a" : "#2563eb"
        }}
        onClick={() => setLoopCoro(l => !l)}
      >
        🔁
      </button>
    </div>

    <div style={gridDesktop}>
      <div style={columna}>
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
                  background: c.id === activaId ? "#16a34a" : "#243449"
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{c.titulo}</strong>
                  <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
                    {c.autor || ""} {c.tono ? `• ${nombreTono(c.tono)}` : ""}
                  </div>
                </div>

                <div style={acciones}>
                  <button disabled={!socket} style={btn} onClick={() => proyectar(c.id)}>
                    ▶️
                  </button>
                  <button disabled={!socket} style={btnSecundario} onClick={() => agregarALista(c)}>
                    ➕
                  </button>
                </div>
              </div>
            ))}
        </div>

        <div style={seccion}>
          <h2 style={titulo}>🛠️ Acciones</h2>

          <div style={fila}>
            <button disabled={!socket} style={btn} onClick={guardarCulto}>
              💾 Guardar Culto
            </button>

            <button
              disabled={!socket}
              style={btnVerde}
              onClick={() => {
                const ok = confirm("¿Crear nuevo culto? Se perderá la lista actual")
                if (!ok) return

                setLista([])
                setListaIdActual(null)
                setNombreCulto("")
                setActivaId(null)
                setIndiceLista(null)
                setIndiceActivoLista(null)
                setPartes([])
                setIndex(0)
                limpiarModoBiblia()
              }}
            >
              🆕 Nuevo
            </button>

            <label
              style={{
                ...btnSecundario,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              🖼️ Subir imagen
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                const inputFile = e.target as HTMLInputElement
                const file = inputFile.files?.[0]
                if (!file) return

                const resultado = await subirImagen(file)

                if (resultado?.url) {
                  setLista(prev => [
                    ...prev,
                    {
                      tipo: "imagen",
                      url: resultado.url,
                      titulo: resultado.nombre
                    }
                  ])
                }

                inputFile.value = ""
              }}
              />
            </label>
          </div>
        </div>

        <div style={seccion}>
  <h2 style={titulo}>📖 Palabra</h2>
  <div style={subtitulo}>
    Ejemplos: Juan 3:16, 1 Corintios 13:4-7, Salmo 23
  </div>

  <div style={{ position: "relative" }}>
    <input
      list="libros-biblia"
      placeholder="Escribe una cita bíblica..."
      value={inputBiblia}
      onChange={(e) => setInputBiblia(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") {
          if (!inputBiblia.trim()) return
          await proyectarBiblia(inputBiblia)
          setInputBiblia("")
        }
      }}
      style={input}
    />

    <datalist id="libros-biblia">
  {sugerenciasBiblia.map((item) => (
    <option key={item} value={item} />
  ))}
</datalist>
  </div>

  <div style={fila}>
    <button
      disabled={!socket}
      style={btn}
      onClick={async () => {
        if (!inputBiblia.trim()) return
        await proyectarBiblia(inputBiblia)
        setInputBiblia("")
      }}
    >
      Proyectar
    </button>

    <button
      disabled={!socket}
      style={btnSecundario}
      onClick={async () => {
        if (!inputBiblia.trim()) return
        await agregarBibliaALista(inputBiblia)
        setInputBiblia("")
      }}
    >
      ➕ Agregar a lista
    </button>
  </div>
</div>

        <div style={seccion}>
          <h2 style={titulo}>💾 Cultos Guardados</h2>

          {cultos.map((c) => (
            <div key={c.id} style={card}>
              <span>{c.nombre}</span>

              <div style={acciones}>
                <button disabled={!socket} style={btn} onClick={() => cargarListaDesdeBD(c.id)}>
                  📂
                </button>

                <button
                  disabled={!socket}
                  style={btnRojo}
                  onClick={async () => {
                    const ok = confirm("¿Eliminar este culto completo?")
                    if (!ok) return

                    await supabase
                      .from("items_lista")
                      .delete()
                      .eq("lista_id", c.id)

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
      </div>

      <div style={columna}>
        <div style={seccion}>
          <h2 style={titulo}>📋 Lista de Culto {nombreCulto && `- ${nombreCulto}`}</h2>

          {lista.length === 0 && (
            <p style={{ opacity: 0.65 }}>No hay canciones o imágenes aún</p>
          )}

          {lista.map((c, i) => (
        <div
          key={i}
          style={{
            ...card,
            background: i === indiceActivoLista ? "#16a34a" : "#243449"
          }}
        >
          <div style={{ flex: 1, overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              title={c?.titulo || "Sin título"}
            >
              {i + 1}. {c?.titulo || "Sin título"}
            </span>
          </div>

          <div style={acciones}>
            <button style={btn} disabled={!socket} onClick={() => proyectarDesdeLista(i)}>
              ▶️
            </button>

            <button
              disabled={!socket}
              style={btnRojo}
              onClick={() => {
                const ok = confirm("¿Eliminar este elemento de la lista?")
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
    </div>
  </div>
)
}

