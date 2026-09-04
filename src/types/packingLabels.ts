export interface DailyItemLabelSnapshot {
  id: string
  orderItemId: string
  orderId: number
  customerName: string
  productName: string
  detailLines: string[]
  attentionLines: string[]
}

export interface ExternalPackageLabelSnapshot {
  id: string
  orderId: number
  customerName: string
  phone?: string
  addressLines: string[]
  itemSummary: string[]
}

export interface PackingLabelBundle {
  createdAt: string
  dailyItemLabels: DailyItemLabelSnapshot[]
  preLabeledFrozenItemIds: string[]
  externalPackageLabel: ExternalPackageLabelSnapshot
}

export interface PackingLabelPrintSelection {
  dailyItemLabelIds: string[]
  includeExternalPackageLabel: boolean
}

export interface PackingLabelPrintRecord {
  id: string
  occurredAt: string
  responsibleName: string
  dailyItemLabelIds: string[]
  includedExternalPackageLabel: boolean
  status: 'success' | 'error'
  errorMessage?: string
}
