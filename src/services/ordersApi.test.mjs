import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiConflictError, cancelOrder, getDailyCapacity, saveOrder } from './ordersApi.ts'

const order = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  customerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  operationalDate: '2026-09-04',
  status: 'Confirmed',
  version: 3,
  dailyCapacityUnits: 2,
  totalAmount: 40,
  items: [],
  lifecycle: [],
  confirmation: { frozenAllocations: [] }
}

test('sends create and edit mutations with version and idempotency', async () => {
  const calls = []
  const request = async (path, init) => {
    calls.push({ path, init })
    return new Response(JSON.stringify({ id: order.id }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const input = {
    customerId: order.customerId,
    operationalDate: order.operationalDate,
    items: [{ offerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', producibleItemId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', quantity: 2, unitPrice: 20 }]
  }

  await saveOrder(request, input)
  await saveOrder(request, { ...input, id: order.id, expectedVersion: 3 })

  assert.equal(calls[0].path, '/api/orders')
  assert.equal(calls[1].path, `/api/orders/${order.id}`)
  assert.ok(new Headers(calls[0].init.headers).get('Idempotency-Key'))
  assert.equal(JSON.parse(calls[1].init.body).expectedVersion, 3)
})

test('maps missing capacity to an unconfigured day', async () => {
  const result = await getDailyCapacity(async () => new Response(null, { status: 404 }), '2026-09-04')
  assert.equal(result, undefined)
})

test('surfaces concurrency conflicts distinctly', async () => {
  const request = async () => new Response(JSON.stringify({ detail: 'O pedido foi alterado. Recarregue os dados.' }), {
    status: 409,
    headers: { 'Content-Type': 'application/problem+json' }
  })
  await assert.rejects(() => saveOrder(request, {
    id: order.id,
    customerId: order.customerId,
    operationalDate: order.operationalDate,
    expectedVersion: 2,
    items: [{ offerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quantity: 1 }]
  }), error => error instanceof ApiConflictError && /alterado/.test(error.message))
})

test('derives safe cancellation dispositions from persisted status and allocations', async () => {
  let body
  const request = async (_path, init) => {
    body = JSON.parse(init.body)
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  await cancelOrder(request, order, 'Cliente desistiu')
  assert.equal(body.commercialDisposition, 'Reverse')
  assert.equal(body.frozenDisposition, 'NotApplicable')
  assert.equal(body.expectedVersion, 3)
})
