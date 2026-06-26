import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    alias: {
      electron: resolve(__dirname, 'src/main/__mocks__/electron.ts')
    }
  }
})
