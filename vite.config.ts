import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
    federation({
      name: 'moduleOperation',
      filename: 'remoteEntry.js',
      dev: {
        remoteHmr: true
      },
      exposes: {
        './OperationPage': './src/OperationPage.vue'
      },
      // Generate federated types when there is a larger API to share.
      dts: false,
      shared: ['vue']
    })
  ],
  server: {
    origin: 'http://localhost:4174'
  }
})
