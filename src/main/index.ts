import { app, BrowserWindow, Menu, nativeTheme, shell, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { handleStreamProtocol, registerSchemePrivileges } from './protocol'
import { warmUpPoToken } from './potoken'

app.setName('Aurora Music')
registerSchemePrivileges()

if (!app.requestSingleInstanceLock()) app.quit()

let mainWindow: BrowserWindow | null = null
const isMac = process.platform === 'darwin'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Aurora Music',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
    // The in-app UI is identical everywhere. Only the OS's own window buttons
    // differ: traffic lights on macOS, native caption buttons elsewhere.
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 18, y: 16 } }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000',
            height: 44,
          },
        }),
    icon: join(app.getAppPath(), 'build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Keep audio and lyrics timing running while the window is hidden.
      backgroundThrottling: false,
      // Media keys and a restored queue start playback without a click in the page.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  win.once('ready-to-show', () => win.show())
  win.on('enter-full-screen', () => win.webContents.send('aurora:fullscreen', true))
  win.on('leave-full-screen', () => win.webContents.send('aurora:fullscreen', false))

  // Links open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  win.on('closed', () => {
    mainWindow = null
    // The hidden BotGuard window keeps 'window-all-closed' from ever firing.
    if (!isMac) app.quit()
  })
  return win
}

function sendMediaKey(key: 'play-pause' | 'next' | 'previous') {
  mainWindow?.webContents.send('aurora:media-key', key)
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'Controls',
      submenu: [
        // Space itself is handled in the renderer so it doesn't fire while typing in search.
        { label: 'Play / Pause', click: () => sendMediaKey('play-pause') },
        { label: 'Next', accelerator: 'CmdOrCtrl+Right', click: () => sendMediaKey('next') },
        { label: 'Previous', accelerator: 'CmdOrCtrl+Left', click: () => sendMediaKey('previous') },
      ],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(() => {
  handleStreamProtocol()
  registerIpc(() => mainWindow)
  buildMenu()
  mainWindow = createWindow()
  warmUpPoToken()

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
    else mainWindow.show()
  })
})

