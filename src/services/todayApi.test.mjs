import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTodaySnapshot } from './todayApi.ts'

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

test('carrega o painel Hoje somente por endpoints autoritativos', async () => {
  const paths = []
  const request = async (path) => {
    paths.push(path)
    if (path === '/api/orders') return response([])
    if (path.startsWith('/api/daily-capacities/')) return response({ totalUnits: 20, reservedUnits: 4, availableUnits: 16 })
    if (path.startsWith('/api/operations/production')) return response({ needs: [] })
    if (path.startsWith('/api/operations/packing')) return response({ awaiting: [], packed: [], awaitingItemCount: 0, packedItemCount: 0, attentionCount: 0 })
    if (path === '/api/logistics') return response({ drivers: [], availableOrders: [], routes: [], reschedules: [] })
    if (path.startsWith('/api/menus/')) return response({ date: '2026-09-07', status: 'Published', options: [] })
    return response({}, 404)
  }

  const snapshot = await loadTodaySnapshot(request, '2026-09-07')

  assert.equal(snapshot.menu?.status, 'Published')
  assert.deepEqual(paths, [
    '/api/orders',
    '/api/daily-capacities/2026-09-07',
    '/api/operations/production?operationalDate=2026-09-07',
    '/api/operations/packing?operationalDate=2026-09-07',
    '/api/logistics',
    '/api/menus/2026-09-07'
  ])
})

test('não cria cardápio fallback quando a API não possui registro para o dia', async () => {
  const request = async (path) => path.startsWith('/api/menus/')
    ? response({}, 404)
    : response(path === '/api/orders' ? [] : {})

  const snapshot = await loadTodaySnapshot(request, '2026-09-07')

  assert.equal(snapshot.menu, undefined)
})
