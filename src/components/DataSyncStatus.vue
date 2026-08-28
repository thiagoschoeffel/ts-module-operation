<script setup lang="ts">
type SyncStatus = 'synced' | 'syncing' | 'error'

const props = withDefaults(defineProps<{ status?: SyncStatus }>(), {
  status: 'synced'
})

const statuses: Record<SyncStatus, { label: string; indicatorClass: string }> = {
  synced: { label: 'Dados sincronizados', indicatorClass: 'bg-emerald-500' },
  syncing: { label: 'Sincronizando dados', indicatorClass: 'bg-amber-500' },
  error: { label: 'Falha na sincronização', indicatorClass: 'bg-red-500' }
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-600" role="status">
    <span class="size-2 rounded-full" :class="statuses[props.status].indicatorClass" aria-hidden="true" />
    {{ statuses[props.status].label }}
  </div>
</template>
