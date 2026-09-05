import assert from 'node:assert/strict'
import test from 'node:test'
import { createRoute, recordAttempt, rescheduleDelivery, startRoute } from './logisticsApi.ts'

function response(body = {}) { return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }) }

test('planejamento e início preservam ordem, versão e idempotência', async () => {
  const calls = []
  const request = async (path, init) => { calls.push({ path, init }); return response({ id: 'route-1' }) }
  await createRoute(request, { date: '2026-09-05', deliveryWindow: '11:00–12:00', driverId: 'driver-1', orderIds: ['order-2', 'order-1'] })
  await startRoute(request, { id: 'route-1', version: 3 })
  assert.deepEqual(JSON.parse(calls[0].init.body).orderIds, ['order-2', 'order-1'])
  assert.equal(JSON.parse(calls[1].init.body).expectedVersion, 3)
  assert.ok(calls[1].init.headers['Idempotency-Key'])
})

test('tentativa e reagendamento usam endpoints históricos idempotentes', async () => {
  const calls = []
  const request = async (path, init) => { calls.push({ path, init }); return response() }
  await recordAttempt(request, { id: 'route-1' }, { id: 'stop-1' }, 'Failed', 'Cliente ausente', '<p>Sem resposta</p>')
  await rescheduleDelivery(request, 'order-1', '2026-09-06', '12:00–13:00', '<p>Solicitado pelo cliente</p>')
  assert.match(calls[0].path, /stops\/stop-1\/attempts$/)
  assert.equal(JSON.parse(calls[0].init.body).result, 'Failed')
  assert.ok(calls.every(call => call.init.headers['Idempotency-Key']))
})
