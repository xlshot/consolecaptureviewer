const { app, BrowserWindow, ipcMain, session, dialog, powerSaveBlocker, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Lower-latency rendering: don't throttle, keep GPU decode on.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-features', 'WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win;
let blockerId = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#000000',
    title: 'Console Capture Viewer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
}

app.whenReady().then(() => {
  // Only allow camera/mic/fullscreen for our own window.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'fullscreen'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission) => {
    return ['media', 'fullscreen'].includes(permission);
  });

  // Keep the PC/display awake while playing.
  blockerId = powerSaveBlocker.start('prevent-display-sleep');

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
  app.quit();
});

ipcMain.on('toggle-fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on('set-fullscreen', (_e, v) => { if (win) win.setFullScreen(!!v); });
ipcMain.on('toggle-ontop', () => { if (win) win.setAlwaysOnTop(!win.isAlwaysOnTop()); });

// Save a file (screenshot / recording) chosen via dialog.
ipcMain.handle('save-file', async (_e, { suggestedName, filters, data }) => {
  const defaultPath = path.join(app.getPath('videos'), suggestedName);
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath, filters });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, Buffer.from(data));
  return filePath;
});

// Settings persistence in userData.
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
ipcMain.handle('load-settings', () => {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
});
ipcMain.handle('save-settings', (_e, s) => {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)); } catch {}
});
