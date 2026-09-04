import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cancellationReleasesCapacity,
  capacitySnapshot,
  dailyProductionDemand
} from './capacity.ts'

test('capacidade considera apenas itens produzidos no dia', () => {
  assert.equal(dailyProductionDemand([
    { fulfillmentSource: 'daily-production' },
    { fulfillmentSource: 'frozen-stock' },
    {}
  ]), 2)
})

test('capacidade informa saldo projetado e excesso', () => {
  assert.deepEqual(capacitySnapshot(90, 71, 3), {
    limit: 90,
    used: 71,
    requested: 3,
    remaining: 19,
    projectedUsed: 74,
    projectedRemaining: 16,
    exceeded: false
  })
  assert.equal(capacitySnapshot(90, 89, 2).exceeded, true)
})

test('somente cancelamento antes da produção libera capacidade automaticamente', () => {
  assert.equal(cancellationReleasesCapacity('confirmed'), true)
  assert.equal(cancellationReleasesCapacity('in-production'), false)
  assert.equal(cancellationReleasesCapacity('packing'), false)
})
