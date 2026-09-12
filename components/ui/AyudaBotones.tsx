"use client"

import { useEffect, useRef, useState } from "react"

type Ayuda = { texto: string; x: number; y: number; arriba: boolean }

const EXPLICACIONES: Array<[RegExp, string]> = [
  [/revisar (salida|culto)/i, "Comprueba que todo esté listo antes de comenzar."],
  [/salir en vivo|iniciar transmisi[oó]n/i, "Comienza a enviar la señal a los destinos configurados."],
  [/terminar transmisi[oó]n/i, "Detiene la emisión en todos los destinos activos."],
  [/grabar.*culto/i, "Activa o desactiva la grabación local mientras transmites."],
  [/grabar/i, "Guarda en este computador una copia de la salida actual."],
  [/abrir.*proyector|proyector$/i, "Abre la salida que verá la congregación, normalmente en el segundo monitor."],
  [/proyectar ahora|proyectar$/i, "Muestra inmediatamente este contenido en la pantalla de proyección."],
  [/vista previa.*m[uú]sicos/i, "Muestra cómo verán la letra y los acordes quienes usan Vista Músicos."],
  [/vista previa.*proyecci[oó]n/i, "Muestra cómo se dividirá y verá la letra en el proyector antes de guardarla."],
  [/vista previa/i, "Permite revisar el contenido sin mostrarlo todavía al público."],
  [/agregar a la lista/i, "Añade este elemento al orden del culto."],
  [/nueva canci[oó]n/i, "Abre el editor para crear una canción propia de esta iglesia."],
  [/editar/i, "Abre este elemento para modificar sus datos."],
  [/renombrar/i, "Cambia el nombre visible sin modificar el archivo original."],
  [/duplicar/i, "Crea una copia independiente de este elemento."],
  [/mover.*arriba|subir elemento|^↑$/i, "Mueve este elemento una posición hacia arriba."],
  [/mover.*abajo|bajar elemento|^↓$/i, "Mueve este elemento una posición hacia abajo."],
  [/m[aá]s opciones|^⋮$/i, "Muestra acciones adicionales para este elemento."],
  [/detectar tono/i, "Busca el primer acorde escrito y propone ese tono para la canción."],
  [/editor de acordes|acordes/i, "Abre las herramientas para insertar acordes en esta parte de la canción."],
  [/anterior/i, "Vuelve a la parte o elemento anterior."],
  [/siguiente/i, "Avanza a la parte o elemento siguiente."],
  [/subir|cambiar logo/i, "Selecciona un archivo compatible y lo guarda para usarlo en Selah."],
  [/importar.*powerpoint|importar ppt/i, "Convierte contenido de PowerPoint para incorporarlo a Selah."],
  [/carrusel/i, "Permite seleccionar varios recursos y reproducirlos en el orden elegido."],
  [/repetir coro/i, "Intercala automáticamente el coro después de cada estrofa."],
  [/guardar armado/i, "Guarda las posiciones y tamaños actuales del diseño."],
  [/restaurar/i, "Recupera la última disposición guardada."],
  [/resetear posiciones/i, "Devuelve todos los elementos a su posición original."],
  [/elegir pantalla/i, "Selecciona una ventana o monitor para incorporarlo a la emisión."],
  [/conectar celular/i, "Vincula la cámara de un teléfono por la red local."],
  [/desconectar/i, "Finaliza la conexión con el dispositivo actual."],
  [/iniciar cuenta/i, "Inicia la cuenta regresiva de la pantalla de espera."],
  [/quitar contador/i, "Oculta y cancela la cuenta regresiva actual."],
  [/mostrar.*mensaje|ocultar.*mensaje/i, "Muestra u oculta el mensaje escrito sobre la emisión."],
  [/usar obs/i, "Abre el módulo de integración avanzada con OBS Studio."],
  [/abrir carpeta/i, "Abre la carpeta donde Selah guarda las grabaciones."],
  [/copiar/i, "Copia esta información al portapapeles."],
  [/generar link/i, "Crea una invitación para que otra persona se una con el rol seleccionado."],
  [/quitar pin/i, "Desactiva la protección por PIN para los controles de esta sala."],
  [/guardar.*pin/i, "Guarda el PIN que deberán ingresar los dispositivos de control."],
  [/buscar.*autom[aá]ticamente/i, "Busca computadores con Selah disponibles en la red local."],
  [/buscar actualizaciones/i, "Consulta GitHub para comprobar si existe una versión más reciente de Selah."],
  [/ver tour/i, "Reinicia y abre la guía paso a paso de esta pantalla."],
  [/diagnosticar/i, "Ejecuta pruebas de conexión y registra los resultados."],
  [/afin(ar|ador)/i, "Abre el afinador usando el micrófono del dispositivo."],
  [/improvisar/i, "Muestra escalas y notas recomendadas para el tono actual."],
  [/ensayo|metr[oó]nomo/i, "Abre el metrónomo y la nota de partida."],
  [/ajustes|configuraci[oó]n/i, "Abre las opciones disponibles para esta pantalla."],
  [/cerrar sesi[oó]n|salir$/i, "Cierra tu sesión en este dispositivo y vuelve al ingreso."],
  [/cerrar|cancelar|volver/i, "Cierra esta vista sin ejecutar la acción pendiente."],
  [/guardar canci[oó]n|actualizar canci[oó]n/i, "Valida la información y guarda la canción y todas sus partes."],
  [/guardar culto|guardar lista/i, "Guarda el orden actual para poder recuperarlo en otro momento."],
  [/guardar/i, "Conserva los cambios realizados en esta sección."],
  [/eliminar|borrar|quitar/i, "Elimina este elemento. Selah pedirá confirmación si es necesario."],
  [/reintentar/i, "Vuelve a ejecutar la operación que no pudo completarse."],
]

const EXPLICACIONES_ICONOS: Record<string, string> = {
  "✕": "Cierra este panel o quita el elemento al que pertenece.",
  "×": "Cierra este panel o quita el elemento al que pertenece.",
  "+": "Agrega este contenido a la sección o lista actual.",
  "▶": "Inicia o muestra inmediatamente el elemento seleccionado.",
  "⋮": "Abre más acciones disponibles para este elemento.",
  "↑": "Mueve este elemento una posición hacia arriba.",
  "↓": "Mueve este elemento una posición hacia abajo.",
  "⧉": "Crea una copia de este elemento para editarla por separado.",
  "📱": "Abre una vista previa sin cambiar lo que está proyectado.",
  "🎸": "Cambia a la vista con información para músicos.",
}

function limpiar(texto: string) {
  return texto.replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+/u, "").trim()
}

function descripcion(el: HTMLElement) {
  const propia = el.dataset.ayuda?.trim()
  if (propia) return propia

  const title = el.getAttribute("title")?.trim() || ""
  const aria = el.getAttribute("aria-label")?.trim() || ""
  const visibleCrudo = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim()
  const visible = limpiar(visibleCrudo)

  // Un title largo normalmente ya fue escrito como explicación específica.
  if (title.length >= 32 || /[.!?]/.test(title)) return title

  // Los textos cortos ("Cerrar", "Vista previa", "Renombrar") son nombres,
  // no explicaciones: se traducen con el catálogo antes de mostrarlos.
  const identidad = [aria, title, visible].filter(Boolean).join(" · ")
  const encontrada = EXPLICACIONES.find(([patron]) => patron.test(identidad))
  if (encontrada) return encontrada[1]

  if (!aria && !title && EXPLICACIONES_ICONOS[visibleCrudo]) return EXPLICACIONES_ICONOS[visibleCrudo]

  const nombre = aria || title || visible
  if (!nombre) return "Ejecuta la acción disponible en este control."
  return `Selecciona “${limpiar(nombre).slice(0, 70)}” para aplicar esa opción.`
}

export default function AyudaBotones() {
  const [ayuda, setAyuda] = useState<Ayuda | null>(null)
  const [habilitada, setHabilitada] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activo = useRef<{ el: HTMLElement; title: string | null } | null>(null)

  useEffect(() => {
    const leerPreferencia = () => {
      const guardada = localStorage.getItem("selah-ayudas-contextuales")
      // En pantallas táctiles se prioriza una interfaz limpia. En escritorio,
      // la ayuda queda disponible hasta que el usuario decida ocultarla.
      const tactil = !!(window as any).Capacitor || window.matchMedia("(pointer: coarse)").matches
      setHabilitada(guardada === null ? !tactil : guardada === "1")
    }
    leerPreferencia()
    window.addEventListener("storage", leerPreferencia)
    window.addEventListener("selah-preferencias", leerPreferencia)
    return () => {
      window.removeEventListener("storage", leerPreferencia)
      window.removeEventListener("selah-preferencias", leerPreferencia)
    }
  }, [])

  useEffect(() => {
    if (!habilitada) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      setAyuda(null)
      return
    }
    const ocultar = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      if (activo.current?.title) activo.current.el.setAttribute("title", activo.current.title)
      activo.current = null
      setAyuda(null)
    }
    const mostrar = (el: HTMLElement) => {
      ocultar()
      const texto = descripcion(el)
      const title = el.getAttribute("title")
      if (title) el.removeAttribute("title")
      activo.current = { el, title }
      timer.current = setTimeout(() => {
        const r = el.getBoundingClientRect()
        const arriba = r.bottom + 110 > innerHeight
        setAyuda({ texto, x: Math.max(12, Math.min(innerWidth - 12, r.left + r.width / 2)), y: arriba ? r.top - 9 : r.bottom + 9, arriba })
      }, 420)
    }
    const encontrar = (target: EventTarget | null) => target instanceof Element
      ? target.closest<HTMLElement>("button, [role='button'], input[type='button'], input[type='submit'], nav a")
      : null
    const over = (e: PointerEvent) => {
      const el = encontrar(e.target)
      if (el && activo.current?.el !== el) mostrar(el)
    }
    const out = (e: PointerEvent) => {
      const el = encontrar(e.target)
      if (el && (!e.relatedTarget || !el.contains(e.relatedTarget as Node))) ocultar()
    }
    const focus = (e: FocusEvent) => { const el = encontrar(e.target); if (el) mostrar(el) }
    document.addEventListener("pointerover", over)
    document.addEventListener("pointerout", out)
    document.addEventListener("focusin", focus)
    document.addEventListener("focusout", ocultar)
    document.addEventListener("pointerdown", ocultar)
    return () => {
      ocultar()
      document.removeEventListener("pointerover", over)
      document.removeEventListener("pointerout", out)
      document.removeEventListener("focusin", focus)
      document.removeEventListener("focusout", ocultar)
      document.removeEventListener("pointerdown", ocultar)
    }
  }, [habilitada])

  if (!habilitada || !ayuda) return null
  return <div role="tooltip" style={{
    position:"fixed", left:ayuda.x, top:ayuda.y, zIndex:100000, transform:ayuda.arriba ? "translate(-50%,-100%)" : "translateX(-50%)",
    maxWidth:290, padding:"8px 11px", borderRadius:9, pointerEvents:"none",
    background:"#111827", color:"#f8fafc", border:"1px solid rgba(255,255,255,.18)",
    boxShadow:"0 10px 30px rgba(0,0,0,.48)", fontSize:12, lineHeight:1.4, fontWeight:600,
  }}>{ayuda.texto}</div>
}
