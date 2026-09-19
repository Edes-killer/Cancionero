/** Libera también las capturas que Android resuelve después de salir de la pantalla. */
export async function capturaVigente<T extends { getTracks(): { stop(): void }[] }>(
  obtener: () => Promise<T>,
  vigente: () => boolean,
): Promise<T> {
  if (!vigente()) throw new Error("captura-cancelada")
  const stream = await obtener()
  if (!vigente()) {
    stream.getTracks().forEach(track => track.stop())
    throw new Error("captura-cancelada")
  }
  return stream
}
