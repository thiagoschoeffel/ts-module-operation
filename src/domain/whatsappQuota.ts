import type { WhatsAppQuotaStatus, WhatsAppQuotaUsage } from '../types/attendance'

export function operationalQuotaUsage(usage: WhatsAppQuotaUsage) {
  return usage.deliveredServiceMessages + usage.reservedServiceMessages
}

export function freeMessagesRemaining(usage: WhatsAppQuotaUsage) {
  return Math.max(usage.freeServiceMessageLimit - usage.deliveredServiceMessages, 0)
}

export function messagesUntilAutomationPause(usage: WhatsAppQuotaUsage) {
  return Math.max(usage.automationPauseAt - operationalQuotaUsage(usage), 0)
}

export function quotaPercentage(usage: WhatsAppQuotaUsage) {
  if (usage.freeServiceMessageLimit <= 0) return 0
  return Math.min((usage.deliveredServiceMessages / usage.freeServiceMessageLimit) * 100, 100)
}

export function quotaStatus(usage: Omit<WhatsAppQuotaUsage, 'status'>): WhatsAppQuotaStatus {
  const operationalUsage = operationalQuotaUsage(usage as WhatsAppQuotaUsage)
  if (operationalUsage >= usage.automationPauseAt) return 'automation-blocked'

  const percentage = quotaPercentage(usage as WhatsAppQuotaUsage)
  if (percentage >= 95) return 'critical'
  if (percentage >= 90) return 'alert'
  if (percentage >= 80) return 'attention'
  return 'normal'
}
