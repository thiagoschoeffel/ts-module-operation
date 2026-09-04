import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateFrozenStockFefo, returnFrozenStock } from './frozenAllocation.ts'

const lots = [
  { id: 'later', frozenConfigurationId: 'config-1', manufacturedOn: '2026-08-01', expiresOn: '2026-10-30', availableQuantity: 4 },
  { id: 'first', frozenConfigurationId: 'config-1', manufacturedOn: '2026-06-14', expiresOn: '2026-09-12', availableQuantity: 2 },
  { id: 'expired', frozenConfigurationId: 'config-1', manufacturedOn: '2026-05-01', expiresOn: '2026-08-01', availableQuantity: 8 }
]

test('aloca primeiro o lote elegível com vencimento mais próximo', () => {
  const result = allocateFrozenStockFefo(lots, 'config-1', 3, '2026-09-04')
  assert.deepEqual(result.allocations.map(item => [item.lotId, item.quantity]), [['first', 2], ['later', 1]])
  assert.equal(result.lots.find(item => item.id === 'expired').availableQuantity, 8)
})

test('não altera nenhum lote quando o saldo elegível é insuficiente', () => {
  assert.throws(() => allocateFrozenStockFefo(lots, 'config-1', 7, '2026-09-04'), /insuficiente/)
  assert.equal(lots.find(item => item.id === 'first').availableQuantity, 2)
})

test('estorna a alocação para os mesmos lotes', () => {
  const allocated = allocateFrozenStockFefo(lots, 'config-1', 3, '2026-09-04')
  const returned = returnFrozenStock(allocated.lots, allocated.allocations)
  assert.equal(returned.find(item => item.id === 'first').availableQuantity, 2)
  assert.equal(returned.find(item => item.id === 'later').availableQuantity, 4)
})
