const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel, ...args) => {
      const allowed = ["check-for-updates"]
      if (allowed.includes(channel)) ipcRenderer.send(channel, ...args)
    }
  }
})