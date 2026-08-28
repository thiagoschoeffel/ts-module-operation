import {
  CalendarDaysIcon,
  ClipboardListIcon,
  CookingPotIcon,
  MessagesSquareIcon,
  PackageCheckIcon,
  TruckIcon
} from '@thiagoschoeffel/ts-components'
import type { OperationPageConfig, OperationSection } from '../types/operation'
import { formatLongDate } from '../utils/date'

export const operationPages: Record<OperationSection, OperationPageConfig> = {
  hoje: {
    title: 'Operação de hoje',
    subtitle: formatLongDate(),
    icon: CalendarDaysIcon
  },
  atendimento: { title: 'Atendimento', icon: MessagesSquareIcon },
  pedidos: {
    title: 'Pedidos',
    subtitle: 'Pedidos da operação de hoje',
    icon: ClipboardListIcon
  },
  producao: { title: 'Produção', icon: CookingPotIcon },
  embalagem: { title: 'Embalagem', icon: PackageCheckIcon },
  entregas: { title: 'Entregas', icon: TruckIcon }
}
