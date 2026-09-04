import assert from 'node:assert/strict'
import test from 'node:test'
import { createPackingLabelBundle, fullPackingLabelSelection } from './packingLabels.ts'
import {
  buildPackingLabelZpl,
  createZebraPackingLabelPrintAdapter,
  printPackingLabels
} from '../services/packingLabelPrinting.ts'

function item(id, fulfillmentSource, name) {
  return {
    id,
    offerId: `offer-${id}`,
    name,
    price: 25,
    details: [`<p>${name} completo</p>`],
    additions: [],
    fulfillmentSource,
    frozenStock: fulfillmentSource === 'frozen-stock' ? {
      configurationId: 'frozen-1',
      producibleItemId: 'product-1',
      producibleName: 'Chilli',
      presentation: '300 g',
      unitPrice: 29,
      allocationStatus: 'allocated',
      allocations: []
    } : undefined,
    effectiveComponents: [],
    customizations: [],
    hasRestrictionConflict: false
  }
}

test('gera uma etiqueta para cada unidade da produção do dia e não duplica congelados', () => {
  const bundle = createPackingLabelBundle({
    id: 123,
    customer: { name: 'Maria', phone: '(11) 99999-0000', channel: 'WhatsApp' },
    items: [item('daily-1', 'daily-production', 'Prato do dia'), item('daily-2', 'daily-production', 'Salada'), item('frozen-1', 'frozen-stock', 'Congelados')]
  }, '2026-09-04T12:00:00.000Z')

  assert.equal(bundle.dailyItemLabels.length, 2)
  assert.deepEqual(bundle.preLabeledFrozenItemIds, ['frozen-1'])
  assert.deepEqual(bundle.externalPackageLabel.itemSummary, ['Prato do dia', 'Salada', 'Chilli · 300 g'])
  assert.deepEqual(fullPackingLabelSelection(bundle), {
    dailyItemLabelIds: bundle.dailyItemLabels.map(label => label.id),
    includeExternalPackageLabel: true
  })
})

test('etiqueta externa de retirada omite endereço e telefone de entrega', () => {
  const bundle = createPackingLabelBundle({
    id: 124,
    customer: { name: 'João', phone: '(11) 98888-0000', channel: 'Balcão' },
    deliveryAddress: { id: 'address', label: 'Casa', postalCode: '00000-000', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' },
    items: [item('daily-1', 'daily-production', 'Prato do dia')]
  })

  assert.equal(bundle.externalPackageLabel.phone, undefined)
  assert.deepEqual(bundle.externalPackageLabel.addressLines, [])
})

test('envia a seleção ao adapter sem alterar o snapshot', async () => {
  const bundle = createPackingLabelBundle({
    id: 125,
    customer: { name: 'Ana', phone: '(11) 97777-0000', channel: 'Telefone' },
    items: [item('daily-1', 'daily-production', 'Prato do dia')]
  }, '2026-09-04T12:00:00.000Z')
  const selection = fullPackingLabelSelection(bundle)
  let received

  await printPackingLabels({ bundle, selection }, {
    async print(request) { received = request }
  })

  assert.deepEqual(received, { bundle, selection })
  assert.equal(bundle.createdAt, '2026-09-04T12:00:00.000Z')
})

test('recusa impressão sem nenhuma etiqueta selecionada', async () => {
  const bundle = createPackingLabelBundle({
    id: 126,
    customer: { name: 'Bia', phone: '(11) 96666-0000', channel: 'Balcão' },
    items: [item('daily-1', 'daily-production', 'Prato do dia')]
  })

  await assert.rejects(
    printPackingLabels({ bundle, selection: { dailyItemLabelIds: [], includeExternalPackageLabel: false } }, { async print() {} }),
    /Selecione pelo menos uma etiqueta/
  )
})

test('gera ZPL de 100 × 50 mm para impressoras Zebra de 203 e 300 dpi', () => {
  const bundle = createPackingLabelBundle({
    id: 127,
    customer: { name: 'Sônia', phone: '(11) 95555-0000', channel: 'WhatsApp' },
    items: [item('daily-1', 'daily-production', 'Prato + Salada P + Fruta')]
  })
  const request = { bundle, selection: fullPackingLabelSelection(bundle) }
  const zpl203 = buildPackingLabelZpl(request, 203)
  const zpl300 = buildPackingLabelZpl(request, 300)

  assert.match(zpl203, /\^PW799\^LL400/)
  assert.match(zpl300, /\^PW1181\^LL591/)
  assert.equal(zpl203.match(/\^XA/g)?.length, 2)
  assert.equal(zpl203.match(/\^XZ/g)?.length, 2)
  assert.match(zpl203, /S_C3_B4nia/)
})

test('adaptador Zebra envia o ZPL diretamente para a impressora USB padrão', async () => {
  const bundle = createPackingLabelBundle({
    id: 128,
    customer: { name: 'Bia', phone: '(11) 94444-0000', channel: 'Telefone' },
    items: [item('daily-1', 'daily-production', 'Prato do dia')]
  })
  let requestedType
  let sentZpl
  const adapter = createZebraPackingLabelPrintAdapter({
    getDefaultDevice(type, success) {
      requestedType = type
      success({ send(data, done) { sentZpl = data; done() } })
    }
  }, 203)

  await adapter.print({ bundle, selection: fullPackingLabelSelection(bundle) })

  assert.equal(requestedType, 'printer')
  assert.match(sentZpl, /\^XA/)
  assert.match(sentZpl, /\^PQ1\^XZ/)
})
