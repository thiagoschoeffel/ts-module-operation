<script setup lang="ts">
import { computed, ref } from 'vue'
import { Alert, Badge, Button, Card, ChevronLeftIcon, ClipboardListIcon, Drawer, EmptyState, InfoIcon, Input, RadioGroup, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { formatCurrency } from './mockData'
import type { ApiOrderAuthoringContext, OrderItemInput } from '../../services/ordersApi'

const props = defineProps<{
  context?: ApiOrderAuthoringContext
  modelValue: OrderItemInput[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [items: OrderItemInput[]] }>()

const drawerOpen = ref(false)
const drawerView = ref<'offers' | 'configuration'>('offers')
const selectedOfferId = ref('')
const selectedProducibleId = ref('')
const selectedFrozenConfigurationId = ref('')
const quantity = ref(1)
const editingIndex = ref<number>()
const feedback = ref('')
const itemError = ref('')
const removeConfirmationIndex = ref<number>()

const offers = computed(() => props.context?.offers ?? [])
const selectedOffer = computed(() => offers.value.find(offer => offer.id === selectedOfferId.value))
const menuOptions = computed(() => props.context?.menuOptions.filter(option => option.availability === 'Available') ?? [])
const producibleOptions = computed(() => menuOptions.value.map(option => ({
  value: option.producibleItemId,
  label: option.category,
  description: option.producibleItemName
})))
const frozenConfigurations = computed(() => props.context?.frozenConfigurations.filter(configuration => configuration.offerId === selectedOfferId.value) ?? [])
const frozenOptions = computed(() => frozenConfigurations.value.map(configuration => ({
  value: configuration.id,
  label: `${configuration.producibleItemName} · ${configuration.presentation}`,
  description: configuration.availableQuantity > 0
    ? `${configuration.availableQuantity} disponíveis · ${formatCurrency(configuration.unitPrice)}`
    : `Sem estoque disponível · ${formatCurrency(configuration.unitPrice)}`,
  disabled: configuration.availableQuantity < 1
})))

function itemPresentation(item: OrderItemInput) {
  const offer = offers.value.find(current => current.id === item.offerId)
  const producible = props.context?.producibles.find(current => current.id === item.producibleItemId)
  const frozen = props.context?.frozenConfigurations.find(current => current.id === item.frozenConfigurationId)
  const unitPrice = frozen?.unitPrice ?? item.unitPrice ?? 0
  return {
    name: offer?.name ?? 'Oferta',
    detail: frozen ? `${frozen.producibleItemName} · ${frozen.presentation}` : producible?.name ?? 'Opção do cardápio',
    frozen: Boolean(frozen),
    total: unitPrice * item.quantity
  }
}

function configureOffer(offerId: string, index?: number) {
  const item = index === undefined ? undefined : props.modelValue[index]
  selectedOfferId.value = offerId
  selectedProducibleId.value = item?.producibleItemId ?? menuOptions.value[0]?.producibleItemId ?? ''
  selectedFrozenConfigurationId.value = item?.frozenConfigurationId
    ?? props.context?.frozenConfigurations.find(configuration => configuration.offerId === offerId && configuration.availableQuantity > 0)?.id
    ?? ''
  quantity.value = item?.quantity ?? 1
  editingIndex.value = index
  itemError.value = ''
  drawerView.value = 'configuration'
}

function saveItem() {
  const offer = selectedOffer.value
  if (!offer || !Number.isInteger(quantity.value) || quantity.value < 1) {
    itemError.value = 'Informe uma quantidade inteira maior que zero.'
    return
  }
  let item: OrderItemInput
  if (offer.fulfillmentMode === 'DailyProduction') {
    if (!selectedProducibleId.value || offer.effectivePrice === undefined) {
      itemError.value = 'Selecione uma opção disponível do cardápio publicado.'
      return
    }
    item = { offerId: offer.id, producibleItemId: selectedProducibleId.value, unitPrice: offer.effectivePrice, quantity: quantity.value }
  }
  else {
    const configuration = frozenConfigurations.value.find(current => current.id === selectedFrozenConfigurationId.value)
    if (!configuration || configuration.availableQuantity < quantity.value) {
      itemError.value = 'Selecione uma configuração com estoque suficiente.'
      return
    }
    item = { offerId: offer.id, frozenConfigurationId: configuration.id, quantity: quantity.value }
  }
  const items = [...props.modelValue]
  editingIndex.value === undefined ? items.push(item) : items.splice(editingIndex.value, 1, item)
  emit('update:modelValue', items)
  feedback.value = editingIndex.value === undefined ? `${offer.name} adicionado` : `${offer.name} atualizado`
  drawerView.value = 'offers'
  editingIndex.value = undefined
}

function removeItem(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, current) => current !== index))
  removeConfirmationIndex.value = undefined
}

function handleDrawerOpen(open: boolean) {
  drawerOpen.value = open
  if (!open) {
    drawerView.value = 'offers'
    editingIndex.value = undefined
    feedback.value = ''
    itemError.value = ''
  }
}
</script>

<template>
  <Card :aria-disabled="props.disabled || undefined" :inert="props.disabled || undefined" :class="props.disabled ? 'bg-slate-50 opacity-60' : ''">
    <template #header>
      <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Itens do pedido</h2>
      <p class="mt-1 text-sm text-slate-500">{{ props.disabled ? 'Selecione um cliente para adicionar itens.' : 'Adicione ofertas do cardápio ou preparações congeladas disponíveis.' }}</p>
    </template>

    <div v-if="!props.disabled" class="space-y-3">
      <EmptyState v-if="props.modelValue.length === 0" :bordered="false" title="Nenhum item adicionado" description="Escolha uma oferta para começar a montar o pedido.">
        <template #icon><ClipboardListIcon /></template>
      </EmptyState>

      <article v-for="(item, index) in props.modelValue" :key="`${item.offerId}-${index}`" class="rounded-lg border border-slate-200 bg-white p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-slate-800">{{ itemPresentation(item).name }}</h3><Badge v-if="itemPresentation(item).frozen" variant="info">Congelado</Badge></div>
            <p class="mt-1 text-sm text-slate-500">{{ itemPresentation(item).detail }} · {{ item.quantity }} {{ item.quantity === 1 ? 'unidade' : 'unidades' }}</p>
          </div>
          <p class="shrink-0 font-semibold text-slate-800">{{ formatCurrency(itemPresentation(item).total) }}</p>
        </div>
        <div class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <template v-if="removeConfirmationIndex === index">
            <span class="self-center text-xs font-medium text-slate-600">Remover item?</span>
            <Button type="button" variant="secondary" size="small" @click="removeConfirmationIndex = undefined">Cancelar</Button>
            <Button type="button" variant="danger" size="small" @click="removeItem(index)">Sim</Button>
          </template>
          <template v-else>
            <Button type="button" variant="secondary" size="small" @click="configureOffer(item.offerId, index)">Editar</Button>
            <Button type="button" variant="danger" size="small" @click="removeConfirmationIndex = index">Remover</Button>
          </template>
        </div>
      </article>

      <Drawer :open="drawerOpen" side="right" size="large" :title="drawerView === 'offers' ? 'Adicionar item' : editingIndex === undefined ? 'Configurar item' : 'Editar item'" :description="drawerView === 'offers' ? 'Ofertas disponíveis para este pedido' : selectedOffer?.name" @update:open="handleDrawerOpen">
        <template #trigger><Button type="button" size="small">Adicionar item</Button></template>

        <div v-if="drawerView === 'offers'" class="space-y-3">
          <Alert v-if="feedback" variants="success" :description="feedback" />
          <EmptyState v-if="offers.length === 0" :bordered="false" title="Nenhuma oferta disponível" description="Publique o cardápio ou disponibilize uma configuração congelada para esta data.">
            <template #icon><ClipboardListIcon /></template>
          </EmptyState>
          <article v-for="offer in offers" :key="offer.id" class="rounded-lg border border-slate-200 p-4">
            <div class="flex items-start justify-between gap-4">
              <div><div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-slate-800">{{ offer.name }}</h3><Badge v-if="offer.fulfillmentMode === 'FrozenStock'" variant="info">Estoque</Badge></div><p class="mt-1 text-xs text-slate-500">{{ offer.fulfillmentMode === 'FrozenStock' ? 'O preço depende da apresentação escolhida.' : 'Produção diária conforme o cardápio publicado.' }}</p></div>
              <p v-if="offer.effectivePrice !== undefined" class="shrink-0 font-semibold text-slate-800">{{ formatCurrency(offer.effectivePrice) }}</p>
            </div>
            <Button class="mt-4" type="button" size="small" @click="configureOffer(offer.id)">Configurar</Button>
          </article>
        </div>

        <div v-else class="space-y-5">
          <button type="button" class="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-800" @click="drawerView = 'offers'"><ChevronLeftIcon class="size-4" /> Voltar para ofertas</button>
          <Alert v-if="selectedOffer?.fulfillmentMode === 'FrozenStock'" variants="info" title="Alocação na confirmação" description="O saldo será conferido novamente e os lotes serão alocados somente ao confirmar o pedido."><template #icon><InfoIcon /></template></Alert>
          <RadioGroup v-if="selectedOffer?.fulfillmentMode === 'DailyProduction'" v-model="selectedProducibleId" :options="producibleOptions" label="Opção do cardápio" name="order-menu-option" />
          <RadioGroup v-else v-model="selectedFrozenConfigurationId" :options="frozenOptions" label="Preparação congelada" name="order-frozen-configuration" />
          <Input v-model="quantity" type="number" min="1" step="1" label="Quantidade" required />
          <Alert v-if="itemError" variants="danger" :description="itemError"><template #icon><TriangleAlertIcon /></template></Alert>
          <div class="flex justify-end"><Button type="button" @click="saveItem">{{ editingIndex === undefined ? 'Adicionar ao pedido' : 'Salvar item' }}</Button></div>
        </div>
      </Drawer>
    </div>
  </Card>
</template>
