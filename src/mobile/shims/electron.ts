/**
 * The Electron surface the shared main modules touch, as the phone has it.
 * Storage paths are fixed names (see fs.ts), the "keychain" is the app's own
 * private storage, and the desktop's dialogs don't exist.
 */
export const app = {
  getPath: (name: string) => `/${name}`,
  getAppPath: () => '/',
  getLocaleCountryCode: () => (navigator.language.split('-')[1] ?? 'US').toUpperCase(),
}

export const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => s,
  decryptString: (s: unknown) => String(s),
}

export const dialog = {
  showSaveDialog: async () => ({ canceled: true, filePath: undefined }),
  showOpenDialog: async () => ({ canceled: true, filePaths: [] as string[] }),
}

export class BrowserWindow {}
