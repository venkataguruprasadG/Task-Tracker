const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');

const APP_ID = 'com.dailystudy.academictasktracker';
let mainWindow = null;
let savedNormalBounds = null;
let isMiniMode = false;

// Prevent multiple instances so an active study timer stays in one window
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    title: 'Daily Study — Academic Task Tracker',
    backgroundColor: '#F7F8FA',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    isMiniMode = false;
  });
}

ipcMain.handle('window:set-mini-mode', (_event, enable) => {
  if (!mainWindow) return false;
  const nextMini = Boolean(enable);
  if (nextMini === isMiniMode) return isMiniMode;

  if (nextMini) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    savedNormalBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(savedNormalBounds);
    const workArea = display.workArea;
    const miniWidth = 370;
    const miniHeight = 168;
    const targetX = Math.max(workArea.x, workArea.x + workArea.width - miniWidth - 20);
    const targetY = Math.max(workArea.y, workArea.y + workArea.height - miniHeight - 20);

    mainWindow.setMinimumSize(320, 148);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setBounds(
      { x: targetX, y: targetY, width: miniWidth, height: miniHeight },
      true
    );
    isMiniMode = true;
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(820, 620);
    if (savedNormalBounds) {
      mainWindow.setBounds(savedNormalBounds, true);
    } else {
      mainWindow.setSize(1240, 820, true);
      mainWindow.center();
    }
    isMiniMode = false;
  }

  return isMiniMode;
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_ID);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
