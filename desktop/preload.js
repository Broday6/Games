// Bridge between the sandboxed game page and the Electron main process: lets the lobby open a port on this computer so
// friends can connect by address. Only these few calls are exposed; the page never gets Node access.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('__ELECTRON', true);
contextBridge.exposeInMainWorld('driftwoodNative', {
  listen: (port) => ipcRenderer.invoke('host-listen', port),
  stop: () => ipcRenderer.invoke('host-stop'),
  send: (id, data) => ipcRenderer.send('host-send', id, data),
  kick: (id) => ipcRenderer.send('host-kick', id),
  on: (cb) => { ipcRenderer.on('host-event', (e, ev) => cb(ev)); },
});
