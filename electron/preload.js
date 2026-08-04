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
  enviarChunk: (chunk) => ipcRenderer.send("transmision:chunk", chunk),
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
})