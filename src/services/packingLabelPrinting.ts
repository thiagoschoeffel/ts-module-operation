import type {
  DailyItemLabelSnapshot,
  ExternalPackageLabelSnapshot,
  PackingLabelBundle,
  PackingLabelPrintSelection
} from '../types/packingLabels'

export type PackingLabelPrintState = 'idle' | 'printing' | 'success' | 'error'

export interface PackingLabelPrintRequest {
  bundle: PackingLabelBundle
  selection: PackingLabelPrintSelection
}

export interface PackingLabelPrintAdapter {
  print(request: PackingLabelPrintRequest): Promise<void>
}

export type ZebraPrinterDpi = 203 | 300

export interface ZebraBrowserPrintDevice {
  name?: string
  uid?: string
  connection?: string
  send(data: string, success: () => void, error: (reason: unknown) => void): void
}

export interface ZebraBrowserPrintApi {
  getDefaultDevice(
    type: 'printer',
    success: (device?: ZebraBrowserPrintDevice) => void,
    error: (reason: unknown) => void
  ): void
}

declare global {
  interface Window {
    BrowserPrint?: ZebraBrowserPrintApi
  }
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function list(lines: string[], className = '') {
  if (!lines.length) return ''
  return `<ul class="${className}">${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
}

function dailyItemMarkup(label: DailyItemLabelSnapshot) {
  return `<article class="label item-label">
    <header><strong>Sabor Santè</strong><span>Produção do dia</span></header>
    <p class="context">${escapeHtml(label.customerName)} · Pedido #${label.orderId}</p>
    <h1>${escapeHtml(label.productName)}</h1>
    ${list(label.detailLines, 'details')}
    ${list(label.attentionLines, 'attention')}
  </article>`
}

function externalPackageMarkup(label: ExternalPackageLabelSnapshot) {
  return `<article class="label package-label">
    <header><strong>Sabor Santè</strong><span>Pacote</span></header>
    <h1>${escapeHtml(label.customerName)}</h1>
    <p class="order">Pedido #${label.orderId}</p>
    ${list(label.addressLines, 'address')}
    ${label.phone ? `<p class="phone">${escapeHtml(label.phone)}</p>` : '<p class="pickup">Retirada / balcão</p>'}
    ${list(label.itemSummary, 'summary')}
  </article>`
}

function selectedDailyLabels(bundle: PackingLabelBundle, selection: PackingLabelPrintSelection) {
  const labelsById = new Map(bundle.dailyItemLabels.map(label => [label.id, label]))
  return selection.dailyItemLabelIds
    .map(id => labelsById.get(id))
    .filter((label): label is DailyItemLabelSnapshot => Boolean(label))
}

function zplText(value: string | number) {
  return [...new TextEncoder().encode(String(value))]
    .map(byte => byte >= 32 && byte <= 126 && byte !== 94 && byte !== 95 && byte !== 126
      ? String.fromCharCode(byte)
      : `_${byte.toString(16).padStart(2, '0').toUpperCase()}`)
    .join('')
}

function labelMetrics(dpi: ZebraPrinterDpi) {
  const dots = (millimeters: number) => Math.round((millimeters / 25.4) * dpi)
  const scale = (value: number) => Math.round((value / 203) * dpi)
  return { width: dots(100), height: dots(50), scale }
}

function zplField(x: number, y: number, fontSize: number, value: string | number, width?: number, lines = 1) {
  const block = width ? `^FB${width},${lines},0,L,0` : ''
  return `^FO${x},${y}^A0N,${fontSize},${fontSize}${block}^FH_^FD${zplText(value)}^FS`
}

function dailyItemZpl(label: DailyItemLabelSnapshot, dpi: ZebraPrinterDpi) {
  const { width, height, scale } = labelMetrics(dpi)
  const margin = scale(40)
  const contentWidth = width - (margin * 2)
  const productFont = scale(label.productName.length > 30 ? 25 : label.productName.length > 20 ? 29 : 34)
  const details = label.detailLines.join(' · ')
  const attention = label.attentionLines.join(' · ')
  return `^XA^CI28^PW${width}^LL${height}^LH0,0
${zplField(margin, scale(25), scale(34), 'Sabor Santè')}
^FO${margin},${scale(26)}^A0N,${scale(19)},${scale(19)}^FB${contentWidth},1,0,R,0^FH_^FD${zplText('PRODUÇÃO DO DIA')}^FS
^FO${margin},${scale(68)}^GB${contentWidth},${scale(3)},${scale(3)}^FS
${zplField(margin, scale(82), scale(19), `${label.customerName} · Pedido #${label.orderId}`, contentWidth)}
${zplField(margin, scale(112), productFont, label.productName, contentWidth, 2)}
${details ? zplField(margin, scale(190), scale(18), details, contentWidth, 2) : ''}
${attention ? `^FO${margin},${scale(250)}^GB${contentWidth},${scale(90)},${scale(2)}^FS${zplField(scale(50), scale(263), scale(17), attention, contentWidth - scale(20), 3)}` : ''}
^PQ1^XZ`
}

function externalPackageZpl(label: ExternalPackageLabelSnapshot, dpi: ZebraPrinterDpi) {
  const { width, height, scale } = labelMetrics(dpi)
  const margin = scale(40)
  const contentWidth = width - (margin * 2)
  const customerFont = scale(label.customerName.length > 30 ? 27 : label.customerName.length > 20 ? 31 : 38)
  const address = label.addressLines.join(' · ')
  const summary = label.itemSummary.join(' · ')
  return `^XA^CI28^PW${width}^LL${height}^LH0,0
${zplField(margin, scale(25), scale(34), 'Sabor Santè')}
^FO${margin},${scale(26)}^A0N,${scale(19)},${scale(19)}^FB${contentWidth},1,0,R,0^FH_^FD${zplText('PACOTE')}^FS
^FO${margin},${scale(68)}^GB${contentWidth},${scale(3)},${scale(3)}^FS
${zplField(margin, scale(88), customerFont, label.customerName, contentWidth, 2)}
${zplField(margin, scale(155), scale(22), `Pedido #${label.orderId}`, contentWidth)}
${address ? zplField(margin, scale(195), scale(18), address, contentWidth, 3) : ''}
${zplField(margin, address ? scale(270) : scale(205), scale(20), label.phone ?? 'Retirada / balcão', contentWidth)}
${summary ? `^FO${margin},${scale(305)}^GB${contentWidth},${scale(2)},${scale(2)}^FS${zplField(margin, scale(318), scale(15), summary, contentWidth, 2)}` : ''}
^PQ1^XZ`
}

export function buildPackingLabelZpl(request: PackingLabelPrintRequest, dpi: ZebraPrinterDpi = 203) {
  return [
    ...selectedDailyLabels(request.bundle, request.selection).map(label => dailyItemZpl(label, dpi)),
    ...(request.selection.includeExternalPackageLabel
      ? [externalPackageZpl(request.bundle.externalPackageLabel, dpi)]
      : [])
  ].join('\n')
}

function toError(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : fallback)
}

export function createZebraPackingLabelPrintAdapter(
  browserPrint: ZebraBrowserPrintApi,
  dpi: ZebraPrinterDpi = 203
): PackingLabelPrintAdapter {
  return {
    async print(request) {
      const printer = await new Promise<ZebraBrowserPrintDevice>((resolve, reject) => {
        browserPrint.getDefaultDevice('printer', (device) => {
          if (device) resolve(device)
          else reject(new Error('Nenhuma impressora Zebra padrão foi encontrada via USB.'))
        }, reason => reject(toError(reason, 'Não foi possível localizar a impressora Zebra.')))
      })
      const zpl = buildPackingLabelZpl(request, dpi)
      await new Promise<void>((resolve, reject) => {
        printer.send(zpl, resolve, reason => reject(toError(reason, 'A impressora Zebra não aceitou as etiquetas.')))
      })
    }
  }
}

function configuredPrintMode() {
  return window.tsLabelPrinter?.mode ?? 'auto'
}

export function usesDirectZebraPackingPrint() {
  const mode = configuredPrintMode()
  return mode === 'zebra'
    || (mode === 'auto' && typeof window !== 'undefined' && Boolean(window.BrowserPrint))
}

export const browserPackingLabelPrintAdapter: PackingLabelPrintAdapter = {
  async print({ bundle, selection }) {
    const itemLabels = selectedDailyLabels(bundle, selection)
    const markup = [
      ...itemLabels.map(dailyItemMarkup),
      ...(selection.includeExternalPackageLabel ? [externalPackageMarkup(bundle.externalPackageLabel)] : [])
    ].join('')

    if (!markup) throw new Error('Selecione pelo menos uma etiqueta para imprimir.')

    const printWindow = window.open('', '_blank', 'popup,width=900,height=650')
    if (!printWindow) throw new Error('O navegador bloqueou a janela de impressão.')

    printWindow.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Etiquetas · Pedido #${escapeHtml(bundle.externalPackageLabel.orderId)}</title>
          <style>
            @page { size: 100mm 50mm; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; }
            .label { width: 100mm; height: 50mm; padding: 4mm 5mm; overflow: hidden; page-break-after: always; }
            .label:last-child { page-break-after: auto; }
            header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: .6mm solid #0f172a; padding-bottom: 1.5mm; }
            header strong { font-size: 13pt; }
            header span { font-size: 7pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
            h1 { margin: 2.2mm 0 1mm; font-size: 16pt; line-height: 1; text-transform: uppercase; }
            p { margin: 0; }
            ul { margin: 1mm 0 0; padding: 0; list-style: none; }
            li { margin-top: .5mm; }
            .context, .order { margin-top: 1.5mm; font-size: 8pt; font-weight: 700; }
            .details, .address { font-size: 8pt; line-height: 1.25; }
            .attention { margin-top: 1.5mm; border: .35mm solid #0f172a; padding: 1mm 1.5mm; font-size: 8pt; font-weight: 700; line-height: 1.2; }
            .package-label h1 { font-size: 18pt; }
            .phone, .pickup { margin-top: 1mm; font-size: 9pt; font-weight: 700; }
            .summary { margin-top: 1.5mm; border-top: .25mm solid #94a3b8; padding-top: 1mm; font-size: 7pt; line-height: 1.15; }
          </style>
        </head>
        <body>${markup}</body>
      </html>`)
    printWindow.document.close()
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
    printWindow.focus()
    printWindow.print()
  }
}

async function defaultPackingLabelPrintAdapter() {
  const mode = configuredPrintMode()
  if (mode === 'browser') return browserPackingLabelPrintAdapter

  if (!window.BrowserPrint && window.tsLabelPrinter) {
    try {
      await window.tsLabelPrinter.loadBrowserPrint()
    }
    catch (error) {
      if (mode === 'zebra') throw error
    }
  }

  if (window.BrowserPrint) {
    const dpi = window.tsLabelPrinter?.dpi ?? 203
    return createZebraPackingLabelPrintAdapter(window.BrowserPrint, dpi)
  }
  if (mode === 'zebra')
    throw new Error('Zebra Browser Print não está disponível nesta estação. Instale o aplicativo e configure a biblioteca oficial.')
  return browserPackingLabelPrintAdapter
}

export async function printPackingLabels(
  request: PackingLabelPrintRequest,
  adapter?: PackingLabelPrintAdapter
) {
  const selectedIds = new Set(request.selection.dailyItemLabelIds)
  const hasKnownItemLabel = request.bundle.dailyItemLabels.some(label => selectedIds.has(label.id))
  if (!hasKnownItemLabel && !request.selection.includeExternalPackageLabel)
    throw new Error('Selecione pelo menos uma etiqueta para imprimir.')
  const activeAdapter = adapter ?? await defaultPackingLabelPrintAdapter()
  await activeAdapter.print(request)
}
