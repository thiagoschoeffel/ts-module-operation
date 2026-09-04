export interface OrderFulfillmentItem {
  fulfillmentSource?: 'daily-production' | 'frozen-stock'
}

export function contributesToDailyProduction(item: OrderFulfillmentItem) {
  return item.fulfillmentSource !== 'frozen-stock'
}
