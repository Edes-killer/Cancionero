

"use client"

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react"

import { supabase } from "@/lib/supabase"
import { io } from "socket.io-client"
import { getIglesiaId } from "../../lib/getIglesia"
import { get } from "http"

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
  const [cargandoControl, setCargandoControl] = useState(true)
  const [mensajeCargaControl, setMensajeCargaControl] = useState("Preparando control...")
  const itemListaRefs = useRef<(HTMLDivElement | null)[]>([])
  const indicePendienteScrollRef = useRef<number | null>(null)
  const [indiceItemAgregado, setIndiceItemAgregado] = useState<number | null>(null)
  const cancionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [fondoCancionUrl, setFondoCancionUrl] = useState("")
  const [fondoCancionNombre, setFondoCancionNombre] = useState("")
  const [fondoCancionModo, setFondoCancionModo] = useState<"ninguno" | "preset" | "estatico" | "movimiento">("preset")
  const [fondoCancionPreset, setFondoCancionPreset] = useState("cielo-dorado")
  const [fondoCancionOscuridad, setFondoCancionOscuridad] = useState(55)
  const [fondoCancionAjuste, setFondoCancionAjuste] = useState<"cover" | "contain">("cover")
  const [iglesiaIdActual, setIglesiaIdActual] = useState<string | null>(null)
  const [fondoCancionConfigLista, setFondoCancionConfigLista] = useState(false)
  const [modalGuardar, setModalGuardar] = useState(false)
const [nombreModal, setNombreModal] = useState("")
const fondosCancionPreset = [
  {
    id: "cielo-dorado",
    nombre: "Cielo dorado",
    fondo: "radial-gradient(circle at 50% 20%, rgba(251,191,36,0.45), transparent 34%), linear-gradient(135deg, #1e1b4b 0%, #7c2d12 48%, #0f172a 100%)"
  },
  {
    id: "azul-profundo",
    nombre: "Azul profundo",
    fondo: "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.38), transparent 32%), radial-gradient(circle at 80% 70%, rgba(14,165,233,0.25), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%)"
  },
  {
    id: "amanecer-suave",
    nombre: "Amanecer suave",
    fondo: "radial-gradient(circle at 70% 25%, rgba(253,186,116,0.55), transparent 30%), linear-gradient(135deg, #312e81 0%, #9f1239 45%, #431407 100%)"
  },
  {
    id: "verde-esperanza",
    nombre: "Verde esperanza",
    fondo: "radial-gradient(circle at 30% 20%, rgba(34,197,94,0.35), transparent 30%), radial-gradient(circle at 80% 80%, rgba(20,184,166,0.28), transparent 36%), linear-gradient(135deg, #022c22 0%, #064e3b 48%, #020617 100%)"
  },
  {
    id: "purpura-noche",
    nombre: "Púrpura noche",
    fondo: "radial-gradient(circle at 20% 30%, rgba(168,85,247,0.38), transparent 32%), radial-gradient(circle at 85% 65%, rgba(236,72,153,0.28), transparent 32%), linear-gradient(135deg, #020617 0%, #312e81 52%, #581c87 100%)"
  },
  {
    id: "fuego-suave",
    nombre: "Fuego suave",
    fondo: "radial-gradient(circle at 50% 35%, rgba(249,115,22,0.42), transparent 30%), radial-gradient(circle at 75% 75%, rgba(220,38,38,0.25), transparent 34%), linear-gradient(135deg, #1c1917 0%, #7c2d12 50%, #020617 100%)"
  }
]
  
useEffect(() => {
  const s = io("http://" + window.location.hostname + ":4000")

  s.on("connect", async () => {
  const sala = (await getIglesiaId()) || "global"

  console.log("🔥 SOCKET CONECTADO A SALA:", sala)

  s.emit("unirse-sala", { sala, pantalla: "control" })
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
  let activo = true

  const cargarInicial = async () => {
    try {
      setCargandoControl(true)
      setMensajeCargaControl("Cargando canciones y cultos...")

      await Promise.all([
        cargarCanciones(),
        cargarCultos(),
        cargarNombreIglesia()
      ])

      if (!activo) return

      setMensajeCargaControl("Control listo")
    } catch (error) {
      console.error("Error cargando control:", error)

      if (activo) {
        setMensajeCargaControl("Hubo un problema cargando el control")
      }
    } finally {
      if (activo) {
        setTimeout(() => {
          setCargandoControl(false)
        }, 350)
      }
    }
  }

  cargarInicial()

  return () => {
    activo = false
  }
}, [])

useEffect(() => {
  const actualizarPantalla = () => {
    setIsMobile(window.innerWidth < 768)
    setPantallaDetectada(true)
  }

  actualizarPantalla()

  window.addEventListener("resize", actualizarPantalla)

  return () => {
    window.removeEventListener("resize", actualizarPantalla)
  }
}, [])

useEffect(() => {
  if (!socket || lista.length === 0) return
  enviarPrecargaImagenes(lista)
}, [socket, lista])


useEffect(() => {
  if (indiceActivoLista === null || indiceActivoLista === undefined) return

  const el = itemListaRefs.current[indiceActivoLista]

  if (!el) return

  el.scrollIntoView({
    behavior: "smooth",
    block: "center"
  })
}, [indiceActivoLista])

useEffect(() => {
  if (!socket) return
  if (!fondoCancionUrl) return

  socket.emit("precargar-imagenes", [fondoCancionUrl])
}, [socket, fondoCancionUrl])

const [isMobile, setIsMobile] = useState(false)
const [pantallaDetectada, setPantallaDetectada] = useState(false)
const [mostrarCanciones, setMostrarCanciones] = useState(true)
const [mostrarAcciones, setMostrarAcciones] = useState(false)
const [mostrarPalabra, setMostrarPalabra] = useState(false)
const [mostrarCultos, setMostrarCultos] = useState(false)
const cargarLista = async () => {
  if (!listaIdActual) return
  await cargarListaDesdeBD(listaIdActual)
}

const cargarCanciones = async () => {
  const igId = await getIglesiaId()
  const { data, error } = await supabase.from("canciones").select("*").or(`iglesia_id.eq.${igId},iglesia_id.is.null`)
  if (error) {
    console.error("Error cargando canciones:", error)
    return
  }
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

  if (!iglesiaId) {
    setFondoCancionConfigLista(true)
    return
  }

  setIglesiaIdActual(iglesiaId)

  try {
    const guardado = localStorage.getItem(`fondo-cancion-${iglesiaId}`)

    if (guardado) {
      const config = JSON.parse(guardado)

      setFondoCancionUrl(config.url || "")
      setFondoCancionNombre(config.nombre || "")
      setFondoCancionModo(config.modo || "preset")
      setFondoCancionPreset(config.preset || "cielo-dorado")
      setFondoCancionOscuridad(config.oscuridad ?? 55)
      setFondoCancionAjuste(config.ajuste || "cover")
    }
  } catch (error) {
    console.error("No se pudo cargar configuración de fondo:", error)
  } finally {
    setFondoCancionConfigLista(true)
  }

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

const fondoCancionActual = () => {
  if (fondoCancionModo === "ninguno") return null

  if (fondoCancionModo === "preset") {
    const preset = fondosCancionPreset.find(f => f.id === fondoCancionPreset)

    return {
      tipo: "preset",
      preset: fondoCancionPreset,
      fondoCss: preset?.fondo || fondosCancionPreset[0].fondo,
      nombre: preset?.nombre || "Fondo predeterminado",
      oscuridad: fondoCancionOscuridad,
      ajuste: fondoCancionAjuste
    }
  }

  if (!fondoCancionUrl) return null

  return {
  tipo: fondoCancionModo,
  url: fondoCancionUrl,
  nombre: fondoCancionNombre,
  oscuridad: fondoCancionOscuridad,
  ajuste: fondoCancionAjuste
}
}

const registrarProyeccionCancion = async (cancion: any) => {
  if (!cancion?.id) return

  try {
    const iglesiaId = await getIglesiaId()

    await supabase.from("historial_proyecciones").insert({
      iglesia_id: iglesiaId,
      cancion_id: cancion.id,
      lista_id: listaIdActual || null,
      tipo: "cancion",
      titulo: cancion.titulo || "",
      tono: cancion.tono || "",
      categoria: cancion.categoria || ""
    })
  } catch (error) {
    console.error("Error registrando historial:", error)
  }
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
  requestAnimationFrame(() => {
    centrarCancionEnLista(id)
  })
  setIndiceLista(null)
  setIndiceActivoLista(null)
  limpiarModoBiblia()

  setPartes(data || [])
  setIndex(0)
  await registrarProyeccionCancion(cancion)
  socket.emit("cargar-cancion", {
  partes: data,
  index: 0,
  titulo: cancion?.titulo || "",
  tono: cancion?.tono || "",
  iglesia: nombreIglesia || "",
  logo_marca_url: logoEsperaUrl || "",
  fondo: fondoCancionActual()
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

  agregarItemAListaConFeedback(
  {
    tipo: "cancion",
    id: cancion.id,
    titulo: cancion.titulo
  },
  `✅ Agregada: ${cancion.titulo}`
)
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
  if (lista.length === 0) {
    alert("No hay elementos en la lista de culto para guardar.")
    return
  }

  const mensajePrompt = listaIdActual
    ? "Actualizar nombre del culto"
    : "Nombre para la nueva lista de culto"

  const nombre = prompt(mensajePrompt, nombreCulto || "")
  if (!nombre || !nombre.trim()) return

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

    setNombreCulto(nombre.trim())
    alert("✅ Lista de culto actualizada correctamente")
  } else {
    // CREAR CULTO NUEVO
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
    setNombreCulto(nombre.trim())
    alert("✅ Nueva lista de culto guardada correctamente")
  }
  setNombreCulto(nombre.trim())
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
      iglesia: nombreIglesia || "",
      logo_marca_url: logoEsperaUrl || ""
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
  await registrarProyeccionCancion(cancion || item)
  socket.emit("cargar-cancion", {
  partes: partesCancion,
  index: parteInicial,
  titulo: cancion?.titulo || item.titulo || "",
  tono: cancion?.tono || "",
  iglesia: nombreIglesia || "",
  logo_marca_url: logoEsperaUrl || "",
  fondo: fondoCancionActual()
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

const limpiarCultoActual = () => {
  setLista([])
  setListaIdActual(null)
  setNombreCulto("")
  setActivaId(null)
  setIndiceLista(null)
  setIndiceActivoLista(null)
  setPartes([])
  setIndex(0)
  limpiarModoBiblia()
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
    iglesia: nombreIglesia || "",
    logo_marca_url: logoEsperaUrl || ""
  })
  } catch (error: any) {
    alert(error.message || "No se pudo cargar el versículo")
  }
}

const agregarBibliaALista = async (ref: string) => {
  if (!ref.trim()) return

  try {
    const data = await buscarVersiculo(ref)

    agregarItemAListaConFeedback(
    {
      tipo: "biblia",
      referencia: data.referencia,
      texto: data.texto,
      paginas: data.paginas || [data.texto],
      titulo: `📖 ${data.referencia}`
    },
    `✅ Palabra agregada: ${data.referencia}`
  )
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
  agregarItemAListaConFeedback(
    {
      tipo: "estado",
      modo: "negro",
      titulo: "Pantalla negra"
    },
    "✅ Pantalla negra agregada"
  )
}

const agregarEsperaALista = () => {
  agregarItemAListaConFeedback(
    {
      tipo: "estado",
      modo: "espera",
      titulo: "Pantalla de espera",
      subtitulo: nombreIglesia || ""
    },
    "✅ Pantalla de espera agregada"
  )
}

const agregarMensajeALista = () => {
  agregarItemAListaConFeedback(
    {
      tipo: "estado",
      modo: "mensaje",
      titulo: mensajeRapido || "Mensaje rápido",
      subtitulo: nombreIglesia || ""
    },
    "✅ Mensaje agregado"
  )
}

const agregarLogoALista = () => {
  if (!logoEsperaUrl.trim()) {
    alert("Primero carga un logo")
    return
  }

  agregarItemAListaConFeedback(
  {
    tipo: "estado",
    modo: "logo",
    titulo: logoEsperaNombre || "Logo de espera",
    subtitulo: nombreIglesia || "",
    url: logoEsperaUrl,
    nombre: logoEsperaNombre || "Logo"
  },
  "✅ Logo agregado"
)
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

const obtenerFragmentoBusqueda = (
  texto: string,
  busqueda: string,
  largo = 90
) => {
  if (!texto || !busqueda) return ""

  const textoNorm = normalizar(texto)
  const busquedaNorm = normalizar(busqueda)

  const index = textoNorm.indexOf(busquedaNorm)

  if (index === -1) return ""

  const inicio = Math.max(0, index - 30)
  const fin = Math.min(texto.length, index + largo)

  let fragmento = texto.slice(inicio, fin).trim()

  if (inicio > 0) fragmento = "..." + fragmento
  if (fin < texto.length) fragmento += "..."

  return fragmento
}


const cancionesFiltradas = useMemo(() => {
  const q = normalizar(busqueda || "").trim()

  return [...canciones]
    .filter((c) => {
      if (!q) return true

      const titulo = normalizar(c.titulo || "")
      const categoria = normalizar(c.categoria || "")
      const tono = normalizar(c.tono || "")
      const numero = String(c.numero || "")

      // NUEVO: búsqueda por letra
      const textoBusqueda = normalizar(c.texto_busqueda || "")

      return (
        titulo.includes(q) ||
        categoria.includes(q) ||
        tono.includes(q) ||
        numero.includes(q) ||
        textoBusqueda.includes(q)
      )
    })
    .filter((c) => !filtroTono || c.tono === filtroTono)
    .filter((c) => !filtroCategoria || c.categoria === filtroCategoria)
    .sort((a, b) => {
      const na = a.numero ?? 999999
      const nb = b.numero ?? 999999

      if (na !== nb) return na - nb

      return (a.titulo || "").localeCompare(b.titulo || "")
    })
}, [canciones, busqueda, filtroTono, filtroCategoria])

const scrollCancionesRef = useRef<HTMLDivElement | null>(null)
const [scrollTopCanciones, setScrollTopCanciones] = useState(0)

const ALTURA_ITEM_CANCION = 78
const OVERSCAN_CANCIONES = 8

const inicioVirtualCanciones = Math.max(
  0,
  Math.floor(scrollTopCanciones / ALTURA_ITEM_CANCION) - OVERSCAN_CANCIONES
)

const cantidadVisibleCanciones = 12

const finVirtualCanciones = Math.min(
  cancionesFiltradas.length,
  inicioVirtualCanciones + cantidadVisibleCanciones + OVERSCAN_CANCIONES * 2
)

const cancionesVirtuales = cancionesFiltradas.slice(
  inicioVirtualCanciones,
  finVirtualCanciones
)

useEffect(() => {
  if (isMobile || !activaId) return

  const contenedor = scrollCancionesRef.current
  if (!contenedor) return

  const posicion = cancionesFiltradas.findIndex((c) => c.id === activaId)
  if (posicion === -1) return

  const top = Math.max(
    0,
    posicion * ALTURA_ITEM_CANCION -
      contenedor.clientHeight / 2 +
      ALTURA_ITEM_CANCION / 2
  )

  requestAnimationFrame(() => {
    contenedor.scrollTo({
      top,
      behavior: "smooth"
    })
  })
}, [isMobile, activaId, cancionesFiltradas.length])

const centrarCancionEnLista = (id: string) => {
  if (isMobile) return

  const contenedor = scrollCancionesRef.current
  if (!contenedor) {
    console.log("❌ No existe scrollCancionesRef")
    return
  }

  const posicion = cancionesFiltradas.findIndex((c) => c.id === id)

  if (posicion === -1) {
    console.log("❌ Canción activa no está en cancionesFiltradas:", id)
    return
  }

  const top = Math.max(
    0,
    posicion * ALTURA_ITEM_CANCION -
      contenedor.clientHeight / 2 +
      ALTURA_ITEM_CANCION / 2
  )

  console.log("🎯 centrando canción:", {
    id,
    posicion,
    top,
    alturaItem: ALTURA_ITEM_CANCION,
    altoContenedor: contenedor.clientHeight
  })

  contenedor.scrollTo({
    top,
    behavior: "smooth"
  })
}

useEffect(() => {
  if (isMobile) return
  if (!activaId) return

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      centrarCancionEnLista(activaId)
    })
  })
}, [isMobile, activaId, cancionesFiltradas.length])

const agregarItemAListaConFeedback = (item: any, mensaje: string) => {
  setLista(prev => {
    indicePendienteScrollRef.current = prev.length
    return [...prev, item]
  })

  mostrarFeedbackLista(mensaje)
}

useEffect(() => {
  const indice = indicePendienteScrollRef.current

  if (indice === null) return

  indicePendienteScrollRef.current = null
  setIndiceItemAgregado(indice)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = itemListaRefs.current[indice]

      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center"
        })
      }
    })
  })

  const timeout = setTimeout(() => {
    setIndiceItemAgregado(null)
  }, 1400)

  return () => clearTimeout(timeout)
}, [lista.length])

useEffect(() => {
  if (!iglesiaIdActual) return
  if (!fondoCancionConfigLista) return

  const config = {
    url: fondoCancionUrl,
    nombre: fondoCancionNombre,
    modo: fondoCancionModo,
    preset: fondoCancionPreset,
    oscuridad: fondoCancionOscuridad,
    ajuste: fondoCancionAjuste
  }

  localStorage.setItem(
    `fondo-cancion-${iglesiaIdActual}`,
    JSON.stringify(config)
  )
}, [
  iglesiaIdActual,
  fondoCancionConfigLista,
  fondoCancionUrl,
  fondoCancionNombre,
  fondoCancionModo,
  fondoCancionPreset,
  fondoCancionOscuridad,
  fondoCancionAjuste
])

const guardarCultoConNombre = async (nombre: string) => {
  if (!nombre.trim()) return
  setNombreCulto(nombre.trim())
  await guardarCulto()
}

const etiquetaBoton = (texto: string) => {
  return isMobile ? "" : ` ${texto}`
}

if (!pantallaDetectada) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)"
      }}
    />
  )
}
if (cargandoControl) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(30, 41, 59, 0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "22px",
          padding: "28px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "58px",
            height: "58px",
            borderRadius: "999px",
            border: "4px solid rgba(255,255,255,0.16)",
            borderTopColor: "#38bdf8",
            margin: "0 auto 18px auto",
            animation: "spinCargaControl 0.9s linear infinite"
          }}
        />

        <style>{`
          @keyframes spinCargaControl {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            marginBottom: "8px"
          }}
        >
          Control de Culto
        </div>

        <div
          style={{
            fontSize: "14px",
            opacity: 0.78,
            lineHeight: 1.5
          }}
        >
          {mensajeCargaControl}
        </div>

        <div
          style={{
            marginTop: "18px",
            height: "8px",
            borderRadius: "999px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)"
          }}
        >
          <div
            style={{
              height: "100%",
              width: "68%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
              animation: "barraCargaControl 1.2s ease-in-out infinite"
            }}
          />
        </div>

        <style>{`
          @keyframes barraCargaControl {
            0% {
              transform: translateX(-110%);
            }
            50% {
              transform: translateX(30%);
            }
            100% {
              transform: translateX(160%);
            }
          }
        `}</style>
      </div>
    </div>
  )
}

const etiquetaParteControl = (() => {
  if (paginasBiblia.length > 0) {
    return `📖 Palabra • Página ${paginaBibliaActual + 1} de ${paginasBiblia.length}`
  }

  if (partes.length > 0) {
    const parteActual = partes[index]
    const tipo = parteActual?.tipo || "Parte"

    let nombreParte = tipo

    if (tipo === "Verso") {
      let numeroVerso = 0

      for (let i = 0; i <= index; i++) {
        if (partes[i]?.tipo === "Verso") {
          numeroVerso++
        }
      }

      nombreParte = `Verso ${numeroVerso}`
    }

    return `🎵 ${nombreParte} • Parte ${index + 1} de ${partes.length}`
  }

  if (indiceActivoLista !== null && lista[indiceActivoLista]) {
    return `📋 Elemento ${indiceActivoLista + 1} de ${lista.length}`
  }

  return "Sin proyección activa"
})()

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
  @keyframes spinCtrl { to { transform: rotate(360deg) } }
  #scroll-canciones::-webkit-scrollbar { width: 6px }
  #scroll-canciones::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px }
  #scroll-canciones::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 999px }
  #scroll-lista::-webkit-scrollbar { width: 6px }
  #scroll-lista::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px }
  #scroll-lista::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 999px }
  .ctrl-btn { transition: opacity 0.15s, transform 0.1s }
  .ctrl-btn:active { transform: scale(0.95) }
  .ctrl-btn:disabled { opacity: 0.4 !important; cursor: not-allowed }
`}</style>

{/* ── Modal guardar culto ─────────────────────────────────────────────────── */}
{modalGuardar && (
  <div style={{
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20
  }}>
    <div style={{
      background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 20, padding: 24, width: "100%", maxWidth: 420,
      boxShadow: "0 24px 60px rgba(0,0,0,0.5)"
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
        💾 {listaIdActual ? "Actualizar culto" : "Guardar lista de culto"}
      </div>
      <input
        autoFocus
        value={nombreModal}
        onChange={e => setNombreModal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            setModalGuardar(false)
            guardarCultoConNombre(nombreModal)
          }
          if (e.key === "Escape") setModalGuardar(false)
        }}
        placeholder="Nombre del culto..."
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)", background: "#0a1525",
          color: "white", fontSize: 16, outline: "none", boxSizing: "border-box",
          marginBottom: 16
        }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="ctrl-btn"
          onClick={() => { setModalGuardar(false); guardarCultoConNombre(nombreModal) }}
          style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none",
            background: "#2563eb", color: "white", fontWeight: 800,
            fontSize: 15, cursor: "pointer"
          }}
        >
          Guardar
        </button>
        <button
          className="ctrl-btn"
          onClick={() => setModalGuardar(false)}
          style={{
            padding: "12px 18px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)", color: "white",
            fontWeight: 700, fontSize: 15, cursor: "pointer"
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

<div style={{
  minHeight: "100dvh",
  background: "linear-gradient(180deg, #060d1a 0%, #0f172a 100%)",
  color: "white",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  display: "flex", flexDirection: "column",
  boxSizing: "border-box"
}}>

  {/* ── BARRA DE NAVEGACIÓN SUPERIOR ─────────────────────────────────────── */}
  <div style={{
    position: "sticky", top: 0, zIndex: 80,
    background: "rgba(6,13,26,0.97)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(12px)",
    padding: isMobile ? "10px 14px" : "10px 20px",
    display: "flex", alignItems: "center", gap: 12
  }}>
    {/* Título / culto activo */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, lineHeight: 1.2 }}>
        🎛️ Control de Culto
      </div>
      {nombreCulto && (
        <div style={{
          fontSize: 11, opacity: 0.5, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>
          {listaIdActual ? "✏️ Editando: " : ""}{nombreCulto}
        </div>
      )}
    </div>

    {/* Botones navegación — siempre visibles */}
    <button
      className="ctrl-btn"
      disabled={!socket}
      onClick={anterior}
      style={{
        width: isMobile ? 48 : 56, height: isMobile ? 48 : 56,
        borderRadius: 14, border: "none",
        background: "rgba(255,255,255,0.08)",
        color: "white", fontSize: isMobile ? 20 : 22,
        cursor: "pointer", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
    >⬅️</button>

    <button
      className="ctrl-btn"
      disabled={!socket}
      onClick={siguiente}
      style={{
        width: isMobile ? 48 : 56, height: isMobile ? 48 : 56,
        borderRadius: 14, border: "none",
        background: "#2563eb",
        color: "white", fontSize: isMobile ? 20 : 22,
        cursor: "pointer", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
    >➡️</button>

    {/* Pantalla negra rápida */}
    <button
      className="ctrl-btn"
      disabled={!socket}
      onClick={proyectarPantallaNegra}
      title="Pantalla negra"
      style={{
        width: isMobile ? 44 : 52, height: isMobile ? 44 : 52,
        borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
        background: "#111", color: "white", fontSize: 16,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
    >⚫</button>
  </div>

  {/* ── INDICADOR PARTE ACTUAL ──────────────────────────────────────────── */}
  <div style={{
    background: "rgba(15,23,42,0.9)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: isMobile ? "7px 14px" : "8px 20px",
    fontSize: isMobile ? 12 : 13,
    fontWeight: 700, opacity: 0.85,
    textAlign: "center"
  }}>
    {etiquetaParteControl}
  </div>

  {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── */}
  <div style={{
    flex: 1,
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr",
    alignItems: "start",
    padding: isMobile ? "10px" : "20px",
    gap: isMobile ? 10 : 20,
    boxSizing: "border-box",
    // ✅ Evita scroll horizontal en móvil
    overflowX: "hidden",
    minWidth: 0,
    width: "100%"
  }}>

    {/* ══ COLUMNA IZQUIERDA: Canciones + Herramientas ═══════════════════ */}
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16 }}>

      {/* ── Canciones ─────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        {/* Header canciones */}
        <div
          onClick={() => setMostrarCanciones(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarCanciones ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>
            🎵 Canciones
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600,
              background: "rgba(59,130,246,0.15)", color: "#93c5fd",
              borderRadius: 6, padding: "2px 7px"
            }}>
              {cancionesFiltradas.length}
            </span>
          </div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarCanciones ? "▾" : "▸"}</span>
        </div>

        {mostrarCanciones && (
          <div style={{ padding: isMobile ? "12px 14px" : "14px 18px" }}>
            {/* Búsqueda */}
            <input
              placeholder="🔍 Buscar por número, título o letra..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: "100%", padding: "11px 13px",
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                background: "#0a1525", color: "white",
                fontSize: 16, outline: "none",
                boxSizing: "border-box", marginBottom: 8
              }}
            />

            {/* Filtros en fila */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <select
                value={filtroTono}
                onChange={e => setFiltroTono(e.target.value)}
                style={{
                  padding: "9px 10px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a1525", color: "white",
                  fontSize: 13, outline: "none"
                }}
              >
                <option value="">Todos los tonos</option>
                {["Do","Dom","Do#","Re","Rem","Re#","Mi","Mim","Fa","Fam","Fa#","Sol","Solm","Sol#","La","Lam","La#","Si","Sim"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
                style={{
                  padding: "9px 10px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a1525", color: "white",
                  fontSize: 13, outline: "none"
                }}
              >
                <option value="">Todas las categorías</option>
                {categoriasDisponibles.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Lista virtualizada */}
            <div
              id="scroll-canciones"
              ref={scrollCancionesRef}
              onScroll={e => setScrollTopCanciones((e.target as HTMLDivElement).scrollTop)}
              style={{ maxHeight: isMobile ? 360 : "calc(100vh - 420px)", overflowY: "auto", overflowX: "hidden" }}
            >
              <div style={{ height: cancionesFiltradas.length * ALTURA_ITEM_CANCION, position: "relative" }}>
                <div style={{ transform: `translateY(${inicioVirtualCanciones * ALTURA_ITEM_CANCION}px)` }}>
                  {cancionesVirtuales.map(c => {
                    const activa = c.id === activaId
                    const fragmento = obtenerFragmentoBusqueda(c.texto_busqueda || "", busqueda)
                    return (
                      <div
                        key={c.id}
                        ref={el => { cancionRefs.current[c.id] = el }}
                        style={{
                          height: ALTURA_ITEM_CANCION,
                          paddingBottom: 8, boxSizing: "border-box"
                        }}
                      >
                        <div style={{
                          height: "100%",
                          background: activa ? "rgba(22,163,74,0.85)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${activa ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.07)"}`,
                          borderRadius: 11,
                          display: "flex", alignItems: "center",
                          gap: 10, padding: "0 12px",
                          transition: "background 0.15s"
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700, fontSize: 14, lineHeight: 1.25,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                            }}>
                              {tituloCancionVisible(c)}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                              {subtituloCancionVisible(c)}
                            </div>
                            {fragmento && busqueda && (
                              <div style={{
                                fontSize: 10, opacity: 0.5, marginTop: 2,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                              }}>
                                {fragmento}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              className="ctrl-btn"
                              disabled={!socket}
                              onClick={() => proyectar(c.id)}
                              style={{
                                padding: isMobile ? "7px 10px" : "8px 12px",
                                borderRadius: 9, border: "none",
                                background: "#2563eb", color: "white",
                                fontWeight: 700, fontSize: 13, cursor: "pointer"
                              }}
                            >▶</button>
                            <button
                              className="ctrl-btn"
                              disabled={!socket}
                              onClick={() => agregarALista(c)}
                              style={{
                                padding: isMobile ? "7px 10px" : "8px 12px",
                                borderRadius: 9, border: "none",
                                background: "rgba(255,255,255,0.08)", color: "white",
                                fontWeight: 700, fontSize: 13, cursor: "pointer"
                              }}
                            >+</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Acciones rápidas ──────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        <div
          onClick={() => setMostrarAcciones(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarAcciones ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>🛠️ Herramientas</div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarAcciones ? "▾" : "▸"}</span>
        </div>

        {mostrarAcciones && (
          <div style={{ padding: isMobile ? "12px 14px" : "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Pantallas rápidas */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Pantallas rápidas
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {[
                  { label: "⚫ Pantalla negra", fn: proyectarPantallaNegra, color: "#111" },
                  { label: "⏳ Pantalla espera", fn: proyectarPantallaEspera, color: "#334155" },
                  { label: "🖼️ Logo / Espera", fn: proyectarPantallaLogo, color: "#1e3a8a" },
                ].map(({ label, fn, color }) => (
                  <button
                    key={label}
                    className="ctrl-btn"
                    disabled={!socket}
                    onClick={fn}
                    style={{
                      padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                      background: color, color: "white", fontWeight: 700,
                      fontSize: 13, cursor: "pointer", textAlign: "left"
                    }}
                  >{label}</button>
                ))}
                <button
                  className="ctrl-btn"
                  disabled={!socket}
                  onClick={proyectarMensajeRapido}
                  style={{
                    padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                    background: "#374151", color: "white", fontWeight: 700,
                    fontSize: 13, cursor: "pointer", textAlign: "left"
                  }}
                >✍️ Mensaje</button>
              </div>
            </div>

            {/* Mensaje rápido */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
                Texto del mensaje
              </div>
              <input
                value={mensajeRapido}
                onChange={e => setMensajeRapido(e.target.value)}
                placeholder="Ej: Oremos, Bienvenidos..."
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0a1525", color: "white",
                  fontSize: 14, outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            {/* Subir imagen para lista */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Imagen para el culto
              </div>
              <label style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                border: "1px dashed rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.03)",
                cursor: "pointer", fontSize: 13, fontWeight: 600
              }}>
                🖼️ Subir imagen y agregar a lista
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={async e => {
                    const inputFile = e.target as HTMLInputElement
                    const file = inputFile.files?.[0]
                    if (!file) return
                    const resultado = await subirImagen(file)
                    if (resultado?.url) {
                      agregarItemAListaConFeedback(
                        { tipo: "imagen", url: resultado.url, titulo: resultado.nombre },
                        `✅ Imagen agregada: ${resultado.nombre || "Imagen"}`
                      )
                    }
                    inputFile.value = ""
                  }}
                />
              </label>
            </div>

            {/* Fondo para canciones */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Fondo para canciones
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <select
                  value={fondoCancionModo}
                  onChange={e => setFondoCancionModo(e.target.value as "estatico" | "ninguno" | "preset" | "movimiento")}
                  style={{
                    padding: "9px 10px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#0a1525", color: "white", fontSize: 13, outline: "none"
                  }}
                >
                  <option value="preset">Fondo predeterminado</option>
                  <option value="ninguno">Sin fondo</option>
                  <option value="estatico">Imagen estática</option>
                  <option value="movimiento">Imagen con movimiento</option>
                </select>

                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "9px 12px", borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>
                  🖼️ Subir fondo
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async e => {
                      const inputFile = e.target as HTMLInputElement
                      const file = inputFile.files?.[0]
                      if (!file) return
                      const resultado = await subirImagen(file)
                      if (resultado?.url) {
                        setFondoCancionUrl(resultado.url)
                        setFondoCancionNombre(resultado.nombre || "Fondo")
                        setFondoCancionModo("estatico")
                      }
                      inputFile.value = ""
                    }}
                  />
                </label>
              </div>

              {/* Presets de fondo */}
              {fondoCancionModo === "preset" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                  {fondosCancionPreset.map(fondo => (
                    <button
                      key={fondo.id}
                      onClick={() => { setFondoCancionPreset(fondo.id); setFondoCancionModo("preset") }}
                      style={{
                        minHeight: 56, borderRadius: 10,
                        border: fondoCancionPreset === fondo.id
                          ? "2px solid rgba(255,255,255,0.85)"
                          : "1px solid rgba(255,255,255,0.12)",
                        background: fondo.fondo, color: "white",
                        cursor: "pointer", fontWeight: 800, fontSize: 11,
                        textShadow: "0 2px 8px rgba(0,0,0,0.75)",
                        boxShadow: fondoCancionPreset === fondo.id ? "0 0 0 2px rgba(37,99,235,0.6)" : "none"
                      }}
                    >{fondo.nombre}</button>
                  ))}
                </div>
              )}

              {/* Ajuste imagen + oscuridad */}
              {fondoCancionModo !== "preset" && (
                <select
                  value={fondoCancionAjuste}
                  onChange={e => setFondoCancionAjuste(e.target.value as "cover" | "contain")}
                  style={{
                    width: "100%", padding: "9px 10px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#0a1525", color: "white", fontSize: 13,
                    outline: "none", marginBottom: 8
                  }}
                >
                  <option value="cover">Cubrir pantalla</option>
                  <option value="contain">Mostrar imagen completa</option>
                </select>
              )}

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
                  Oscuridad del fondo: {fondoCancionOscuridad}%
                </div>
                <input
                  type="range" min="20" max="80"
                  value={fondoCancionOscuridad}
                  onChange={e => setFondoCancionOscuridad(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Preview fondo actual */}
              {fondoCancionModo !== "preset" && fondoCancionUrl && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)"
                }}>
                  <img src={fondoCancionUrl} alt="Fondo"
                    style={{ width: 72, height: 46, objectFit: "cover", borderRadius: 7, background: "#000", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fondoCancionNombre || "Fondo cargado"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>Se aplica a las canciones proyectadas</div>
                  </div>
                  <button className="ctrl-btn"
                    onClick={() => { setFondoCancionUrl(""); setFondoCancionNombre(""); setFondoCancionModo("preset") }}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Items especiales para agregar a lista */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Agregar a lista
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { titulo: "⚫ Pantalla negra", onPlay: proyectarPantallaNegra, onAdd: agregarNegroALista },
                  { titulo: "⏳ Pantalla de espera", onPlay: proyectarPantallaEspera, onAdd: agregarEsperaALista },
                  { titulo: `✍️ ${mensajeRapido || "Mensaje rápido"}`, onPlay: proyectarMensajeRapido, onAdd: agregarMensajeALista },
                  {
                    titulo: logoEsperaNombre ? `🖼️ ${logoEsperaNombre}` : "🖼️ Logo de espera",
                    onPlay: proyectarPantallaLogo, onAdd: agregarLogoALista,
                    disabled: !logoEsperaUrl
                  }
                ].map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10, padding: "9px 12px"
                  }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.titulo}</span>
                    <button className="ctrl-btn" disabled={!socket || item.disabled} onClick={item.onPlay}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>▶</button>
                    <button className="ctrl-btn" disabled={item.disabled} onClick={item.onAdd}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Links abrir proyector / músicos */}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ctrl-btn"
                onClick={() => window.open(`${window.location.origin}/proyectar`, "_blank", "noopener,noreferrer")}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                🖥️ Abrir Proyector
              </button>
              <button className="ctrl-btn"
                onClick={() => window.open(`${window.location.origin}/musicos`, "_blank", "noopener,noreferrer")}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                🎹 Abrir Músicos
              </button>
            </div>

            {/* Gestión culto */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Lista de culto
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="ctrl-btn"
                  disabled={!socket}
                  onClick={() => {
                    setNombreModal(nombreCulto || "")
                    setModalGuardar(true)
                  }}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10, border: "none",
                    background: "#2563eb", color: "white", fontWeight: 700,
                    fontSize: 13, cursor: "pointer"
                  }}
                >💾 Guardar lista</button>

                <button
                  className="ctrl-btn"
                  onClick={() => {
                    const hayAlgo = lista.length > 0 || partes.length > 0 || !!nombreCulto
                    if (hayAlgo) {
                      if (!window.confirm("¿Limpiar el control y crear nueva lista?")) return
                    }
                    limpiarCultoActual()
                  }}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.06)", color: "white",
                    fontWeight: 700, fontSize: 13, cursor: "pointer"
                  }}
                >🆕 Nueva lista</button>
              </div>
            </div>

            {/* Logo */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                Logo de iglesia
              </div>
              {logoEsperaUrl ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)"
                }}>
                  <img src={logoEsperaUrl} alt="Logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, background: "#000", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {logoEsperaNombre || "Logo cargado"}
                  </div>
                  <button
                    className="ctrl-btn"
                    onClick={async () => {
                      const igId = await getIglesiaId()
                      if (!igId) return
                      await supabase.from("iglesias").update({ logo_url: null, logo_nombre: null }).eq("id", igId)
                      setLogoEsperaUrl("")
                      setLogoEsperaNombre("")
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 8, border: "none",
                      background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                      fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0
                    }}
                  >✕</button>
                </div>
              ) : (
                <label style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: 0.7
                }}>
                  📁 Subir logo de iglesia
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async e => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (!file) return
                      await subirLogoEspera(file)
                      ;(e.target as HTMLInputElement).value = ""
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Palabra / Biblia ──────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        <div
          onClick={() => setMostrarPalabra(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarPalabra ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>📖 Palabra</div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarPalabra ? "▾" : "▸"}</span>
        </div>

        {mostrarPalabra && (
          <div style={{ padding: isMobile ? "12px 14px" : "16px 18px" }}>
            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>
              Ejemplos: Juan 3:16 • Salmos 23 • 1 Corintios 13:4-7
            </div>
            <input
              list="libros-biblia"
              placeholder="Escribe una cita bíblica..."
              value={inputBiblia}
              onChange={e => setInputBiblia(e.target.value)}
              onKeyDown={async e => {
                if (e.key === "Enter" && inputBiblia.trim()) {
                  await proyectarBiblia(inputBiblia)
                  setInputBiblia("")
                }
              }}
              style={{
                width: "100%", padding: "11px 13px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#0a1525", color: "white",
                fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 10
              }}
            />
            <datalist id="libros-biblia">
              {sugerenciasBiblia.map(s => <option key={s} value={s} />)}
            </datalist>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                className="ctrl-btn"
                disabled={!socket}
                onClick={async () => {
                  if (!inputBiblia.trim()) return
                  await proyectarBiblia(inputBiblia)
                  setInputBiblia("")
                }}
                style={{
                  padding: "11px", borderRadius: 10, border: "none",
                  background: "#2563eb", color: "white", fontWeight: 700,
                  fontSize: 14, cursor: "pointer"
                }}
              >📖 Proyectar</button>
              <button
                className="ctrl-btn"
                disabled={!socket}
                onClick={async () => {
                  if (!inputBiblia.trim()) return
                  await agregarBibliaALista(inputBiblia)
                  setInputBiblia("")
                }}
                style={{
                  padding: "11px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.06)", color: "white",
                  fontWeight: 700, fontSize: 14, cursor: "pointer"
                }}
              >+ Lista</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cultos guardados ──────────────────────────────────────────── */}
      <div style={{
        background: "rgba(17,27,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden"
      }}>
        <div
          onClick={() => setMostrarCultos(v => !v)}
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            borderBottom: mostrarCultos ? "1px solid rgba(255,255,255,0.06)" : "none"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>
            💾 Cultos guardados
            {cultos.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 600,
                background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
                borderRadius: 6, padding: "2px 7px"
              }}>{cultos.length}</span>
            )}
          </div>
          <span style={{ opacity: 0.5, fontSize: 18 }}>{mostrarCultos ? "▾" : "▸"}</span>
        </div>

        {mostrarCultos && (
          <div style={{ padding: isMobile ? "10px 14px" : "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {cultos.length === 0 && (
              <div style={{ opacity: 0.45, fontSize: 13, padding: "8px 0" }}>
                No hay cultos guardados aún.
              </div>
            )}
            {cultos.map(c => (
              <div key={c.id} style={{
                background: c.id === listaIdActual ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${c.id === listaIdActual ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 11, padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {c.nombre || "Sin nombre"}
                  </div>
                  {c.fecha && (
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
                      {new Date(c.fecha).toLocaleDateString("es-CL")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    className="ctrl-btn"
                    onClick={() => { setMenuCultoAbierto(null); cargarListaDesdeBD(c.id) }}
                    style={{
                      padding: "7px 10px", borderRadius: 9, border: "none",
                      background: "#2563eb", color: "white", fontWeight: 700,
                      fontSize: 13, cursor: "pointer"
                    }}
                  >📂</button>
                  <button
                    className="ctrl-btn"
                    onClick={() => setMenuCultoAbierto(prev => prev === c.id ? null : c.id)}
                    style={{
                      padding: "7px 10px", borderRadius: 9,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.06)", color: "white",
                      fontWeight: 700, fontSize: 13, cursor: "pointer"
                    }}
                  >⋮</button>
                </div>
                {menuCultoAbierto === c.id && (
                  <div style={{ width: "100%", display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="ctrl-btn" onClick={() => { setMenuCultoAbierto(null); renombrarCulto(c) }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      ✏️ Renombrar
                    </button>
                    <button className="ctrl-btn" onClick={() => { setMenuCultoAbierto(null); duplicarCulto(c) }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      📄 Duplicar
                    </button>
                    <button className="ctrl-btn"
                      onClick={async () => {
                        if (!window.confirm("¿Eliminar este culto completo?")) return
                        setMenuCultoAbierto(null)
                        await supabase.from("items_lista").delete().eq("lista_id", c.id)
                        await supabase.from("listas_culto").delete().eq("id", c.id)
                        cargarCultos()
                      }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      🗑️ Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ══ COLUMNA DERECHA: Lista de culto activa ════════════════════════ */}
    <div style={{
      display: "flex", flexDirection: "column", gap: 0,
      minWidth: 0, width: "100%"
    }}>
      <div
        id="scroll-lista"
        style={{
          background: "rgba(17,27,46,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, overflow: "hidden",
          maxHeight: isMobile ? "50vh" : "calc(100vh - 160px)",
          overflowY: "auto",
          position: isMobile ? "static" : "sticky",
          top: isMobile ? "auto" : 96,
          // ✅ No se desborda en móvil
          minWidth: 0, width: "100%"
        }}
      >
        {/* Header lista */}
        <div style={{
          padding: isMobile ? "12px 14px" : "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15 }}>
              📋 Lista de Culto
            </div>
            {nombreCulto && (
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                {resumirTexto(nombreCulto, 30)}
              </div>
            )}
          </div>
          {lista.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
              borderRadius: 6, padding: "3px 9px"
            }}>{lista.length} items</span>
          )}
        </div>

        {/* Banner culto guardado activo */}
        {listaIdActual && (
          <div style={{
            margin: "10px 12px 0",
            padding: "10px 12px", borderRadius: 10,
            background: "rgba(37,99,235,0.12)",
            border: "1px solid rgba(59,130,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap"
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
              ✏️ Editando culto guardado
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="ctrl-btn" onClick={guardarCulto}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                💾
              </button>
              <button className="ctrl-btn" onClick={guardarCultoComoCopia}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                📄
              </button>
              <button className="ctrl-btn"
                onClick={() => { if (window.confirm("¿Salir del modo edición?")) limpiarCultoActual() }}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Flash mensaje */}
        {mensajeFlash && (
          <div style={{
            margin: "8px 12px 0",
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            fontSize: 13, fontWeight: 600
          }}>
            {mensajeFlash}
          </div>
        )}

        {/* Items de la lista */}
        <div style={{ padding: isMobile ? "10px 12px" : "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.length === 0 && (
            <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>
              Agrega canciones, palabra o imágenes desde la izquierda
            </div>
          )}

          {lista.map((c, i) => {
            const esActivo = i === indiceActivoLista
            const esAgregado = i === indiceItemAgregado
            return (
              <div
                key={i}
                ref={el => { itemListaRefs.current[i] = el }}
                draggable={!isMobile}
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => { if (!isMobile) e.preventDefault() }}
                onDrop={() => { if (!isMobile && dragIndex !== null) moverItemLista(dragIndex, i); setDragIndex(null) }}
                onDragEnd={() => setDragIndex(null)}
                style={{
                  background: esActivo ? "rgba(22,163,74,0.85)" : esAgregado ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${esActivo ? "rgba(34,197,94,0.5)" : esAgregado ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 11, padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  flexWrap: "wrap",
                  opacity: dragIndex === i ? 0.5 : 1,
                  transition: "background 0.2s, border-color 0.2s"
                }}
              >
                {/* Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ opacity: 0.6, fontSize: 12, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ flexShrink: 0 }}>{iconoItemLista(c)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14, lineHeight: 1.25,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {limpiarTituloLista(c?.titulo || "Sin título")}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 1 }}>
                      {subtituloItemLista(c)}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="ctrl-btn" disabled={!socket} onClick={() => proyectarDesdeLista(i)}
                    style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ▶
                  </button>
                  <button className="ctrl-btn"
                    onClick={() => setMenuItemAbierto(prev => prev === i ? null : i)}
                    style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ⋮
                  </button>
                </div>

                {/* Menú expandido */}
                {menuItemAbierto === i && (
                  <div style={{ width: "100%", display: "flex", gap: 6 }}>
                    <button className="ctrl-btn" onClick={() => subirItemLista(i)} disabled={i === 0}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: i === 0 ? 0.4 : 1 }}>⬆️</button>
                    <button className="ctrl-btn" onClick={() => bajarItemLista(i)} disabled={i === lista.length - 1}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "#334155", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: i === lista.length - 1 ? 0.4 : 1 }}>⬇️</button>
                    <button className="ctrl-btn"
                      onClick={() => { if (window.confirm("¿Eliminar este elemento?")) { eliminarDeLista(i); setMenuItemAbierto(null) } }}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🗑️</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  </div>
</div>
</>
)
}