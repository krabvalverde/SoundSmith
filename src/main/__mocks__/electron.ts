import { tmpdir } from 'os'
import { join } from 'path'

export const app = {
  getPath: (name: string) => join(tmpdir(), `soundsmith-test-${name}`),
  getVersion: () => '0.0.0-test'
}
export const ipcMain = {
  handle: () => {}
}
export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] })
}
