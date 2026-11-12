import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import replace from '@rollup/plugin-replace'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode === 'production' &&
      replace({
        preventAssignment: true,
        values: {
          'http://localhost:5000': process.env.VITE_API_BASE_URL || '',
          'http://127.0.0.1:5000': process.env.VITE_API_BASE_URL || ''
        }
      })
  ].filter(Boolean),
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
}))
