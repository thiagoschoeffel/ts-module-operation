<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Badge,
  Button,
  Card,
  Combobox,
  EmptyState,
  SearchIcon,
  TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import type { Customer } from './types'

const props = withDefaults(defineProps<{ modelValue?: Customer, customers?: Customer[] }>(), { customers: () => [] })
const emit = defineEmits<{
  'update:modelValue': [customer: Customer | undefined]
}>()

const search = ref('')

const matchingCustomers = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('pt-BR')
  if (!query)
    return []

  const normalizedQuery = query.replace(/\D/g, '')
  return props.customers.filter((customer) =>
    customer.name.toLocaleLowerCase('pt-BR').includes(query)
    || (normalizedQuery && customer.phone.replace(/\D/g, '').includes(normalizedQuery))
  )
})
const matchingCustomerOptions = computed(() => matchingCustomers.value.map((customer) => ({
  value: customer.id,
  label: customer.name,
  description: customer.phone
})))

function selectCustomer(customer: Customer) {
  emit('update:modelValue', customer)
  search.value = ''
}

function selectCustomerById(customerId?: string) {
  const customer = props.customers.find((current) => current.id === customerId)
  if (customer)
    selectCustomer(customer)
}

</script>

<template>
  <Card>
    <template #header>
      <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Cliente</h2>
      <p class="mt-1 text-sm text-slate-500">Busque por nome ou telefone para começar.</p>
    </template>
    <div v-if="!props.modelValue">
      <Combobox
        :model-value="undefined"
        v-model:search-value="search"
        :options="matchingCustomerOptions"
        external-filter
        aria-label="Buscar cliente por nome ou telefone"
        placeholder="Buscar cliente por nome ou telefone..."
        @update:model-value="selectCustomerById">
        <template #leading><SearchIcon /></template>
        <template #empty>
          <EmptyState
            v-if="search.trim()"
            :bordered="false"
            size="small"
            title="Nenhum cliente encontrado"
            description="Revise a busca ou cadastre o cliente na área de Clientes.">
            <template #icon><SearchIcon /></template>
          </EmptyState>
          <EmptyState
            v-else
            :bordered="false"
            size="small"
            title="Busque um cliente"
            description="Digite o nome ou telefone para encontrar um cadastro.">
            <template #icon><SearchIcon /></template>
          </EmptyState>
        </template>
      </Combobox>
    </div>

    <div v-else>
      <div class="ts-responsive-row-start gap-4">
        <div>
          <p class="font-semibold text-slate-800">{{ props.modelValue.name }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ props.modelValue.phone }}</p>
          <Badge class="mt-3" variant="success" size="small">{{ props.modelValue.channel }}</Badge>
        </div>
        <Button type="button" variant="secondary" size="small" @click="$emit('update:modelValue', undefined)">
          Trocar cliente
        </Button>
      </div>

      <div v-if="props.modelValue.restriction || props.modelValue.preference" class="mt-4 space-y-2 border-t border-slate-100 pt-4">
        <p v-if="props.modelValue.restriction" class="flex items-center gap-2 text-sm font-medium text-amber-700">
          <TriangleAlertIcon class="size-4" />
          Restrição: {{ props.modelValue.restriction.toLocaleLowerCase('pt-BR') }}
        </p>
        <p v-if="props.modelValue.preference" class="text-sm text-slate-600">
          Preferência: {{ props.modelValue.preference.toLocaleLowerCase('pt-BR') }}
        </p>
      </div>
    </div>
  </Card>
</template>
