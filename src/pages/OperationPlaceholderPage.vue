<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <p class="text-slate-600">Conteúdo da área de {{ title.toLowerCase() }}.</p>
</template>
