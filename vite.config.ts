import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/app/inspection-repository.ts',
        'src/features/**/*.{ts,tsx}',
        'src/shared/domain/**/*.ts',
        'src/shared/contracts/**/*.ts',
        'src/shared/storage/**/*.ts',
        'src/shared/lib/inspection-form.ts',
      ],
      exclude: ['**/*.test.{ts,tsx}'],
      thresholds: { lines: 80, branches: 80 },
    },
  },
})
