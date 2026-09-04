import assert from 'node:assert/strict'
import test from 'node:test'
import { contributesToDailyProduction } from './orderFulfillment.ts'

test('itens congelados não entram na produção diária', () => {
  assert.equal(contributesToDailyProduction({ fulfillmentSource: 'frozen-stock' }), false)
  assert.equal(contributesToDailyProduction({ fulfillmentSource: 'daily-production' }), true)
})

test('itens antigos sem origem explícita continuam sendo tratados como produção diária', () => {
  assert.equal(contributesToDailyProduction({}), true)
})
