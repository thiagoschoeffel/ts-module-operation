import assert from 'node:assert/strict'
import test from 'node:test'
import { addCustomerAddressForOrder, ApiConflictError, cancelOrder, confirmOrder, configureDailyCapacity, createCustomerForOrder, getDailyCapacity, listOrders, saveOrder } from './ordersApi.ts'

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
  financial: { paymentCondition: 'cash', paymentMethod: 'pix', deliveryFee: 0, discountAmount: 0 },
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
    financial: { paymentCondition: 'cash', paymentMethod: 'pix', deliveryFee: 0, discountAmount: 0 },
    items: [{ offerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', producibleItemId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', quantity: 2, unitPrice: 20 }]
  }

  await saveOrder(request, input)
  await saveOrder(request, { ...input, id: order.id, expectedVersion: 3 })

  assert.equal(calls[0].path, '/api/orders')
  assert.equal(calls[1].path, `/api/orders/${order.id}`)
  assert.ok(new Headers(calls[0].init.headers).get('Idempotency-Key'))
  assert.deepEqual(JSON.parse(calls[0].init.body).financial, input.financial)
  assert.equal(JSON.parse(calls[1].init.body).expectedVersion, 3)
})

test('uses persisted draft fee and discount when confirming the order', async () => {
  let body
  const request = async (_path, init) => {
    body = JSON.parse(init.body)
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  await confirmOrder(request, {
    ...order,
    financial: { paymentCondition: 'on-delivery', paymentMethod: 'cash', deliveryFee: 7.5, discountAmount: 2, discountReason: 'Fidelidade' }
  })

  assert.deepEqual(body, { expectedVersion: 3, discountAmount: 2, discountReason: 'Fidelidade', deliveryFee: 7.5 })
})

test('maps missing capacity to an unconfigured day', async () => {
  const result = await getDailyCapacity(async () => new Response(null, { status: 404 }), '2026-09-04')
  assert.equal(result, undefined)
})

test('creates or updates daily capacity with optimistic concurrency and idempotency', async () => {
  let requestedPath
  let requestedInit
  const request = async (path, init) => {
    requestedPath = path
    requestedInit = init
    return new Response(JSON.stringify({ operationalDate: '2026-09-09', totalUnits: 50, reservedUnits: 4, availableUnits: 46, version: 3 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const result = await configureDailyCapacity(request, '2026-09-09', 50, 2, 'capacity-attempt-1')

  assert.equal(requestedPath, '/api/daily-capacities/2026-09-09')
  assert.equal(requestedInit.method, 'PUT')
  assert.equal(new Headers(requestedInit.headers).get('Idempotency-Key'), 'capacity-attempt-1')
  assert.deepEqual(JSON.parse(requestedInit.body), { totalUnits: 50, expectedVersion: 2 })
  assert.equal(result.availableUnits, 46)
})

test('persists quick customer and address registration through the customer API', async () => {
  const calls = []
  const request = async (path, init) => {
    calls.push({ path, init })
    return new Response(JSON.stringify({ id: calls.length === 1 ? order.customerId : 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  await createCustomerForOrder(request, { name: 'Maria Silva', phone: '(47) 99999-0000' })
  await addCustomerAddressForOrder(request, order.customerId, {
    label: 'Casa', postalCode: '89297-515', street: 'Rua das Flores', number: '123',
    neighborhood: 'Centro', city: 'Rio Negrinho', state: 'SC'
  })

  assert.equal(calls[0].path, '/api/orders/customers/quick')
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Maria Silva', phone: '(47) 99999-0000' })
  assert.equal(calls[1].path, `/api/orders/customers/${order.customerId}/addresses`)
  assert.equal(JSON.parse(calls[1].init.body).postalCode, '89297-515')
})

test('sends order history filters and pagination as query parameters', async () => {
  let requestedPath
  const page = { items: [], page: 2, pageSize: 10, total: 0, counts: { all: 0, open: 0, inProgress: 0, completed: 0, problems: 0 } }
  const result = await listOrders(async path => {
    requestedPath = path
    return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }, { from: '2026-09-01', to: '2026-09-09', statusGroup: 'Completed', page: 2, pageSize: 10 })

  assert.equal(requestedPath, '/api/orders?from=2026-09-01&to=2026-09-09&statusGroup=Completed&page=2&pageSize=10')
  assert.deepEqual(result, page)
})

test('rejects the legacy order array without breaking the consuming component', async () => {
  await assert.rejects(
    () => listOrders(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
    /formato incompatível/
  )
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
