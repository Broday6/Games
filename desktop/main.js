// Driftwood desktop shell: a single Electron window around the bundled game (game.html is produced by `npm run prepare-game`).
const { app, BrowserWindow, shell, Menu, globalShortcut } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('ignore-gpu-blocklist'); // WebGL on older/integrated GPUs
app.commandLine.appendSwitch('enable-features', 'PointerLockOptions');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    title: 'Driftwood', backgroundColor: '#0b1020', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
