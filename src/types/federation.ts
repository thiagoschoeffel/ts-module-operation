import type { AuthenticatedApiRequest } from '../services/ordersApi'
import type { OperationSection, OrderPage } from './operation'

export interface OperationPageProps {
  section?: OperationSection
  orderPage?: OrderPage
  orderId?: string
  apiRequest?: AuthenticatedApiRequest
}
