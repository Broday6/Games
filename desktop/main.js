// Driftwood desktop shell: a single Electron window around the bundled game (game.html is produced by `npm run prepare-game`).
const { app, BrowserWindow, shell, Menu, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { createServer, lanAddresses } = require('./wsserver.js');

app.commandLine.appendSwitch('ignore-gpu-blocklist'); // WebGL on older/integrated GPUs
app.commandLine.appendSwitch('enable-features', 'PointerLockOptions');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    title: 'Driftwood', backgroundColor: '#0b1020', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'editMenu' }])); // hidden menu bar, but copy/paste shortcuts keep working in the room-code fields
  win.loadFile(path.join(__dirname, 'game.html'));
  win.once('ready-to-show', () => { win.show(); });
  // test hook: DRIFTWOOD_SHOT=/path.png makes the app screenshot itself after a few seconds and quit (used by CI smoke tests)
  if (process.env.DRIFTWOOD_SHOT) win.webContents.once('did-finish-load', () => setTimeout(async () => { try { const img = await win.webContents.capturePage(); require('fs').writeFileSync(process.env.DRIFTWOOD_SHOT, img.toPNG()); } catch (e) { console.error(e); } app.quit(); }, 4000));
  // links (licence notes etc.) open in the system browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // F11 toggles fullscreen, Alt+Enter too; Esc is left to the game (pause menu / pointer unlock)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  return win;
}

// ---- "Host on this computer": a WebSocket server in the main process, relayed to the game page through the preload bridge ----
// The same port also serves the game page itself, so a friend on the LAN can just open http://<ip>:<port>/ in a browser.
let hostServer = null; const hostSockets = {}; let nextSock = 1;
function stopHosting() { for (const id in hostSockets) { try { hostSockets[id].close(); } catch (e) { } delete hostSockets[id]; } if (hostServer) { try { hostServer.close(); } catch (e) { } hostServer = null; } }
ipcMain.handle('host-listen', (e, port) => new Promise((resolve) => {
  const win = BrowserWindow.fromWebContents(e.sender); if (!win) return resolve({ ok: false, error: 'no window' });
  stopHosting(); port = (port | 0) || 7777;
  const srv = createServer({
    file: path.join(__dirname, 'game.html'), inject: '<script>window.__SERVER_ADDR = true; window.__SERVER_NAME = "a friend\'s Driftwood";</script>',
    health: () => ({ ok: true, name: 'Driftwood desktop host', players: Object.keys(hostSockets).length }),
    onSocket: (ws) => {
      const id = 'd' + (nextSock++).toString(36) + Math.random().toString(36).slice(2, 5); hostSockets[id] = ws;
      const send = (ev) => { try { if (!win.isDestroyed()) win.webContents.send('host-event', ev); } catch (err) { } };
      ws.onmessage = (data) => send({ type: 'message', id, data });
      ws.onclose = () => { delete hostSockets[id]; send({ type: 'close', id }); };
      send({ type: 'open', id });
    },
  });
  srv.on('error', (err) => { hostServer = null; resolve({ ok: false, error: err.code === 'EADDRINUSE' ? 'port ' + port + ' is already in use' : err.message }); });
  srv.listen(port, () => { hostServer = srv; resolve({ ok: true, port, addrs: lanAddresses(), publicHint: 'Internet friends: forward TCP port ' + port + ' to this computer and give them your public IP, or run a tunnel (e.g. cloudflared) and share its address.' }); });
}));
ipcMain.handle('host-stop', () => { stopHosting(); return true; });
ipcMain.on('host-send', (e, id, data) => { const ws = hostSockets[id]; if (ws) ws.send(String(data)); });
ipcMain.on('host-kick', (e, id) => { const ws = hostSockets[id]; if (ws) ws.close(); });
app.on('before-quit', stopHosting);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
