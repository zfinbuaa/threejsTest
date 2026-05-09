const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadShellModels: (callback) => ipcRenderer.on('load-shell-models', (_, paths) => callback(paths)),
  onLoadPartModels: (callback) => ipcRenderer.on('load-part-models', (_, paths) => callback(paths)),
  onResetCamera: (callback) => ipcRenderer.on('reset-camera', () => callback()),
  onViewFront: (callback) => ipcRenderer.on('view-front', () => callback()),
  onViewTop: (callback) => ipcRenderer.on('view-top', () => callback()),
  onViewSide: (callback) => ipcRenderer.on('view-side', () => callback()),
  onSwitchMode: (callback) => ipcRenderer.on('switch-mode', (_, mode) => callback(mode)),
  savePNG: (dataUrl) => ipcRenderer.invoke('save-png', dataUrl),
});
