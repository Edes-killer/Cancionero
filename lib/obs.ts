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

// Una fuente dentro de la escena al aire (cámara, logo, banner, texto...).
export interface FuenteEscena {
  id: number        // sceneItemId (único dentro de la escena)
  nombre: string    // sourceName
  visible: boolean  // sceneItemEnabled
  tipo: string      // inputKind (para poner un icono adecuado)
}

// Una fuente de audio (micrófono, audio del PC, música...).
export interface FuenteAudio {
  nombre: string
  silenciado: boolean
  db: number        // volumen en dB (informativo)
}

export interface EstadoOBS {
  conectado: boolean
  transmitiendo: boolean
  grabando: boolean
  escenaActual: string
  escenas: string[]
  fuentes: FuenteEscena[]   // fuentes de la escena al aire
  audios: FuenteAudio[]     // fuentes de audio
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
    escenaActual: "", escenas: [], fuentes: [], audios: [], error: null,
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
      // La escena al aire cambió → sus fuentes son otras.
      this.refrescarFuentes().catch(() => {})
    })
    this.obs.on("SceneListChanged", (d: any) => {
      this.estado.escenas = (d.scenes || []).map((s: any) => s.sceneName).reverse()
      this.emitir()
    })
    // Una fuente se mostró/ocultó (desde OBS o desde aquí) → reflejarlo.
    this.obs.on("SceneItemEnableStateChanged", (d: any) => {
      if (d.sceneName !== this.estado.escenaActual) return
      const f = this.estado.fuentes.find(x => x.id === d.sceneItemId)
      if (f) { f.visible = !!d.sceneItemEnabled; this.emitir() }
    })
    // Un audio se silenció/activó → reflejarlo.
    this.obs.on("InputMuteStateChanged", (d: any) => {
      const a = this.estado.audios.find(x => x.nombre === d.inputName)
      if (a) { a.silenciado = !!d.inputMuted; this.emitir() }
    })
    this.obs.on("StreamStateChanged", (d: any) => {
      this.estado.transmitiendo = !!d.outputActive; this.emitir()
    })
    this.obs.on("RecordStateChanged", (d: any) => {
      this.estado.grabando = !!d.outputActive; this.emitir()
    })
    this.obs.on("ConnectionClosed", () => {
      this.estado.conectado = false
      this.estado.fuentes = []; this.estado.audios = []
      this.emitir()
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
    await this.refrescarFuentes()
    await this.refrescarAudio()
  }

  async cambiarEscena(nombre: string) {
    await this.obs.call("SetCurrentProgramScene", { sceneName: nombre })
  }

  // ── Fuentes de la escena al aire ─────────────────────────────────────────
  async refrescarFuentes() {
    if (!this.estado.escenaActual) { this.estado.fuentes = []; this.emitir(); return }
    try {
      const r: any = await this.obs.call("GetSceneItemList", { sceneName: this.estado.escenaActual })
      // OBS los entrega de abajo hacia arriba; invertimos para que el orden
      // coincida con lo que el usuario ve en la lista de fuentes de OBS.
      this.estado.fuentes = (r.sceneItems || [])
        .map((it: any) => ({
          id: it.sceneItemId,
          nombre: it.sourceName,
          visible: !!it.sceneItemEnabled,
          tipo: it.inputKind || (it.isGroup ? "group" : ""),
        }))
        .reverse()
      this.emitir()
    } catch { /* la escena puede no permitir listar (ej. escena de grupo) */ }
  }

  async alternarFuente(id: number, visible: boolean) {
    await this.obs.call("SetSceneItemEnabled", {
      sceneName: this.estado.escenaActual, sceneItemId: id, sceneItemEnabled: visible,
    })
    const f = this.estado.fuentes.find(x => x.id === id)
    if (f) { f.visible = visible; this.emitir() }
  }

  // ── Audio ────────────────────────────────────────────────────────────────
  async refrescarAudio() {
    try {
      const r: any = await this.obs.call("GetInputList")
      const audios: FuenteAudio[] = []
      for (const inp of (r.inputs || [])) {
        // Una fuente es "de audio" si responde a GetInputMute; así no
        // dependemos de una lista fija de tipos por sistema operativo.
        try {
          const m: any = await this.obs.call("GetInputMute", { inputName: inp.inputName })
          let db = 0
          try { const v: any = await this.obs.call("GetInputVolume", { inputName: inp.inputName }); db = v.inputVolumeDb } catch {}
          audios.push({ nombre: inp.inputName, silenciado: !!m.inputMuted, db })
        } catch { /* no es fuente de audio */ }
      }
      this.estado.audios = audios
      this.emitir()
    } catch {}
  }

  async alternarSilencio(nombre: string) {
    await this.obs.call("ToggleInputMute", { inputName: nombre })
    // El evento InputMuteStateChanged actualizará el estado real.
  }

  // ── Vista previa en vivo ──────────────────────────────────────────────────
  // Devuelve un data-URL (jpg) de la escena al aire, o null si no se pudo.
  async capturarEscena(anchoPx = 480): Promise<string | null> {
    if (!this.estado.escenaActual) return null
    try {
      const r: any = await this.obs.call("GetSourceScreenshot", {
        sourceName: this.estado.escenaActual,
        imageFormat: "jpg",
        imageWidth: anchoPx,
        imageCompressionQuality: 55,
      })
      return r.imageData || null
    } catch { return null }
  }

  async iniciarTransmision() { await this.obs.call("StartStream") }
  async detenerTransmision() { await this.obs.call("StopStream") }
  async iniciarGrabacion() { await this.obs.call("StartRecord") }
  async detenerGrabacion() { await this.obs.call("StopRecord") }
}
