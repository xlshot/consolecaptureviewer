const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  setFullscreen: (v) => ipcRenderer.send('set-fullscreen', v),
  toggleOnTop: () => ipcRenderer.send('toggle-ontop'),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (_e, v) => cb(v)),
  saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  onUpdate: (cb) => ipcRenderer.on('update-status', (_e, v) => cb(v)),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s)
});
