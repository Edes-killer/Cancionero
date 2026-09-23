const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('qaCaptura', {
  enviar: bytes => ipcRenderer.invoke('qa:fragmento', bytes),
})
