const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setMiniMode: (enabled) => ipcRenderer.invoke('window:set-mini-mode', Boolean(enabled)),
});
