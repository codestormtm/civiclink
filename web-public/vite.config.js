import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        xfwd: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5002',
        ws: true,
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
