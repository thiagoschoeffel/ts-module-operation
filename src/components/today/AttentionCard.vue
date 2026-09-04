<script setup lang="ts">
import { ArrowRightIcon, Badge, Button, Card, TriangleAlertIcon } from '@thiagoschoeffel/ts-components'
import { navigate } from '../../utils/navigation'

const attentionItems = [
  {
    message: '4 pedidos aguardando revisão',
    actionLabel: 'Revisar pedidos',
    href: '/operacoes/pedidos?tab=revisao'
  },
  {
    message: '1 entrega falhou',
    actionLabel: 'Ver entrega',
    href: '/operacoes/entregas'
  },
  {
    message: '8 pedidos embalados ainda estão sem rota',
    actionLabel: 'Montar rota',
    href: '/operacoes/entregas'
  }
]

function navigateTo(href?: string) {
  if (href) navigate(href)
}
</script>

<template>
  <Card class="border-l-4 border-l-amber-500">
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-slate-800">
          <TriangleAlertIcon
            :size="18"
            :stroke-width="1.75"
            class="shrink-0 text-amber-600"
            aria-hidden="true" />
          <h2 class="text-sm font-semibold uppercase tracking-wide">
            Requer atenção
          </h2>
        </div>
        <Badge class="shrink-0" variant="warning">
          {{ attentionItems.length }} pendências
        </Badge>
      </div>
    </template>

    <ul class="divide-y divide-slate-200">
      <li
        v-for="item in attentionItems"
        :key="item.message"
        class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
        <span class="min-w-0 text-slate-800">{{ item.message }}</span>

        <Button
          class="shrink-0"
          variant="secondary"
          size="small"
          @click="navigateTo(item.href)">
          {{ item.actionLabel }}
          <template #trailingIcon>
            <ArrowRightIcon />
          </template>
        </Button>
      </li>
    </ul>
  </Card>
</template>
