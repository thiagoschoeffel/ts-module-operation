<script setup lang="ts">
import { computed } from 'vue'
import { PrintPreview } from '@thiagoschoeffel/ts-components'
import type { PackingLabelBundle, PackingLabelPrintSelection } from '../../types/packingLabels'

const props = defineProps<{
  bundle: PackingLabelBundle
  selection: PackingLabelPrintSelection
}>()

const selectedDailyItemLabels = computed(() => {
  const selectedIds = new Set(props.selection.dailyItemLabelIds)
  return props.bundle.dailyItemLabels.filter(label => selectedIds.has(label.id))
})

function productNameClass(name: string) {
  if (name.length > 30) return 'text-sm leading-tight'
  if (name.length > 20) return 'text-base leading-tight'
  return 'text-lg leading-none'
}
</script>

<template>
  <section class="grid gap-4 lg:grid-cols-2" aria-label="Pré-visualização das etiquetas selecionadas">
    <PrintPreview
      v-for="label in selectedDailyItemLabels"
      :key="`preview-${label.id}`"
      variant="label"
      format="100 × 50 mm"
      title="Etiqueta do item"
      :aria-label="`Pré-visualização da etiqueta de ${label.productName}`">
      <div class="h-full p-[5%]">
        <div class="flex items-baseline justify-between gap-3 border-b-2 border-slate-900 pb-[2%]">
          <strong class="shrink-0 text-base sm:text-lg">Sabor Santè</strong>
          <span class="ml-auto text-right text-[8px] font-bold uppercase tracking-wider sm:text-[10px]">Produção do dia</span>
        </div>
        <p class="mt-[2%] text-[9px] font-semibold sm:text-xs">{{ label.customerName }} · Pedido #{{ label.orderId }}</p>
        <h3 class="mt-[2%] break-words font-bold uppercase" :class="productNameClass(label.productName)">{{ label.productName }}</h3>
        <p v-if="label.detailLines.length" class="mt-[1%] break-words text-[9px] leading-tight">{{ label.detailLines.join(' · ') }}</p>
        <p v-if="label.attentionLines.length" class="mt-[2%] break-words border border-slate-900 px-2 py-1 text-[8px] font-bold leading-tight">{{ label.attentionLines.join(' · ') }}</p>
      </div>
    </PrintPreview>

    <PrintPreview
      v-if="selection.includeExternalPackageLabel"
      variant="label"
      format="100 × 50 mm"
      title="Etiqueta do pacote"
      :aria-label="`Pré-visualização da etiqueta externa do pedido ${bundle.externalPackageLabel.orderId}`">
      <div class="h-full p-[5%]">
        <div class="flex items-baseline justify-between gap-3 border-b-2 border-slate-900 pb-[2%]">
          <strong class="shrink-0 text-base sm:text-lg">Sabor Santè</strong>
          <span class="ml-auto text-right text-[8px] font-bold uppercase tracking-wider sm:text-[10px]">Pacote</span>
        </div>
        <h3 class="mt-[3%] break-words font-bold uppercase" :class="productNameClass(bundle.externalPackageLabel.customerName)">{{ bundle.externalPackageLabel.customerName }}</h3>
        <p class="mt-[1%] text-xs font-semibold sm:text-sm">Pedido #{{ bundle.externalPackageLabel.orderId }}</p>
        <p v-if="bundle.externalPackageLabel.addressLines.length" class="mt-[2%] break-words text-[9px] leading-tight">{{ bundle.externalPackageLabel.addressLines.join(' · ') }}</p>
        <p class="mt-[1%] break-words text-[9px] font-semibold leading-tight">{{ bundle.externalPackageLabel.phone ?? 'Retirada / balcão' }}</p>
      </div>
    </PrintPreview>
  </section>
</template>
