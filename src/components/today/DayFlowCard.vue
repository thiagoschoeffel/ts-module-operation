<script setup lang="ts">
import { ArrowRightIcon, Card, ScrollArea } from 'ts-components'

const dayFlow = [
  { label: 'Recebidos', value: 48, pending: '6 ainda abertos' },
  { label: 'Confirmados', value: 42, pending: '6 aguardam produção' },
  { label: 'Em produção', value: 36, pending: '7 aguardam embalagem' },
  { label: 'Embalados', value: 29, pending: '11 em rota' },
  { label: 'Entregues', value: 18 }
]
</script>

<template>
  <Card>
    <template #header>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-800">
        Fluxo do dia
      </h2>
    </template>

    <ScrollArea orientation="horizontal">
      <ol class="grid min-w-[40rem] grid-cols-5 pb-10">
        <li v-for="(step, index) in dayFlow" :key="step.label" class="relative min-w-0 text-center">
          <strong class="block text-2xl text-slate-800">{{ step.value }}</strong>
          <span class="mt-1 block font-medium text-slate-600">{{ step.label }}</span>

          <ArrowRightIcon
            v-if="index < dayFlow.length - 1"
            :size="18"
            :stroke-width="1.75"
            class="absolute right-0 top-3 translate-x-1/2 text-slate-400"
            aria-hidden="true" />

          <span
            v-if="step.pending"
            class="absolute left-full top-full mt-4 w-36 -translate-x-1/2 text-center text-xs font-medium leading-4 text-slate-500">
            {{ step.pending }}
          </span>
        </li>
      </ol>
    </ScrollArea>
  </Card>
</template>
