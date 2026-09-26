// Renders resources/logo.svg to build/icon.png (1024², on the macOS icon grid:
// an 824px squircle centred with room for its shadow). electron-builder derives
// the .icns and .ico from this one file.  Run: npx electron scripts/make-icons.mjs
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const svg = fs.readFileSync(path.join(root, 'resources/logo.svg'), 'utf8')
const html = `<html><body style="margin:0;background:transparent;width:1024px;height:1024px;display:grid;place-items:center">
<div style="width:824px;height:824px;filter:drop-shadow(0 12px 24px rgba(0,0,0,.35))">${svg.replace('width="1024" height="1024"', 'width="824" height="824"')}</div></body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 500))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  fs.mkdirSync(path.join(root, 'build'), { recursive: true })
  fs.writeFileSync(path.join(root, 'build/icon.png'), image.resize({ width: 1024, height: 1024 }).toPNG())
  console.log('wrote build/icon.png', image.getSize())
  app.quit()
})
