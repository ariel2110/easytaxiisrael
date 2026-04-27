import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RideOS Driver',
        short_name: 'Driver',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
