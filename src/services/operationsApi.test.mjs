import assert from 'node:assert/strict'
import test from 'node:test'
import { getPackingQueue, getProductionSnapshot, packOrder, recordLabelPrint } from './operationsApi.ts'

function response(body = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

test('consulta Produção e Embalagem pela data operacional informada', async () => {
  const paths = []
  const request = async (path) => {
    paths.push(path)
    return response(path.includes('production') ? { needs: [] } : { awaiting: [], packed: [] })
  }

  await getProductionSnapshot(request, '2026-09-05')
  await getPackingQueue(request, '2026-09-05')

  assert.deepEqual(paths, [
    '/api/operations/production?operationalDate=2026-09-05',
    '/api/operations/packing?operationalDate=2026-09-05'
  ])
})

test('embalagem e impressão enviam versão, idempotência e seleção histórica', async () => {
  const calls = []
  const request = async (path, init) => {
    calls.push({ path, init })
    return response({ id: 'order-1' })
  }
  const order = { id: 'order-1', version: 4 }
  const selection = { dailyItemLabelIds: ['label-1'], includeExternalPackageLabel: true }

  await packOrder(request, order, 'pack-key')
  await recordLabelPrint(request, order.id, selection, 'Failed', 'Zebra offline', 'print-key')

  assert.equal(calls[0].init.headers['Idempotency-Key'], 'pack-key')
  assert.deepEqual(JSON.parse(calls[0].init.body), { expectedVersion: 4 })
  assert.equal(calls[1].init.headers['Idempotency-Key'], 'print-key')
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    dailyItemLabelIds: ['label-1'],
    includeExternalPackageLabel: true,
    status: 'Failed',
    errorMessage: 'Zebra offline'
  })
})
