import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true, // Fixes hot-reload issues in Docker (especially on Windows/Mac)
    },
    host: true, // Needed for the Docker Container port mapping to work
    strictPort: true,
    port: 5173, 
  }
})