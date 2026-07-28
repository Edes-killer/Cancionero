// ── Cliente de OBS Studio vía obs-websocket v5 ───────────────────────────────
// Selah = "director": se conecta a OBS (que corre en el mismo PC por defecto) y
// controla escenas y la transmisión. OBS 28+ trae obs-websocket incorporado
// (Herramientas → Configuración de obs-websocket → activar servidor).
//
// NO transmitimos nosotros: OBS hace el encoding/streaming. Esto solo manda
// órdenes por WebSocket, así que es liviano (importante para el i3 de la iglesia).

import OBSWebSocket from "obs-websocket-js"

export interface ConfigOBS {
  host: string      // normalmente "localhost"
  puerto: number    // por defecto 4455
  password: string  // el que puso el usuario en OBS (puede ir vacío)
}

export interface EstadoOBS {
  conectado: boolean
  transmitiendo: boolean
  grabando: boolean
  escenaActual: string
  escenas: string[]
  error: string | null
}

export const CONFIG_OBS_DEFAULT: ConfigOBS = { host: "localhost", puerto: 4455, password: "" }

const KEY_CONFIG = "selah-obs-config"

export function guardarConfigOBS(c: ConfigOBS) {
  try { localStorage.setItem(KEY_CONFIG, JSON.stringify(c)) } catch {}
}

export function leerConfigOBS(): ConfigOBS {
  try {
    const raw = localStorage.getItem(KEY_CONFIG)
    if (raw) return { ...CONFIG_OBS_DEFAULT, ...JSON.parse(raw) }
  } catch {}
  return { ...CONFIG_OBS_DEFAULT }
}

// ── Gestor de conexión ────────────────────────────────────────────────────────
// Una sola instancia. Emite cambios de estado vía callback para que el panel de
// React se actualice.
export class GestorOBS {
  private obs = new OBSWebSocket()
  private onEstado: (e: EstadoOBS) => void
  estado: EstadoOBS = {
    conectado: false, transmitiendo: false, grabando: false,
    escenaActual: "", escenas: [], error: null,
  }

  constructor(onEstado: (e: EstadoOBS) => void) {
    this.onEstado = onEstado
    this.registrarEventos()
  }

  private emitir() { this.onEstado({ ...this.estado }) }

  private registrarEventos() {
    // OBS avisa cuando cambian cosas → reflejarlo sin tener que preguntar.
    this.obs.on("CurrentProgramSceneChanged", (d: any) => {
      this.estado.escenaActual = d.sceneName; this.emitir()
    })
    this.obs.on("SceneListChanged", (d: any) => {
      this.estado.escenas = (d.scenes || []).map((s: any) => s.sceneName).reverse()
      this.emitir()
    })
    this.obs.on("StreamStateChanged", (d: any) => {
      this.estado.transmitiendo = !!d.outputActive; this.emitir()
    })
    this.obs.on("RecordStateChanged", (d: any) => {
      this.estado.grabando = !!d.outputActive; this.emitir()
    })
    this.obs.on("ConnectionClosed", () => {
      this.estado.conectado = false; this.emitir()
    })
  }

  async conectar(cfg: ConfigOBS): Promise<boolean> {
    this.estado.error = null
    try {
      const url = `ws://${cfg.host}:${cfg.puerto}`
      await this.obs.connect(url, cfg.password || undefined)
      this.estado.conectado = true
      await this.refrescarTodo()
      this.emitir()
      return true
    } catch (e: any) {
      this.estado.conectado = false
      this.estado.error = this.mensajeError(e)
      this.emitir()
      return false
    }
  }

  private mensajeError(e: any): string {
    const msg = (e?.message || String(e)).toLowerCase()
    if (msg.includes("authentication") || msg.includes("auth"))
      return "Contraseña incorrecta. Revisa la contraseña de obs-websocket en OBS."
    if (msg.includes("econnrefused") || msg.includes("failed to connect") || msg.includes("closed before"))
      return "No se pudo conectar. ¿Está OBS abierto y el servidor de obs-websocket activado?"
    return e?.message || "No se pudo conectar con OBS."
  }

  async desconectar() {
    try { await this.obs.disconnect() } catch {}
    this.estado.conectado = false
    this.emitir()
  }

  private async refrescarTodo() {
    const escenas = await this.obs.call("GetSceneList")
    this.estado.escenas = (escenas.scenes || []).map((s: any) => s.sceneName).reverse()
    this.estado.escenaActual = (escenas as any).currentProgramSceneName || ""
    try {
      const stream = await this.obs.call("GetStreamStatus")
      this.estado.transmitiendo = !!(stream as any).outputActive
    } catch {}
    try {
      const rec = await this.obs.call("GetRecordStatus")
      this.estado.grabando = !!(rec as any).outputActive
    } catch {}
  }

  async cambiarEscena(nombre: string) {
    await this.obs.call("SetCurrentProgramScene", { sceneName: nombre })
  }

  async iniciarTransmision() { await this.obs.call("StartStream") }
  async detenerTransmision() { await this.obs.call("StopStream") }
  async iniciarGrabacion() { await this.obs.call("StartRecord") }
  async detenerGrabacion() { await this.obs.call("StopRecord") }
}
