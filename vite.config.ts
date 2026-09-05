import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const sharedDependencies = {
  vue: { singleton: true, requiredVersion: '^3.5.42', strictVersion: true },
  '@thiagoschoeffel/ts-components': { singleton: true, requiredVersion: '^0.7.8', strictVersion: true, import: false },
}

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
      dts: true,
      shared: sharedDependencies
    })
  ],
  server: {
    origin: 'http://localhost:4174'
  }
})
