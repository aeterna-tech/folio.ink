import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/*.dll',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
  server: {
    watch: {
      // Игнорируем всю папку Rust-проекта, чтобы Vite не трогал target
      ignored: ['**/src-tauri/**'],
    },
  },
})