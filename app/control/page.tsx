

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
  const [filtroCategoria, setFiltroCategoria] = useState("")
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
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [mensajeRapido, setMensajeRapido] = useState("Oremos")
  const [logoEsperaUrl, setLogoEsperaUrl] = useState("")
  const [logoEsperaNombre, setLogoEsperaNombre] = useState("")
  const [menuItemAbierto, setMenuItemAbierto] = useState<number | null>(null)
  const [menuCultoAbierto, setMenuCultoAbierto] = useState<string | null>(null)
  const [mensajeFlash, setMensajeFlash] = useState("")
  const [flashListaCulto, setFlashListaCulto] = useState(false)
  const [idsCancionesConAcordes, setIdsCancionesConAcordes] = useState<string[]>([])

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
  if (listaIdActual) {
    cargarLista()
  }
}, [listaIdActual])

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
  cargarCultos()
  cargarNombreIglesia()
}, [])

useEffect(() => {
  setIsMobile(window.innerWidth < 768)
}, [])

useEffect(() => {
  if (!socket || lista.length === 0) return
  enviarPrecargaImagenes(lista)
}, [socket, lista])


const [isMobile, setIsMobile] = useState(true)
const [mostrarCanciones, setMostrarCanciones] = useState(true)
const [mostrarAcciones, setMostrarAcciones] = useState(false)
const [mostrarPalabra, setMostrarPalabra] = useState(false)
const [mostrarCultos, setMostrarCultos] = useState(false)
const cargarLista = async () => {
  if (!listaIdActual) return
  await cargarListaDesdeBD(listaIdActual)
}

const cargarCanciones = async () => {
  const { data, error } = await supabase
    .from("canciones")
    .select("*")

  console.log("DATA:", data)
  console.log("ERROR:", error)

  if (data) setCanciones(data)

  const { data: partesConAcordes, error: errorAcordes } = await supabase
    .from("partes_cancion")
    .select("cancion_id")
    .eq("tiene_acordes", true)

  if (errorAcordes) {
    console.error("Error cargando canciones con acordes:", errorAcordes)
    setIdsCancionesConAcordes([])
    return
  }

  const idsUnicos = Array.from(
    new Set((partesConAcordes || []).map((p: any) => p.cancion_id).filter(Boolean))
  )

  setIdsCancionesConAcordes(idsUnicos)
}



const cargarNombreIglesia = async () => {
  const iglesiaId = await getIglesiaId()
  if (!iglesiaId) return

  const { data, error } = await supabase
    .from("iglesias")
    .select("nombre, logo_url, logo_nombre")
    .eq("id", iglesiaId)
    .single()

  if (error) {
    console.error("Error cargando iglesia:", error)
    return
  }

  setNombreIglesia(data?.nombre || "")
  setLogoEsperaUrl(data?.logo_url || "")
  setLogoEsperaNombre(data?.logo_nombre || "")
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
    mostrarFeedbackLista("⚠️ Esa canción ya está en la lista")
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

  mostrarFeedbackLista(`✅ Agregada: ${cancion.titulo}`)
}

const mostrarFeedbackLista = (mensaje: string) => {
  setMensajeFlash(mensaje)
  setFlashListaCulto(true)

  setTimeout(() => {
    setFlashListaCulto(false)
  }, 900)

  setTimeout(() => {
    setMensajeFlash("")
  }, 1600)
}

const moverItemLista = (from: number, to: number) => {
  if (from === to || from < 0 || to < 0) return

  setLista(prev => {
    const nueva = [...prev]
    const [movido] = nueva.splice(from, 1)
    nueva.splice(to, 0, movido)
    return nueva
  })

  setIndiceActivoLista(prev => {
    if (prev === null) return prev
    if (prev === from) return to

    if (from < to && prev > from && prev <= to) return prev - 1
    if (from > to && prev >= to && prev < from) return prev + 1

    return prev
  })

  setIndiceLista(prev => {
    if (prev === null) return prev
    if (prev === from) return to

    if (from < to && prev > from && prev <= to) return prev - 1
    if (from > to && prev >= to && prev < from) return prev + 1

    return prev
  })
}

const subirItemLista = (i: number) => {
  if (i <= 0) return
  setMenuItemAbierto(null)
  moverItemLista(i, i - 1)
}

const bajarItemLista = (i: number) => {
  if (i >= lista.length - 1) return
  setMenuItemAbierto(null)
  moverItemLista(i, i + 1)
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
        texto_biblico: item.tipo === "biblia" ? item.texto : null,
        estado_modo: item.tipo === "estado" ? item.modo : null,
        estado_titulo: item.tipo === "estado" ? item.titulo : null,
        estado_subtitulo: item.tipo === "estado" ? item.subtitulo : null,
        estado_url: item.tipo === "estado" ? item.url : null
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
        texto_biblico: item.tipo === "biblia" ? item.texto : null,
        estado_modo: item.tipo === "estado" ? item.modo : null,
        estado_titulo: item.tipo === "estado" ? item.titulo : null,
        estado_subtitulo: item.tipo === "estado" ? item.subtitulo : null,
        estado_url: item.tipo === "estado" ? item.url : null
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

const guardarCultoComoCopia = async () => {
  const nombreBase = nombreCulto?.trim() || "Culto"
  const nombre = prompt("Nombre de la copia", `${nombreBase} (copia)`)
  if (!nombre) return

  const iglesiaId = await getIglesiaId()

  const { data, error } = await supabase
    .from("listas_culto")
    .insert({
      nombre: nombre.trim(),
      iglesia_id: iglesiaId
    })
    .select()
    .single()

  if (error || !data) {
    console.error("Error creando copia:", error)
    alert("No se pudo crear la copia")
    return
  }

  const nuevaId = data.id

  const inserts = lista.map((item, i) =>
    supabase.from("items_lista").insert({
      lista_id: nuevaId,
      orden: i,
      cancion_id: item.tipo === "cancion" ? item.id : null,
      tipo: item.tipo,
      imagen_url: item.tipo === "imagen" ? item.url : null,
      referencia_biblica: item.tipo === "biblia" ? item.referencia : null,
      texto_biblico: item.tipo === "biblia" ? item.texto : null,
      estado_modo: item.tipo === "estado" ? item.modo : null,
      estado_titulo: item.tipo === "estado" ? item.titulo : null,
      estado_subtitulo: item.tipo === "estado" ? item.subtitulo : null,
      estado_url: item.tipo === "estado" ? item.url : null
    })
  )

  const resultados = await Promise.all(inserts)
  const errorInsert = resultados.find(r => r.error)

  if (errorInsert?.error) {
    console.error("Error copiando items:", errorInsert.error)
    alert("La copia se creó, pero falló el guardado de elementos")
    return
  }

  setListaIdActual(nuevaId)
  setNombreCulto(nombre.trim())
  await cargarCultos()
  alert("✅ Copia creada")
}

const renombrarCulto = async (culto: any) => {
  const nuevoNombre = prompt("Nuevo nombre del culto", culto.nombre || "")
  if (!nuevoNombre || !nuevoNombre.trim()) return

  const { error } = await supabase
    .from("listas_culto")
    .update({ nombre: nuevoNombre.trim() })
    .eq("id", culto.id)

  if (error) {
    console.error("Error renombrando culto:", error)
    alert("No se pudo renombrar el culto")
    return
  }

  if (listaIdActual === culto.id) {
    setNombreCulto(nuevoNombre.trim())
  }

  await cargarCultos()
  alert("✅ Culto renombrado")
}

const duplicarCulto = async (culto: any) => {
  const nuevoNombre = prompt(
    "Nombre para la copia",
    `${culto.nombre || "Culto"} (copia)`
  )
  if (!nuevoNombre || !nuevoNombre.trim()) return

  const iglesiaId = await getIglesiaId()

  const { data: nuevoCulto, error: errorCulto } = await supabase
    .from("listas_culto")
    .insert({
      nombre: nuevoNombre.trim(),
      iglesia_id: iglesiaId
    })
    .select()
    .single()

  if (errorCulto || !nuevoCulto) {
    console.error("Error duplicando culto:", errorCulto)
    alert("No se pudo crear la copia del culto")
    return
  }

  const { data: items, error: errorItems } = await supabase
    .from("items_lista")
    .select("*")
    .eq("lista_id", culto.id)
    .order("orden")

  if (errorItems) {
    console.error("Error leyendo items del culto:", errorItems)
    alert("La copia del culto se creó, pero no se pudieron leer los items")
    return
  }

  if (items && items.length > 0) {
    const inserts = items.map((item) => ({
      lista_id: nuevoCulto.id,
      orden: item.orden,
      cancion_id: item.cancion_id,
      tipo: item.tipo,
      imagen_url: item.imagen_url,
      referencia_biblica: item.referencia_biblica,
      texto_biblico: item.texto_biblico,
      estado_modo: item.estado_modo,
      estado_titulo: item.estado_titulo,
      estado_subtitulo: item.estado_subtitulo,
      estado_url: item.estado_url
    }))

    const { error: errorInsert } = await supabase
      .from("items_lista")
      .insert(inserts)

    if (errorInsert) {
      console.error("Error copiando items:", errorInsert)
      alert("El culto se duplicó, pero falló la copia de elementos")
      return
    }
  }

  await cargarCultos()
  alert("✅ Culto duplicado")
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

const nombreImagenAmigable = (url?: string, fallback = "Imagen") => {
  if (!url) return fallback

  const ultimo = url.split("/").pop() || fallback
  const sinExtension = ultimo.replace(/\.[^/.]+$/, "")
  const sinPrefijo = sinExtension.replace(/^\d+-[a-z0-9]+-/i, "")
  const limpio = sinPrefijo
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return limpio || fallback
}

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
        titulo: nombreImagenAmigable(item.imagen_url, "Imagen")
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
    if (item.tipo === "estado") {
      return {
        tipo: "estado",
        modo: item.estado_modo,
        titulo: item.estado_titulo || "Estado",
        subtitulo: item.estado_subtitulo || "",
        url: item.estado_url || ""
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

  if (item.tipo === "estado") {
  setActivaId(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()

  socket.emit("mostrar-estado", {
    tipo: item.modo,
    titulo: item.titulo || "",
    subtitulo: item.subtitulo || "",
    url: item.url || ""
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
  setMenuItemAbierto(null)
  await irAItemLista(i, false)
}

const optimizarImagen = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = () => {
      img.src = reader.result as string
    }

    reader.onerror = reject

    img.onload = () => {
      const maxWidth = 1920
      const maxHeight = 1080

      let { width, height } = img

      const scale = Math.min(
        1,
        maxWidth / width,
        maxHeight / height
      )

      const newWidth = Math.round(width * scale)
      const newHeight = Math.round(height * scale)

      const canvas = document.createElement("canvas")
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("No se pudo crear canvas"))
        return
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo optimizar la imagen"))
            return
          }

          const nombreBase = file.name.replace(/\.[^/.]+$/, "")
          const optimizedFile = new File(
            [blob],
            `${nombreBase}.webp`,
            { type: "image/webp" }
          )

          resolve(optimizedFile)
        },
        "image/webp",
        0.82
      )
    }

    img.onerror = reject
    reader.readAsDataURL(file)
  })
}

const limpiarModoBiblia = () => {
  setPaginasBiblia([])
  setPaginaBibliaActual(0)
}

const categoriasDisponibles = Array.from(
  new Set(
    canciones
      .map(c => c.categoria)
      .filter(Boolean)
  )
).sort()

const nombreTono = (tono?: string) => {
  if (!tono) return ""
  return tono
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
    const archivoOptimizado = await optimizarImagen(file)

    const extension = "webp"
    const baseName = file.name.replace(/\.[^/.]+$/, "")
    const safeBaseName = baseName.replace(/\s+/g, " ").trim()
    const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

    const { error } = await supabase.storage
      .from("imagenes-culto")
      .upload(nombreArchivo, archivoOptimizado, {
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

const enviarPrecargaImagenes = (items: any[]) => {
  if (!socket) return

  const urls = items
    .filter((item) => item?.tipo === "imagen" && item?.url)
    .map((item) => item.url)

  if (urls.length > 0) {
    socket.emit("precargar-imagenes", urls)
  }
}

const subirLogoEspera = async (file: File) => {
  const resultado = await subirImagen(file)
  if (!resultado?.url) return

  const iglesiaId = await getIglesiaId()
  if (!iglesiaId) {
    alert("No se encontró la iglesia actual")
    return
  }

  const { error } = await supabase
    .from("iglesias")
    .update({
      logo_url: resultado.url,
      logo_nombre: resultado.nombre || "Logo"
    })
    .eq("id", iglesiaId)

  if (error) {
    console.error("Error guardando logo en iglesia:", error)
    alert("El logo se subió, pero no se pudo guardar en la iglesia")
    return
  }

  setLogoEsperaUrl(resultado.url)
  setLogoEsperaNombre(resultado.nombre || "Logo")
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

const proyectarMensajeRapido = () => {
  if (!socket) return

  setActivaId(null)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()

  socket.emit("mostrar-estado", {
    tipo: "mensaje",
    titulo: mensajeRapido || "Espere un momento",
    subtitulo: nombreIglesia || ""
  })
}

const proyectarPantallaLogo = () => {
  if (!socket) return
  if (!logoEsperaUrl.trim()) {
    alert("Primero ingresa la URL del logo o imagen")
    return
  }

  setActivaId(null)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()

  socket.emit("mostrar-estado", {
    tipo: "logo",
    url: logoEsperaUrl.trim(),
    titulo: nombreIglesia || "",
    subtitulo: "Espere un momento"
  })
}

const proyectarPantallaNegra = () => {
  if (!socket) return

  setActivaId(null)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()

  socket.emit("mostrar-estado", {
    tipo: "negro"
  })
}

const proyectarPantallaEspera = () => {
  if (!socket) return

  setActivaId(null)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()

  socket.emit("mostrar-estado", {
    tipo: "espera",
    titulo: "Espere un momento",
    subtitulo: nombreIglesia || ""
  })
}

const agregarNegroALista = () => {
  setLista(prev => [
    ...prev,
    {
      tipo: "estado",
      modo: "negro",
      titulo: "Pantalla negra"
    }
  ])
}

const agregarEsperaALista = () => {
  setLista(prev => [
    ...prev,
    {
      tipo: "estado",
      modo: "espera",
      titulo: "Pantalla de espera",
      subtitulo: nombreIglesia || ""
    }
  ])
}

const agregarMensajeALista = () => {
  setLista(prev => [
    ...prev,
    {
      tipo: "estado",
      modo: "mensaje",
      titulo: mensajeRapido || "Mensaje rápido",
      subtitulo: nombreIglesia || ""
    }
  ])
}

const agregarLogoALista = () => {
  if (!logoEsperaUrl.trim()) {
    alert("Primero carga un logo")
    return
  }

  setLista(prev => [
    ...prev,
    {
      tipo: "estado",
      modo: "logo",
      titulo: logoEsperaNombre || "Logo de espera",
      subtitulo: nombreIglesia || "",
      url: logoEsperaUrl,
      nombre: logoEsperaNombre || "Logo"
    }
  ])
}

const limpiarTituloLista = (titulo?: string) => {
  return (titulo || "")
    .replace(/^(🎵|📖|🖼️|⚫|⏳|✍️|✨)\s*/u, "")
    .trim()
}

const resumirTexto = (texto?: string, max = 45) => {
  const limpio = (texto || "").trim()
  if (limpio.length <= max) return limpio
  return limpio.slice(0, max).trimEnd() + "..."
}

const subtituloItemLista = (item: any) => {
  if (item?.tipo === "cancion") return "Canción"
  if (item?.tipo === "biblia") return "Palabra"
  if (item?.tipo === "imagen") return "Imagen"

  if (item?.tipo === "estado") {
    if (item.modo === "mensaje") return "Mensaje"
    if (item.modo === "espera") return "Espera"
    if (item.modo === "negro") return "Pantalla negra"
    if (item.modo === "logo") return "Logo"
    return "Estado"
  }

  return ""
}

const iconoItemLista = (item: any) => {
  if (item?.tipo === "cancion") return "🎵"
  if (item?.tipo === "biblia") return "📖"
  if (item?.tipo === "imagen") return "🖼️"

  if (item?.tipo === "estado") {
    if (item.modo === "negro") return "⚫"
    if (item.modo === "espera") return "⏳"
    if (item.modo === "mensaje") return "✍️"
    if (item.modo === "logo") return "🖼️"
    return "✨"
  }

  return "•"
}

const tituloCancionVisible = (c: any) => {
  const numero = c?.numero ? `${c.numero}. ` : ""
  return `${numero}${c?.titulo || "Sin título"}`
}

const subtituloCancionVisible = (c: any) => {
  const partes: string[] = []

  if (c?.categoria) partes.push(c.categoria)
  if (c?.tono) partes.push(nombreTono(c.tono))
  if (idsCancionesConAcordes.includes(c?.id)) partes.push("Con acordes")

  return partes.join(" • ")
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


function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const container: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
  color: "white",
  padding: isMobile ? "10px" : "18px",
  paddingTop: isMobile ? "10px" : "18px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  boxSizing: "border-box"
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
  gap: "10px",
  flexWrap: "nowrap",
  background: "rgba(15, 23, 42, 0.97)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: isMobile ? "8px 10px" : "14px",
  position: "sticky",
  top: isMobile ? "8px" : "12px",
  zIndex: 80,
  backdropFilter: "blur(8px)",
  boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
  alignSelf: "stretch"
}

const seccion: CSSProperties = {
  background: "rgba(30, 41, 59, 0.96)",
  padding: isMobile ? "12px" : "16px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.22)"
}

const titulo: CSSProperties = {
  fontSize: isMobile ? "18px" : "22px",
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
  padding: isMobile ? "8px 10px" : "12px",
  borderRadius: "12px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: isMobile ? "flex-start" : "center",
  gap: "10px"
}

const acciones: CSSProperties = isMobile
  ? {
      display: "grid",
      gridTemplateColumns: "repeat(2, 42px)",
      gap: "6px",
      flexShrink: 0
    }
  : {
      display: "flex",
      gap: "8px",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      flexShrink: 0
    }

const btn: CSSProperties = {
  padding: isMobile ? "8px 10px" : "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700
}

const btnSecundario: CSSProperties = {
  ...btn,
  background: "#334155",
  padding: isMobile ? "8px 10px" : "10px 14px"
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
  padding: isMobile ? "8px 12px" : "12px 16px",
  fontSize: isMobile ? "16px" : "18px",
  borderRadius: "12px",
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minWidth: isMobile ? "56px" : "64px"
}

const input: CSSProperties = {
  width: "100%",
  padding: isMobile ? "10px 12px" : "12px 14px",
  marginBottom: "10px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0f172a",
  color: "white",
  outline: "none",
  fontSize: isMobile ? "14px" : "15px"
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
  gap: isMobile ? "16px" : "28px",
  alignItems: "start",
  width: "100%",
  boxSizing: "border-box"
}

const columna: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px"
}

const columnaLista: CSSProperties = {
 display: "flex",
  flexDirection: "column",
  gap: "16px",
  height: "100%",
  minHeight: 0
}



const btnListaMini: CSSProperties = {
  width: "42px",
  height: "42px",
  padding: 0,
  borderRadius: "10px",
  border: "none",
  background: "#334155",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}
const btnListaPlay: CSSProperties = {
  ...btnListaMini,
  background: "#2563eb"
}
const btnListaDelete: CSSProperties = {
  ...btnListaMini,
  background: "#dc2626"
}

const btnListaMenu: CSSProperties = {
  ...btnListaMini,
  background: "#475569"
}

const textoCardPrincipal: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  alignSelf: "stretch"
}

const tituloCardResponsive = (isMobile: boolean): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: isMobile ? 2 : 1,
  WebkitBoxOrient: "vertical" as any,
  fontWeight: 700,
  minWidth: 0,
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  wordBreak: "break-word"
})

const subtituloCardResponsive = (isMobile: boolean): CSSProperties => ({
  fontSize: isMobile ? "11px" : "12px",
  opacity: 0.68,
  marginTop: "4px",
  whiteSpace: isMobile ? "normal" : "nowrap",
  overflow: "hidden",
  textOverflow: isMobile ? "clip" : "ellipsis",
  wordBreak: "break-word",
  lineHeight: 1.2
})

return (
<>
      
<style>{`
#scroll-canciones::-webkit-scrollbar {
  width: 10px;
}

#scroll-canciones::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 999px;
}

#scroll-canciones::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
  border-radius: 999px;
}

#scroll-canciones::-webkit-scrollbar-thumb:hover {
  background: #60a5fa;
}
`}</style>

<style>{`
#scroll-lista::-webkit-scrollbar {
  width: 10px;
}

#scroll-lista::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 999px;
}

#scroll-lista::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
  border-radius: 999px;
}

#scroll-lista::-webkit-scrollbar-thumb:hover {
  background: #60a5fa;
}

`}</style>

  <div style={container}>
    <div style={topbar}>
      <div>
        {!isMobile && (
          <h1 style={{ margin: 0, fontSize: "28px" }}>Control de Culto</h1>
        )}

        {nombreCulto && !isMobile && (
          <div
            style={{
              marginTop: "6px",
              opacity: 0.9,
              fontSize: "15px"
            }}
          >
            Culto actual: <strong>{nombreCulto}</strong>
          </div>
        )}
      </div>
    </div>
        {listaIdActual && (
          <div
            style={{
              background: "rgba(37, 99, 235, 0.15)",
              border: "1px solid rgba(37, 99, 235, 0.35)",
              borderRadius: "14px",
              padding: isMobile ? "10px" : "12px 14px",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center",
              justifyContent: "space-between",
              gap: "10px"
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                ✏️ Editando culto guardado
              </div>

              <div
                style={{
                  fontSize: "13px",
                  opacity: 0.8,
                  marginTop: "3px",
                  wordBreak: "break-word"
                }}
              >
                {nombreCulto || "Sin nombre"}
              </div>
            </div>

            <div style={{ ...fila, justifyContent: "flex-end" }}>
              <button style={btn} onClick={guardarCulto}>
                💾 Guardar cambios
              </button>

              <button style={btnSecundario} onClick={guardarCultoComoCopia}>
                📄 Guardar como copia
              </button>

              <button
                style={btnRojo}
                onClick={() => {
                  const ok = confirm("¿Salir del modo edición? Los cambios no guardados se perderán.")
                  if (!ok) return

                  setListaIdActual(null)
                  setNombreCulto("")
                  setLista([])
                  setActivaId(null)
                  setIndiceLista(null)
                  setIndiceActivoLista(null)
                  setPartes([])
                  setIndex(0)
                  limpiarModoBiblia()
                }}
              >
                ❌ Salir
              </button>
            </div>
          </div>
        )}
    <div style={controles}>
      <button disabled={!socket} style={btnGrande} onClick={anterior}>⬅️</button>
      <button disabled={!socket} style={btnGrande} onClick={siguiente}>➡️</button>
      {/* <button 
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
      </button>*/}
    </div>

    <div style={gridDesktop}>
  {isMobile ? (
  <div style={columna}>
    <div id="scroll-lista" style={seccion}>
      <h2
        style={{
          ...titulo,
          lineHeight: 1.2,
          whiteSpace: "normal",
          marginBottom: "12px"
        }}
        title={nombreCulto || ""}
      >
        📋 Lista de Culto
        {nombreCulto && (
          <span style={{ opacity: 0.9 }}>
            {" "} - {resumirTexto(nombreCulto, 28)}
          </span>
        )}
      </h2>
      {mensajeFlash && (
        <div
          style={{
            marginBottom: "10px",
            padding: "8px 10px",
            borderRadius: "10px",
            background: "rgba(34,197,94,0.14)",
            border: "1px solid rgba(34,197,94,0.30)",
            fontSize: isMobile ? "12px" : "13px",
            opacity: 0.95
          }}
        >
          {mensajeFlash}
        </div>
      )}

      {lista.length === 0 && (
        <p style={{ opacity: 0.65, margin: 0 }}>
          Aún no hay elementos en la lista. Puedes agregar canciones, palabra, imágenes o estados.
        </p>
      )}

      {lista.map((c, i) => (
        <div
          key={i}
          style={{
            ...card,
            background: i === indiceActivoLista ? "rgba(22, 163, 74, 0.92)" : "#243449",
            border:
              i === indiceActivoLista
                ? "1px solid rgba(255,255,255,0.18)"
                : "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div style={textoCardPrincipal}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: 0
              }}
            >
              <span style={{ opacity: 0.8, flexShrink: 0 }}>
                {i + 1}.
              </span>

              <span style={{ flexShrink: 0 }}>
                {iconoItemLista(c)}
              </span>

              <span
                style={tituloCardResponsive(isMobile)}
                title={limpiarTituloLista(c?.titulo || "Sin título")}
              >
                {limpiarTituloLista(c?.titulo || "Sin título")}
              </span>
            </div>

            {(c?.tipo === "estado" || c?.tipo === "biblia") && (
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.68,
                  marginTop: "2px",
                  marginLeft: "30px"
                }}
              >
                {subtituloItemLista(c)}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "6px",
              flexShrink: 0
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                style={btnListaPlay}
                disabled={!socket}
                onClick={() => proyectarDesdeLista(i)}
              >
                ▶️
              </button>

              <button
                style={btnListaMenu}
                onClick={() =>
                  setMenuItemAbierto(prev => (prev === i ? null : i))
                }
              >
                ⋮
              </button>
            </div>

            {menuItemAbierto === i && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 42px)",
                  gap: "6px"
                }}
              >
                <button
                  style={btnListaMini}
                  onClick={() => subirItemLista(i)}
                  disabled={i === 0}
                >
                  ⬆️
                </button>

                <button
                  style={btnListaMini}
                  onClick={() => bajarItemLista(i)}
                  disabled={i === lista.length - 1}
                >
                  ⬇️
                </button>

                <button
                  disabled={!socket}
                  style={btnListaDelete}
                  onClick={() => {
                    const ok = confirm("¿Eliminar este elemento de la lista?")
                    if (ok) {
                      eliminarDeLista(i)
                      setMenuItemAbierto(null)
                    }
                  }}
                >
                  ❌
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>

    <div
      style={{
        ...seccion,
        boxShadow: flashListaCulto
          ? "0 0 0 2px rgba(34,197,94,0.55), 0 10px 25px rgba(0,0,0,0.22)"
          : seccion.boxShadow
      }}
    >
      <div
        onClick={() => setMostrarCanciones(v => !v)}
        style={{
          ...titulo,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: "12px"
        }}
      >
        <span>🎵 Canciones</span>
        <span>{mostrarCanciones ? "▾" : "▸"}</span>
      </div>

      {mostrarCanciones && (
        <>
          <input
            placeholder="Buscar por número, título o categoría..."
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
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={input}
          >
            <option value="">Todas las categorías</option>
            {categoriasDisponibles.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          
 <div
  id={!isMobile ? "scroll-canciones" : undefined}
  style={
    isMobile
      ? {
          marginTop: "6px",
          paddingRight: "0px"
        }
      : {
          height: "620px",
          maxHeight: "620px",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          paddingRight: "6px",
          marginTop: "6px",
          boxSizing: "border-box",
          overscrollBehavior: "contain"
        }
  }
>
    {canciones
      .filter((c) => {
        const q = normalizar(busqueda || "").trim()
        if (!q) return true

        const titulo = normalizar(c.titulo || "")
        const categoria = normalizar(c.categoria || "")
        const tono = normalizar(c.tono || "")
        const numero = String(c.numero || "")

        return (
          titulo.includes(q) ||
          categoria.includes(q) ||
          tono.includes(q) ||
          numero.includes(q)
        )
      })
      .filter(c => !filtroTono || c.tono === filtroTono)
      .filter(c => !filtroCategoria || c.categoria === filtroCategoria)
      .sort((a, b) => {
        const na = a.numero ?? 999999
        const nb = b.numero ?? 999999
        if (na !== nb) return na - nb
        return (a.titulo || "").localeCompare(b.titulo || "")
      })
      .map((c) => (
        <div
          key={c.id}
          style={{
            ...card,
            background: c.id === activaId ? "#16a34a" : "#243449"
          }}
        >
          <div style={textoCardPrincipal}>
            <span
              style={tituloCardResponsive(isMobile)}
              title={tituloCancionVisible(c)}
            >
              {tituloCancionVisible(c)}
            </span>

            <div style={subtituloCardResponsive(isMobile)}>
              {subtituloCancionVisible(c)}
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

        </>
      )}
    </div>

    <div style={seccion}>
      <div
        onClick={() => setMostrarAcciones(v => !v)}
        style={{
          ...titulo,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: "12px"
        }}
      >
        <span>🛠️ Acciones</span>
        <span>{mostrarAcciones ? "▾" : "▸"}</span>
      </div>

      {mostrarAcciones && (
        <>
          <div style={{ ...fila, marginBottom: 16 }}>
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
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={subtitulo}>Mensaje rápido</div>

            <input
              value={mensajeRapido}
              onChange={(e) => setMensajeRapido(e.target.value)}
              placeholder="Ej: Oremos, Bienvenidos, Santa Cena"
              style={input}
            />

            <div style={fila}>
              <button
                disabled={!socket}
                style={btnSecundario}
                onClick={proyectarMensajeRapido}
              >
                ✍️ Proyectar mensaje
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={subtitulo}>Fondo con logo / imagen</div>

            <div style={{ ...fila, marginBottom: logoEsperaUrl ? 12 : 0 }}>
              <label
                style={{
                  ...btnSecundario,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer"
                }}
              >
                🖼️ Subir logo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const inputFile = e.target as HTMLInputElement
                    const file = inputFile.files?.[0]
                    if (!file) return

                    await subirLogoEspera(file)
                    inputFile.value = ""
                  }}
                />
              </label>

              {logoEsperaUrl && (
                <button
                  style={btnRojo}
                  onClick={async () => {
                    const iglesiaId = await getIglesiaId()
                    if (!iglesiaId) return

                    const { error } = await supabase
                      .from("iglesias")
                      .update({
                        logo_url: null,
                        logo_nombre: null
                      })
                      .eq("id", iglesiaId)

                    if (error) {
                      console.error("Error quitando logo:", error)
                      alert("No se pudo quitar el logo guardado")
                      return
                    }

                    setLogoEsperaUrl("")
                    setLogoEsperaNombre("")
                  }}
                >
                  ❌ Quitar
                </button>
              )}
            </div>

            {logoEsperaUrl && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <img
                  src={logoEsperaUrl}
                  alt="Vista previa logo"
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#000",
                    flexShrink: 0
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {logoEsperaNombre || "Logo cargado"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Logo listo para proyectar o agregar a la lista
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    <div style={seccion}>
      <div
        onClick={() => setMostrarPalabra(v => !v)}
        style={{
          ...titulo,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: "12px"
        }}
      >
        <span>📖 Palabra</span>
        <span>{mostrarPalabra ? "▾" : "▸"}</span>
      </div>

      {mostrarPalabra && (
        <>
          <div style={subtitulo}>
            Ejemplos: Juan 3:16, 1 Corintios 13:4-7, Salmo 23
          </div>

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
        </>
      )}
    </div>

    <div style={seccion}>
      <div
        onClick={() => setMostrarCultos(v => !v)}
        style={{
          ...titulo,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: "12px"
        }}
      >
        <span>💾 Cultos Guardados</span>
        <span>{mostrarCultos ? "▾" : "▸"}</span>
      </div>

      {mostrarCultos && (
        <>
          {cultos.map((c) => (
            <div key={c.id} style={card}>
              <div style={textoCardPrincipal}>
                <span
                  style={tituloCardResponsive(isMobile)}
                  title={c.nombre || "Sin nombre"}
                >
                  {resumirTexto(c.nombre || "Sin nombre", 24)}
                </span>
              </div>

              <div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "6px",
    flexShrink: 0
  }}
>
  <div style={{ display: "flex", gap: "6px" }}>
    <button
      disabled={!socket}
      style={btnListaPlay}
      onClick={() => {
        setMenuCultoAbierto(null)
        cargarListaDesdeBD(c.id)
      }}
    >
      📂
    </button>

    <button
      style={btnListaMenu}
      onClick={() =>
        setMenuCultoAbierto(prev => (prev === c.id ? null : c.id))
      }
    >
      ⋮
    </button>
  </div>

  {menuCultoAbierto === c.id && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 42px)",
        gap: "6px"
      }}
    >
      <button
        disabled={!socket}
        style={btnListaMini}
        onClick={() => {
          setMenuCultoAbierto(null)
          renombrarCulto(c)
        }}
      >
        ✏️
      </button>

      <button
        disabled={!socket}
        style={btnListaMini}
        onClick={() => {
          setMenuCultoAbierto(null)
          duplicarCulto(c)
        }}
      >
        📄
      </button>

      <button
        disabled={!socket}
        style={btnListaDelete}
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

          setMenuCultoAbierto(null)
          cargarCultos()
        }}
      >
        🗑️
      </button>
    </div>
  )}
</div>
            </div>
          ))}
        </>
      )}
    </div>
    {/* aca empieza movil */}
  </div>

) : (
    <>
      <div style={columna}>
        <div style={seccion}>
          <h2 style={titulo}>🎵 Canciones</h2>

          <input
            placeholder="Buscar por número, título o categoría..."
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
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={input}
          >
            <option value="">Todas las categorías</option>
            {categoriasDisponibles.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div
            id="scroll-canciones"
            style={{
              height: "620px",
              maxHeight: "620px",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarGutter: "stable",
              paddingRight: "10px",
              marginTop: "6px",
              boxSizing: "border-box",
              overscrollBehavior: "contain"
            }}
          >
            {canciones
              .filter((c) => {
                const q = normalizar(busqueda || "").trim()
                if (!q) return true

                const titulo = normalizar(c.titulo || "")
                const categoria = normalizar(c.categoria || "")
                const tono = normalizar(c.tono || "")
                const numero = String(c.numero || "")

                return (
                  titulo.includes(q) ||
                  categoria.includes(q) ||
                  tono.includes(q) ||
                  numero.includes(q)
                )
              })
              .filter(c => !filtroTono || c.tono === filtroTono)
              .filter(c => !filtroCategoria || c.categoria === filtroCategoria)
              .sort((a, b) => {
                const na = a.numero ?? 999999
                const nb = b.numero ?? 999999
                if (na !== nb) return na - nb
                return (a.titulo || "").localeCompare(b.titulo || "")
              })
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    ...card,
                    background: c.id === activaId ? "#16a34a" : "#243449"
                  }}
                >
                  <div style={textoCardPrincipal}>
                    <span
                      style={tituloCardResponsive(isMobile)}
                      title={tituloCancionVisible(c)}
                    >
                      {tituloCancionVisible(c)}
                    </span>

                    <div style={subtituloCardResponsive(isMobile)}>
                      {subtituloCancionVisible(c)}
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
        </div>

        <div style={seccion}>
          <h2 style={titulo}>🛠️ Acciones</h2>
            <div style={{ ...fila, marginBottom: 16 }}>
              <button
                style={btnSecundario}
                onClick={() => window.open("/proyectar", "_blank")}
              >
                🖥️ Abrir Proyector
              </button>

              <button
                style={btnSecundario}
                onClick={() => window.open("/musicos", "_blank")}
              >
                🎹 Abrir Músicos
              </button>
            </div>
          <div style={{ ...fila, marginBottom: 16 }}>
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
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
              gap: "10px",
              marginBottom: 18
            }}
          >
            <label
              style={{
                ...btnSecundario,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                textAlign: "center"
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

            <button
              disabled={!socket}
              style={btnSecundario}
              onClick={proyectarPantallaNegra}
            >
              ⚫ Pantalla negra
            </button>

            <button
              disabled={!socket}
              style={btnSecundario}
              onClick={proyectarPantallaEspera}
            >
              ⏳ Pantalla de espera
            </button>

            <button
              disabled={!socket || !logoEsperaUrl}
              style={btnSecundario}
              onClick={proyectarPantallaLogo}
            >
              🖼️ Proyectar logo
            </button>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={subtitulo}>Agregar a lista de culto</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "10px"
              }}
            >
              {[
                {
                  titulo: "⚫ Pantalla negra",
                  onPlay: proyectarPantallaNegra,
                  onAdd: agregarNegroALista
                },
                {
                  titulo: "⏳ Pantalla de espera",
                  onPlay: proyectarPantallaEspera,
                  onAdd: agregarEsperaALista
                },
                {
                  titulo: `✍️ ${mensajeRapido || "Mensaje rápido"}`,
                  onPlay: proyectarMensajeRapido,
                  onAdd: agregarMensajeALista
                },
                {
                  titulo: logoEsperaNombre
                    ? `🖼️ ${logoEsperaNombre}`
                    : "🖼️ Logo de espera",
                  onPlay: proyectarPantallaLogo,
                  onAdd: agregarLogoALista,
                  disabledPlay: !logoEsperaUrl,
                  disabledAdd: !logoEsperaUrl
                }
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    ...card,
                    marginBottom: 0
                  }}
                >
                  <div style={textoCardPrincipal}>
                    <span
                      style={tituloCardResponsive(isMobile)}
                      title={item.titulo}
                    >
                      {item.titulo}
                    </span>
                  </div>

                  <div style={acciones}>
                    <button
                      disabled={!socket || item.disabledPlay}
                      style={btn}
                      onClick={item.onPlay}
                    >
                      ▶️
                    </button>

                    <button
                      disabled={item.disabledAdd}
                      style={btnSecundario}
                      onClick={item.onAdd}
                    >
                      ➕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={subtitulo}>Mensaje rápido</div>

            <input
              value={mensajeRapido}
              onChange={(e) => setMensajeRapido(e.target.value)}
              placeholder="Ej: Oremos, Bienvenidos, Santa Cena"
              style={input}
            />

            <div style={fila}>
              <button
                disabled={!socket}
                style={btnSecundario}
                onClick={proyectarMensajeRapido}
              >
                ✍️ Proyectar mensaje
              </button>
            </div>
          </div>

          <div>
            <div style={subtitulo}>Fondo con logo / imagen</div>

            <div style={{ ...fila, marginBottom: logoEsperaUrl ? 12 : 0 }}>
              <label
                style={{
                  ...btnSecundario,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer"
                }}
              >
                🖼️ Subir logo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const inputFile = e.target as HTMLInputElement
                    const file = inputFile.files?.[0]
                    if (!file) return

                    await subirLogoEspera(file)
                    inputFile.value = ""
                  }}
                />
              </label>

              {logoEsperaUrl && (
                <button
                  style={btnRojo}
                  onClick={async () => {
                    const iglesiaId = await getIglesiaId()
                    if (!iglesiaId) return

                    const { error } = await supabase
                      .from("iglesias")
                      .update({
                        logo_url: null,
                        logo_nombre: null
                      })
                      .eq("id", iglesiaId)

                    if (error) {
                      console.error("Error quitando logo:", error)
                      alert("No se pudo quitar el logo guardado")
                      return
                    }

                    setLogoEsperaUrl("")
                    setLogoEsperaNombre("")
                  }}
                >
                  ❌ Quitar
                </button>
              )}
            </div>

            {logoEsperaUrl && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <img
                  src={logoEsperaUrl}
                  alt="Vista previa logo"
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#000",
                    flexShrink: 0
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {logoEsperaNombre || "Logo cargado"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Logo listo para proyectar o agregar a la lista
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={seccion}>
          <h2 style={titulo}>📖 Palabra</h2>
          <div style={subtitulo}>
            Ejemplos: Juan 3:16, 1 Corintios 13:4-7, Salmo 23
          </div>

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
              <div style={textoCardPrincipal}>
                <span
                  style={tituloCardResponsive(isMobile)}
                  title={c.nombre || "Sin nombre"}
                >
                  {resumirTexto(c.nombre || "Sin nombre", 24)}
                </span>
              </div>

              <div style={acciones}>
                <button
                  disabled={!socket}
                  style={btn}
                  onClick={() => cargarListaDesdeBD(c.id)}
                >
                  📂
                </button>

                <button
                  disabled={!socket}
                  style={btnSecundario}
                  onClick={() => renombrarCulto(c)}
                >
                  ✏️
                </button>

                <button
                  disabled={!socket}
                  style={btnSecundario}
                  onClick={() => duplicarCulto(c)}
                >
                  📄
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

      <div
        style={{
          ...columna,
          alignSelf: "start",
          position: "sticky",
          top: "110px",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          paddingLeft: "18px",
          minWidth: 0
        }}
      >
        <div
          id="scroll-lista"
          style={{
            ...seccion,
            maxHeight: "calc(100vh - 140px)",
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: "10px",
            scrollbarGutter: "stable",
            overscrollBehavior: "contain"
          }}
        >
          <h2
            style={{
              ...titulo,
              lineHeight: 1.2,
              whiteSpace: "normal",
              marginBottom: "12px"
            }}
            title={nombreCulto || ""}
          >
            📋 Lista de Culto
            {nombreCulto && (
              <span style={{ opacity: 0.9 }}>
                {" "} - {resumirTexto(nombreCulto, isMobile ? 28 : 45)}
              </span>
            )}
          </h2>
          {mensajeFlash && (
            <div
              style={{
                marginBottom: "10px",
                padding: "8px 10px",
                borderRadius: "10px",
                background: "rgba(34,197,94,0.14)",
                border: "1px solid rgba(34,197,94,0.30)",
                fontSize: isMobile ? "12px" : "13px",
                opacity: 0.95
              }}
            >
              {mensajeFlash}
            </div>
          )}
          {lista.length === 0 && (
            <p style={{ opacity: 0.65, margin: 0 }}>
              Aún no hay elementos en la lista. Puedes agregar canciones, palabra, imágenes o estados.
            </p>
          )}

          {lista.map((c, i) => (
            <div
              key={i}
              draggable={!isMobile}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                if (!isMobile) e.preventDefault()
              }}
              onDrop={() => {
                if (!isMobile && dragIndex !== null) {
                  moverItemLista(dragIndex, i)
                }
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              style={{
                ...card,
                background: i === indiceActivoLista ? "rgba(22, 163, 74, 0.92)" : "#243449",
                border:
                  i === indiceActivoLista
                    ? "1px solid rgba(255,255,255,0.18)"
                    : "1px solid rgba(255,255,255,0.08)",
                opacity: dragIndex === i ? 0.55 : 1
              }}
            >
              <div style={textoCardPrincipal}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: 0
                  }}
                >
                  <span style={{ opacity: 0.8, flexShrink: 0 }}>
                    {i + 1}.
                  </span>

                  <span style={{ flexShrink: 0 }}>
                    {iconoItemLista(c)}
                  </span>

                  <span
                    style={tituloCardResponsive(isMobile)}
                    title={limpiarTituloLista(c?.titulo || "Sin título")}
                  >
                    {limpiarTituloLista(c?.titulo || "Sin título")}
                  </span>
                </div>

                {(!isMobile || c?.tipo === "estado" || c?.tipo === "biblia") && (
                  <div
                    style={{
                      fontSize: isMobile ? "11px" : "12px",
                      opacity: 0.68,
                      marginTop: "2px",
                      marginLeft: "30px"
                    }}
                  >
                    {subtituloItemLista(c)}
                  </div>
                )}
              </div>

              <div style={acciones}>
                {isMobile ? (
                  <>
                    <button
                      style={btnListaMini}
                      onClick={() => subirItemLista(i)}
                      disabled={i === 0}
                    >
                      ⬆️
                    </button>

                    <button
                      style={btnListaMini}
                      onClick={() => bajarItemLista(i)}
                      disabled={i === lista.length - 1}
                    >
                      ⬇️
                    </button>

                    <button
                      style={btnListaPlay}
                      disabled={!socket}
                      onClick={() => proyectarDesdeLista(i)}
                    >
                      ▶️
                    </button>

                    <button
                      disabled={!socket}
                      style={btnListaDelete}
                      onClick={() => {
                        const ok = confirm("¿Eliminar este elemento de la lista?")
                        if (ok) eliminarDeLista(i)
                      }}
                    >
                      ❌
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )}
</div>
  </div>
  </>
)
}

