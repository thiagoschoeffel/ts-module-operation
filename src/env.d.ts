/// <reference types="vite/client" />

interface Window {
  tsLabelPrinter?: {
    mode: 'auto' | 'browser' | 'zebra'
    dpi: 203 | 300
    loadBrowserPrint(): Promise<void>
  }
}
