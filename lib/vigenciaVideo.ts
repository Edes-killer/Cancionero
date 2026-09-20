/** Vigila cuadros, no movimiento de la imagen: una cámara quieta sigue enviando cuadros. */
export class VigenciaVideo {
  private ultimoContador: number | null = null
  private ultimoCuadro = 0
  private recuperandoDesde: number | null = null
  private perdida = false

  actualizar(ahora: number, cuadros: number | null, disponible: boolean): boolean {
    if (!disponible) {
      this.perdida = true; this.recuperandoDesde = null; this.ultimoContador = null
      return false
    }
    // Sin contador fiable no afirmar que hay congelación; sí comprobar pista y readyState.
    if (cuadros === null || !Number.isFinite(cuadros)) {
      if (this.recuperandoDesde === null) this.recuperandoDesde = ahora
      if (ahora - this.recuperandoDesde >= 1000) this.perdida = false
      return !this.perdida
    }
    if (this.ultimoContador === null || cuadros !== this.ultimoContador) {
      if (ahora - this.ultimoCuadro >= 250) this.recuperandoDesde = null
      this.ultimoCuadro = ahora
      if (this.recuperandoDesde === null) this.recuperandoDesde = ahora
      this.ultimoContador = cuadros
    }
    if (ahora - this.ultimoCuadro >= 3000) {
      this.perdida = true; this.recuperandoDesde = null
    }
    if (this.perdida && this.recuperandoDesde !== null && ahora - this.recuperandoDesde >= 1000 && ahora - this.ultimoCuadro < 250) {
      this.perdida = false
    }
    return !this.perdida
  }
}
