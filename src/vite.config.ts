import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  envDir: '..',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        bypass(req) {
          const url = req.url ?? '';
          if (/\.(ts|tsx|js|mjs|css|map)(\?|$)/.test(url)) {
            return url;
          }
        },
      },
    },
  },
})
