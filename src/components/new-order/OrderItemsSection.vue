<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Alert,
  Button,
  CheckIcon,
  Checkbox,
  ChevronLeftIcon,
  ClipboardListIcon,
  Drawer,
  EmptyState,
  PlusIcon,
  RadioGroup,
  SectionCard,
  TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import { formatCurrency, offers, riceSubstitutionOptions } from './mockData'
import type { Customer, Offer, OrderItem } from './types'

const props = defineProps<{
  customer?: Customer
  modelValue: OrderItem[]
}>()
const emit = defineEmits<{
  'update:modelValue': [items: OrderItem[]]
}>()

const drawerOpen = ref(false)
const drawerView = ref<'offers' | 'configuration'>('offers')
const selectedOffer = ref<Offer>()
const editingItemId = ref<string>()
const selectedDish = ref('traditional')
const selectedFruit = ref('banana')
const proteinExtra = ref(false)
const sauceExtra = ref(false)
const personalizationOpen = ref(false)
const riceChoice = ref('remove')
const riceSubstitution = ref(riceSubstitutionOptions[0].value)
const feedback = ref('')
const removeConfirmationId = ref<string>()

const dishOptions = [
  { value: 'traditional', label: 'Tradicional', description: 'Estrogonofe de frango' },
  { value: 'low-carb', label: 'Low Carb', description: 'Frango grelhado' },
  { value: 'vegetarian', label: 'Vegetariano · Esgotado', description: 'Lasanha de berinjela', disabled: true }
]
const fruitOptions = [
  { value: 'apple', label: 'Maçã' },
  { value: 'banana', label: 'Banana' }
]
const riceOptions = [
  { value: 'keep', label: 'Manter' },
  { value: 'remove', label: 'Remover' },
  { value: 'replace', label: 'Substituir' }
]

const hasRestrictionConflict = computed(() =>
  props.customer?.restriction === 'Lactose' && selectedDish.value === 'traditional'
)
const itemTotal = computed(() =>
  (selectedOffer.value?.price ?? 0) + (proteinExtra.value ? 5 : 0) + (sauceExtra.value ? 2 : 0)
)

function resetConfiguration() {
  selectedDish.value = 'traditional'
  selectedFruit.value = 'banana'
  proteinExtra.value = false
  sauceExtra.value = false
  personalizationOpen.value = false
  riceChoice.value = props.customer?.preference === 'Sem arroz'
    ? 'remove'
    : props.customer?.preference === 'Substituir arroz por legumes'
      ? 'replace'
      : 'keep'
  riceSubstitution.value = riceSubstitutionOptions[0].value
}

function addSimpleOffer(offer: Offer) {
  const item: OrderItem = {
    id: `item-${Date.now()}`,
    offerId: offer.id,
    name: offer.name,
    price: offer.price,
    details: [offer.description],
    additions: [],
    customizations: props.customer?.preference === 'Sem arroz' ? ['Sem arroz'] : [],
    hasRestrictionConflict: props.customer?.restriction === 'Lactose' && offer.id === 'daily'
  }
  emit('update:modelValue', [...props.modelValue, item])
  feedback.value = `${offer.name} adicionado`
}

function configureOffer(offer: Offer) {
  selectedOffer.value = offer
  editingItemId.value = undefined
  resetConfiguration()
  drawerView.value = 'configuration'
}

function saveConfiguredItem() {
  if (!selectedOffer.value)
    return

  const dish = dishOptions.find((option) => option.value === selectedDish.value)
  const fruit = fruitOptions.find((option) => option.value === selectedFruit.value)
  const riceReplacement = riceSubstitutionOptions.find((option) => option.value === riceSubstitution.value)
  const item: OrderItem = {
    id: editingItemId.value ?? `item-${Date.now()}`,
    offerId: selectedOffer.value.id,
    name: selectedOffer.value.name,
    price: itemTotal.value,
    details: [
      `${dish?.label ?? ''} · ${dish?.description ?? ''}`,
      ...(selectedOffer.value.id === 'fruit' || selectedOffer.value.id === 'complete' ? [`Fruta · ${fruit?.label}`] : []),
      ...(selectedOffer.value.id === 'complete' ? ['Salada P · Salada de folhas'] : [])
    ],
    additions: [
      ...(proteinExtra.value ? ['Proteína extra · + R$ 5,00'] : []),
      ...(sauceExtra.value ? ['Molho extra · + R$ 2,00'] : [])
    ],
    customizations: riceChoice.value === 'remove'
      ? ['Sem arroz']
      : riceChoice.value === 'replace' && riceReplacement
        ? [`Arroz substituído por ${riceReplacement.label.toLocaleLowerCase('pt-BR')}`]
        : [],
    hasRestrictionConflict: hasRestrictionConflict.value
  }

  const items = editingItemId.value
    ? props.modelValue.map((current) => current.id === editingItemId.value ? item : current)
    : [...props.modelValue, item]
  emit('update:modelValue', items)
  feedback.value = editingItemId.value ? `${item.name} atualizado` : `${item.name} adicionado`
  drawerView.value = 'offers'
  editingItemId.value = undefined
}

function editItem(item: OrderItem) {
  const offer = offers.find((current) => current.id === item.offerId)
  if (!offer)
    return
  selectedOffer.value = offer
  editingItemId.value = item.id
  selectedDish.value = item.details.some((detail) => detail.startsWith('Low Carb')) ? 'low-carb' : 'traditional'
  selectedFruit.value = item.details.some((detail) => detail.includes('Maçã')) ? 'apple' : 'banana'
  proteinExtra.value = item.additions.some((addition) => addition.startsWith('Proteína'))
  sauceExtra.value = item.additions.some((addition) => addition.startsWith('Molho'))
  const riceReplacement = riceSubstitutionOptions.find((option) =>
    item.customizations.includes(`Arroz substituído por ${option.label.toLocaleLowerCase('pt-BR')}`)
  )
  riceChoice.value = item.customizations.includes('Sem arroz') ? 'remove' : riceReplacement ? 'replace' : 'keep'
  riceSubstitution.value = riceReplacement?.value ?? riceSubstitutionOptions[0].value
  personalizationOpen.value = item.customizations.length > 0
  drawerView.value = 'configuration'
  drawerOpen.value = true
}

function removeItem(itemId: string) {
  emit('update:modelValue', props.modelValue.filter((item) => item.id !== itemId))
  removeConfirmationId.value = undefined
}

function handleDrawerOpen(open: boolean) {
  drawerOpen.value = open
  if (!open) {
    drawerView.value = 'offers'
    editingItemId.value = undefined
    feedback.value = ''
  }
}
</script>

<template>
  <SectionCard
    title="Itens do pedido"
    :disabled="!props.customer"
    :description="props.customer ? 'Adicione as ofertas disponíveis no cardápio de hoje.' : 'Selecione um cliente para adicionar itens.'">
    <div v-if="props.customer" class="space-y-3">
      <EmptyState
        v-if="props.modelValue.length === 0"
        title="Nenhum item adicionado"
        description="Escolha uma oferta do cardápio de hoje.">
        <template #icon><ClipboardListIcon /></template>
      </EmptyState>

      <article
        v-for="item in props.modelValue"
        :key="item.id"
        class="rounded-lg border border-slate-200 bg-white p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-slate-800">{{ item.name }}</h3>
            <p v-for="detail in item.details" :key="detail" class="mt-1 text-sm text-slate-500">{{ detail }}</p>
          </div>
          <p class="shrink-0 font-semibold text-slate-800">{{ formatCurrency(item.price) }}</p>
        </div>
        <div v-if="item.customizations.length || item.additions.length" class="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div v-if="item.customizations.length">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Personalização</p>
            <p v-for="customization in item.customizations" :key="customization" class="mt-1 text-sm text-slate-600">{{ customization }}</p>
          </div>
          <div v-if="item.additions.length">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Adicional</p>
            <p v-for="addition in item.additions" :key="addition" class="mt-1 text-sm text-slate-600">{{ addition }}</p>
          </div>
        </div>
        <p v-if="item.hasRestrictionConflict" class="mt-3 flex items-center gap-2 text-xs font-medium text-amber-700">
          <TriangleAlertIcon class="size-4" /> Restrição alimentar precisa de revisão
        </p>
        <div class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <template v-if="removeConfirmationId === item.id">
            <span class="mr-auto self-center text-xs font-medium text-slate-600">Remover item?</span>
            <Button type="button" variant="secondary" size="small" @click="removeConfirmationId = undefined">Cancelar</Button>
            <Button type="button" variant="danger" size="small" @click="removeItem(item.id)">Remover</Button>
          </template>
          <template v-else>
            <Button type="button" variant="secondary" size="small" @click="editItem(item)">Editar</Button>
            <Button type="button" variant="danger" size="small" @click="removeConfirmationId = item.id">Remover</Button>
          </template>
        </div>
      </article>

      <Drawer
        :open="drawerOpen"
        side="right"
        size="large"
        :title="drawerView === 'offers' ? 'Adicionar item' : editingItemId ? 'Editar item' : 'Configurar item'"
        :description="drawerView === 'offers' ? 'Ofertas disponíveis hoje' : selectedOffer?.name"
        @update:open="handleDrawerOpen">
        <template #trigger>
          <Button type="button" :variant="props.modelValue.length ? 'secondary' : 'primary'">
            <template #icon><PlusIcon /></template>
            {{ props.modelValue.length ? 'Adicionar outro item' : 'Adicionar item' }}
          </Button>
        </template>

        <div v-if="drawerView === 'offers'" class="space-y-3">
          <Alert v-if="feedback" variants="success" :description="feedback">
            <template #icon><CheckIcon /></template>
          </Alert>
          <article v-for="offer in offers" :key="offer.id" class="rounded-lg border border-slate-200 p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="font-semibold text-slate-800">{{ offer.name }}</h3>
                <p class="mt-1 text-xs text-slate-500">{{ offer.description }}</p>
              </div>
              <p class="shrink-0 font-semibold text-slate-800">{{ formatCurrency(offer.price) }}</p>
            </div>
            <Button class="mt-4" type="button" variant="secondary" size="small" @click="offer.requiresConfiguration ? configureOffer(offer) : addSimpleOffer(offer)">
              {{ offer.requiresConfiguration ? 'Configurar' : 'Adicionar' }}
            </Button>
          </article>
        </div>

        <div v-else-if="selectedOffer" class="space-y-6">
          <button type="button" class="inline-flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-800" @click="drawerView = 'offers'">
            <ChevronLeftIcon class="size-4" /> Ofertas
          </button>
          <div class="flex items-start justify-between gap-4">
            <h3 class="text-lg font-semibold text-slate-900">{{ selectedOffer.name }}</h3>
            <p class="font-semibold text-slate-900">{{ formatCurrency(selectedOffer.price) }}</p>
          </div>

          <RadioGroup v-model="selectedDish" label="Prato" :options="dishOptions" />
          <RadioGroup
            v-if="selectedOffer.id === 'fruit' || selectedOffer.id === 'complete'"
            v-model="selectedFruit"
            label="Fruta"
            :options="fruitOptions" />
          <div v-if="selectedOffer.id === 'complete'">
            <p class="text-sm font-medium text-slate-700">Salada</p>
            <p class="mt-2 text-sm text-slate-600">Salada de folhas</p>
            <p class="mt-1 text-xs text-slate-400">Selecionada automaticamente por ser a única opção disponível.</p>
          </div>

          <Alert
            v-if="hasRestrictionConflict"
            variants="warning"
            title="Restrição alimentar"
            :description="`${props.customer.name} possui restrição a lactose. Estrogonofe contém ingrediente marcado com lactose.`">
            <template #icon><TriangleAlertIcon /></template>
            <template #actions>
              <Button type="button" variant="secondary" size="small" @click="selectedDish = 'low-carb'">Escolher Low Carb</Button>
            </template>
          </Alert>

          <Alert
            v-if="props.customer.preference"
            variants="success"
            title="Preferência do cliente"
            :description="`${props.customer.preference} aplicada`">
            <template #icon><CheckIcon /></template>
          </Alert>

          <div class="flex flex-wrap gap-x-4 gap-y-3">
            <p class="w-full text-sm font-medium text-slate-700">Adicionais</p>
            <Checkbox v-model="proteinExtra" label="Proteína extra" description="+ R$ 5,00" />
            <Checkbox v-model="sauceExtra" label="Molho extra" description="+ R$ 2,00" />
          </div>

          <div>
            <Button type="button" variant="secondary" size="small" @click="personalizationOpen = !personalizationOpen">Personalizar</Button>
            <div v-if="personalizationOpen" class="mt-4 rounded-lg border border-slate-200 p-4">
              <RadioGroup v-model="riceChoice" label="Arroz" :options="riceOptions" />
              <RadioGroup
                v-if="riceChoice === 'replace'"
                v-model="riceSubstitution"
                class="mt-4 border-t border-slate-200 pt-4"
                label="Substituir por"
                :options="riceSubstitutionOptions" />
            </div>
          </div>
        </div>

        <template #footer="{ close }">
          <div v-if="drawerView === 'offers'" class="flex justify-end">
            <Button type="button" variant="secondary" @click="close">Fechar</Button>
          </div>
          <div v-else class="flex items-center justify-between gap-4">
            <div>
              <p class="text-xs text-slate-500">Total do item</p>
              <p class="font-semibold text-slate-900">{{ formatCurrency(itemTotal) }}</p>
            </div>
            <Button type="button" :disabled="hasRestrictionConflict" @click="saveConfiguredItem">
              {{ editingItemId ? 'Salvar alterações' : 'Adicionar ao pedido' }}
            </Button>
          </div>
        </template>
      </Drawer>
    </div>
  </SectionCard>
</template>
