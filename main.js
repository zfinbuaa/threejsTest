const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let modelsPath;

function getModelsPath() {
  if (modelsPath) return modelsPath;
  const exeDir = path.dirname(app.getPath('exe'));
  const candidate = path.join(exeDir, 'models');
  const fs = require('fs');
  if (fs.existsSync(candidate)) {
    modelsPath = candidate;
  } else {
    modelsPath = exeDir;
  }
  return modelsPath;
}

function autoLoadModels() {
  const fs = require('fs');
  const baseDir = getModelsPath();

  // Scan shells directory
  const shellsDir = path.join(baseDir, 'shells');
  let shellFiles = [];
  if (fs.existsSync(shellsDir)) {
    shellFiles = fs.readdirSync(shellsDir)
      .filter(f => /\.(wrl|vrml)$/i.test(f))
      .map(f => path.join(shellsDir, f));
  }

  // Scan parts directory
  const partsDir = path.join(baseDir, 'parts');
  let partFiles = [];
  if (fs.existsSync(partsDir)) {
    partFiles = fs.readdirSync(partsDir)
      .filter(f => /\.(wrl|vrml)$/i.test(f))
      .map(f => path.join(partsDir, f));
  }

  // Send to renderer once ready
  const sendModels = () => {
    if (shellFiles.length > 0) {
      mainWindow.webContents.send('load-shell-models', shellFiles);
    }
    if (partFiles.length > 0) {
      mainWindow.webContents.send('load-part-models', partFiles);
    }
    if (shellFiles.length === 0 && partFiles.length === 0) {
      mainWindow.webContents.send('no-auto-models');
    }
  };

  // Wait for renderer to be ready
  mainWindow.webContents.on('did-finish-load', sendModels);
  // Fallback: if already loaded
  if (mainWindow.webContents.isLoading() === false) {
    sendModels();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '3D模型可视化工具 - 位置图 / 爆炸图',
  });

  mainWindow.loadFile('index.html');

  // Auto-load models from models/shells/ and models/parts/
  autoLoadModels();

  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '加载车壳模型',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '选择车壳VRML模型',
              defaultPath: getModelsPath(),
              filters: [{ name: 'VRML', extensions: ['wrl', 'vrml'] }],
              properties: ['openFile', 'multiSelections'],
            });
            if (!result.canceled) {
              mainWindow.webContents.send('load-shell-models', result.filePaths);
            }
          },
        },
        {
          label: '加载目标部件',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '选择目标部件VRML模型',
              defaultPath: getModelsPath(),
              filters: [{ name: 'VRML', extensions: ['wrl', 'vrml'] }],
              properties: ['openFile', 'multiSelections'],
            });
            if (!result.canceled) {
              mainWindow.webContents.send('load-part-models', result.filePaths);
            }
          },
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重置相机', click: () => mainWindow.webContents.send('reset-camera') },
        { label: '正视', click: () => mainWindow.webContents.send('view-front') },
        { label: '俯视', click: () => mainWindow.webContents.send('view-top') },
        { label: '侧视', click: () => mainWindow.webContents.send('view-side') },
      ],
    },
    {
      label: '模式',
      submenu: [
        {
          label: '位置图模式',
          type: 'radio',
          checked: true,
          click: () => mainWindow.webContents.send('switch-mode', 'position'),
        },
        {
          label: '爆炸图模式',
          type: 'radio',
          checked: false,
          click: () => mainWindow.webContents.send('switch-mode', 'explosion'),
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '3D模型可视化工具 v1.0\n基于 Three.js + Electron',
              detail: '支持VRML模型的位置图与爆炸图渲染导出',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || '选择文件',
    defaultPath: getModelsPath(),
    filters: options.filters || [{ name: 'VRML', extensions: ['wrl', 'vrml'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('save-png', async (event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出PNG图片',
    defaultPath: 'output.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (!result.canceled) {
    const fs = require('fs');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(result.filePath, base64Data, 'base64');
    return result.filePath;
  }
  return null;
});
