export interface FondoConfig {
  tipo: "url" | "preset" | "color"
  url?: string
  preset?: string
  color?: string
  oscuridad?: number
  ajuste?: string
}

export interface Cancion {
  id: string
  titulo: string
  tono?: string
  categoria?: string
  iglesia_id?: string | null
  numero?: number
  texto_busqueda?: string
  fecha_creacion?: string
}

export interface Parte {
  id?: string
  cancion_id?: string
  tipo: string
  texto: string
  texto_letra?: string
  texto_acordes?: string | null
  tiene_acordes?: boolean
  orden?: number
}

export interface ItemLista {
  id?: string
  tipo?: "cancion" | "biblia" | "imagen" | "video" | "carrusel" | "mensaje" | "espera" | "estado" | string
  cancion_id?: string
  lista_id?: string
  titulo?: string
  subtitulo?: string
  tono?: string
  categoria?: string
  partes?: Parte[]
  orden?: number
  url?: string
  texto?: string
  modo?: string
  estado_subtitulo?: string
  fondo?: FondoConfig | null
  referencia?: string
  referencia_biblica?: string
  paginas?: string[]
  urls?: string[]
  seg?: number
  imagen_url?: string | null
  estado_url?: string | null
}

export interface CultoData {
  id: string
  nombre?: string
  fecha?: string
  iglesia_id?: string
}

export interface DatosCargaCancion {
  id?: string
  titulo: string
  tono?: string
  partes: Parte[]
  fondo?: FondoConfig | null
  index?: number
  iglesia?: string
  album?: string
}

export interface MediaGaleria {
  url: string
  nombre: string
  local: boolean
  carpeta: string
}

export function firmaCultoEditable(items: ItemLista[], nombre: string): string {
  return JSON.stringify({ items, nombre: nombre || "" })
}
