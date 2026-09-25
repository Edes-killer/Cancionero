export type AccionCultoRemota = "guardado" | "eliminado"
export type ResolucionCambioCulto = "recargar" | "avisar" | "conservar_borrador" | "solo_catalogo"

const CAMPOS_ITEM_PERSISTIDO = [
  "orden", "cancion_id", "tipo", "imagen_url", "referencia_biblica",
  "texto_biblico", "estado_modo", "estado_titulo", "estado_subtitulo", "estado_url",
] as const

/**
 * Firma únicamente los campos que realmente se almacenan en items_lista.
 * Ignora ids internos y metadatos que Supabase pueda agregar a la respuesta.
 */
export function firmaItemsPersistidos(items: Record<string, unknown>[]): string {
  return JSON.stringify(items.map(item => Object.fromEntries(
    CAMPOS_ITEM_PERSISTIDO.map(campo => [campo, item[campo] ?? null])
  )))
}

export function hayConflictoCultoPersistido(firmaBase: string, firmaActual: string): boolean {
  return firmaBase.length > 0 && firmaBase !== firmaActual
}

export function resolverCambioCultoRemoto(params: {
  accion: AccionCultoRemota
  mismaLista: boolean
  hayCambiosLocales: boolean
  enProyeccion: boolean
}): ResolucionCambioCulto {
  const { accion, mismaLista, hayCambiosLocales, enProyeccion } = params
  if (!mismaLista) return "solo_catalogo"
  if (accion === "eliminado") return "conservar_borrador"
  if (hayCambiosLocales || enProyeccion) return "avisar"
  return "recargar"
}
