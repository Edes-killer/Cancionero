const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel, ...args) => {
      const allowed = ["check-for-updates"]
      if (allowed.includes(channel)) ipcRenderer.send(channel, ...args)
    }
  }
})

// ── Transmisión en vivo (nativa) ─────────────────────────────────────────────
// Puente para que la pantalla /en-vivo empuje el video a ffmpeg → RTMP.
contextBridge.exposeInMainWorld("transmision", {
  iniciar: (opts) => ipcRenderer.invoke("transmision:iniciar", opts),
  detener: () => ipcRenderer.invoke("transmision:detener"),
  abrirLog: () => ipcRenderer.invoke("transmision:abrirLog"),
  enviarChunk: (chunk) => ipcRenderer.send("transmision:chunk", chunk),
  // Grabación local (respaldo del culto)
  iniciarGrabacion: (opts) => ipcRenderer.invoke("grabacion:iniciar", opts),
  detenerGrabacion: () => ipcRenderer.invoke("grabacion:detener"),
  nuevoSegmentoGrabacion: () => ipcRenderer.invoke("grabacion:nuevoSegmento"),
  enviarChunkGrabacion: (chunk) => ipcRenderer.send("grabacion:chunk", chunk),
  abrirCarpetaGrabaciones: () => ipcRenderer.invoke("grabacion:abrirCarpeta"),
  listarPantallas: () => ipcRenderer.invoke("pantalla:fuentes"),
  infoRedCamara: () => ipcRenderer.invoke("camara:infoRed"),
  onEstado: (cb) => {
    const h = (_e, d) => cb(d)
    ipcRenderer.on("transmision:estado", h)
    return () => ipcRenderer.removeListener("transmision:estado", h)
  },
  onLog: (cb) => {
    const h = (_e, m) => cb(m)
    ipcRenderer.on("transmision:log", h)
    return () => ipcRenderer.removeListener("transmision:log", h)
  },
  onStats: (cb) => {
    const h = (_e, d) => cb(d)
    ipcRenderer.on("transmision:stats", h)
    return () => ipcRenderer.removeListener("transmision:stats", h)
  },
  onGrabacionListo: (cb) => {
    const h = (_e, d) => cb(d)
    ipcRenderer.on("grabacion:listo", h)
    return () => ipcRenderer.removeListener("grabacion:listo", h)
  },
})

// ── Firewall (permitir la conexión del celular por la red local) ─────────────
contextBridge.exposeInMainWorld("firewall", {
  estado: () => ipcRenderer.invoke("firewall:estado"),
  reparar: () => ipcRenderer.invoke("firewall:reparar"),
})

// ── Importar desde PowerPoint ────────────────────────────────────────────────
contextBridge.exposeInMainWorld("powerpoint", {
  elegir: () => ipcRenderer.invoke("ppt:elegir"),
  imagenes: (ruta) => ipcRenderer.invoke("ppt:imagenes", { ruta }),
  diapositivas: (ruta) => ipcRenderer.invoke("ppt:diapositivas", { ruta }),
})