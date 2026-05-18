import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createTasklyAiPlugin } from './server/tasklyAiServer.js'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), createTasklyAiPlugin()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true,
    },
  }
})
