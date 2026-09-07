"use client"

import { useEffect, useRef, useState } from "react"

type Ayuda = { texto: string; x: number; y: number }

const EXPLICACIONES: Array<[RegExp, string]> = [
  [/revisar (salida|culto)/i, "Comprueba que todo esté listo antes de comenzar."],
  [/salir en vivo|iniciar transmisi[oó]n/i, "Comienza a enviar la señal a los destinos configurados."],
  [/terminar transmisi[oó]n/i, "Detiene la emisión en todos los destinos activos."],
  [/grabar/i, "Guarda en este computador una copia de la salida actual."],
  [/proyectar ahora|proyectar$/i, "Muestra inmediatamente este contenido en la pantalla de proyección."],
  [/vista previa/i, "Permite revisar el contenido sin mostrarlo al público."],
  [/agregar a la lista/i, "Añade este elemento al orden del culto."],
  [/anterior/i, "Vuelve a la parte o elemento anterior."],
  [/siguiente/i, "Avanza a la parte o elemento siguiente."],
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
  [/buscar.*autom[aá]ticamente/i, "Busca computadores con Selah disponibles en la red local."],
  [/diagnosticar/i, "Ejecuta pruebas de conexión y registra los resultados."],
  [/afin(ar|ador)/i, "Abre el afinador usando el micrófono del dispositivo."],
  [/improvisar/i, "Muestra escalas y notas recomendadas para el tono actual."],
  [/ensayo|metr[oó]nomo/i, "Abre el metrónomo y la nota de partida."],
  [/ajustes|configuraci[oó]n/i, "Abre las opciones disponibles para esta pantalla."],
  [/cerrar|cancelar|volver/i, "Cierra esta vista y vuelve a la pantalla anterior."],
  [/guardar/i, "Guarda los cambios realizados."],
  [/eliminar|borrar|quitar/i, "Elimina este elemento. Selah pedirá confirmación si es necesario."],
  [/reintentar/i, "Vuelve a ejecutar la operación que no pudo completarse."],
]

function limpiar(texto: string) {
  return texto.replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+/u, "").trim()
}

function descripcion(el: HTMLElement) {
  const propia = el.dataset.ayuda || el.getAttribute("title") || el.getAttribute("aria-label") || ""
  if (propia.trim()) return propia.trim()
  const nombre = limpiar(el.innerText || el.textContent || "")
  if (!nombre) return "Activa este control."
  const encontrada = EXPLICACIONES.find(([patron]) => patron.test(nombre))
  return encontrada?.[1] || `Activa la opción “${nombre.slice(0, 70)}”.`
}

export default function AyudaBotones() {
  const [ayuda, setAyuda] = useState<Ayuda | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activo = useRef<{ el: HTMLElement; title: string | null } | null>(null)

  useEffect(() => {
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
        setAyuda({ texto, x: Math.max(12, Math.min(innerWidth - 12, r.left + r.width / 2)), y: r.bottom + 9 })
      }, 420)
    }
    const encontrar = (target: EventTarget | null) => target instanceof Element
      ? target.closest<HTMLElement>("button, [role='button'], input[type='button'], input[type='submit']")
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
  }, [])

  if (!ayuda) return null
  return <div role="tooltip" style={{
    position:"fixed", left:ayuda.x, top:ayuda.y, zIndex:100000, transform:"translateX(-50%)",
    maxWidth:290, padding:"8px 11px", borderRadius:9, pointerEvents:"none",
    background:"#111827", color:"#f8fafc", border:"1px solid rgba(255,255,255,.18)",
    boxShadow:"0 10px 30px rgba(0,0,0,.48)", fontSize:12, lineHeight:1.4, fontWeight:600,
  }}>{ayuda.texto}</div>
}
