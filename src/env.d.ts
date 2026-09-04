/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PACKING_PRINT_MODE?: 'auto' | 'browser' | 'zebra'
  readonly VITE_ZEBRA_BROWSER_PRINT_SCRIPT?: string
  readonly VITE_ZEBRA_DPI?: '203' | '300'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
