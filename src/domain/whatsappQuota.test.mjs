import assert from 'node:assert/strict'
import test from 'node:test'
import {
  freeMessagesRemaining,
  messagesUntilAutomationPause,
  operationalQuotaUsage,
  quotaPercentage,
  quotaStatus
} from './whatsappQuota.ts'

const usage = {
  businessPhoneNumber: '(11) 4000-0000',
  periodLabel: 'Setembro de 2026',
  freeServiceMessageLimit: 1000,
  automationPauseAt: 970,
  deliveredServiceMessages: 938,
  reservedServiceMessages: 2,
  renewsAtLabel: '1º de outubro de 2026'
}

test('separa mensagens entregues das reservas usadas pelo bloqueio concorrente', () => {
  assert.equal(operationalQuotaUsage({ ...usage, status: 'alert' }), 940)
  assert.equal(freeMessagesRemaining({ ...usage, status: 'alert' }), 62)
  assert.equal(messagesUntilAutomationPause({ ...usage, status: 'alert' }), 30)
  assert.equal(quotaPercentage({ ...usage, status: 'alert' }), 93.8)
})

test('pausa a automação quando entregues e reservadas alcançam a margem', () => {
  assert.equal(quotaStatus({ ...usage, deliveredServiceMessages: 968 }), 'automation-blocked')
})

test('classifica as faixas de acompanhamento mensal', () => {
  assert.equal(quotaStatus({ ...usage, deliveredServiceMessages: 799, reservedServiceMessages: 0 }), 'normal')
  assert.equal(quotaStatus({ ...usage, deliveredServiceMessages: 800, reservedServiceMessages: 0 }), 'attention')
  assert.equal(quotaStatus({ ...usage, deliveredServiceMessages: 900, reservedServiceMessages: 0 }), 'alert')
  assert.equal(quotaStatus({ ...usage, deliveredServiceMessages: 950, reservedServiceMessages: 0 }), 'critical')
})
