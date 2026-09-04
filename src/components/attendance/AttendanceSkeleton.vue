<template>
  <div
    class="grid h-full min-h-[32rem] gap-4 bg-slate-50/70 md:min-h-0 md:grid-cols-[30rem_minmax(0,1fr)]"
    role="status"
    aria-label="Carregando conversas e histórico"
    aria-busy="true">
    <span class="sr-only">Carregando conversas e histórico...</span>

    <aside class="flex min-h-0 min-w-0 flex-col animate-pulse" aria-hidden="true">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div class="flex gap-2">
          <div v-for="width in ['w-24', 'w-28', 'w-20', 'w-24']" :key="width" class="h-8 rounded-lg bg-slate-200" :class="width" />
        </div>
        <div class="mt-3 h-10 rounded-lg border border-slate-200 bg-slate-100" />
      </div>

      <div class="mt-3 min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
        <div v-for="index in 5" :key="index" class="flex gap-3 rounded-lg p-3">
          <div class="size-10 shrink-0 rounded-full bg-slate-200" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-4">
              <div class="h-4 rounded bg-slate-200" :class="index % 2 ? 'w-36' : 'w-44'" />
              <div class="h-3 w-10 rounded bg-slate-100" />
            </div>
            <div class="mt-2 h-3 w-28 rounded bg-slate-100" />
            <div class="mt-3 h-5 w-20 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    </aside>

    <section
      class="attendance-skeleton-detail min-h-0 min-w-0 animate-pulse flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs"
      aria-hidden="true">
      <header class="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
        <div>
          <div class="h-4 w-40 rounded bg-slate-200" />
          <div class="mt-2 h-3 w-48 rounded bg-slate-100" />
        </div>
        <div class="flex gap-2">
          <div class="h-8 w-28 rounded-lg bg-slate-100" />
          <div class="h-8 w-24 rounded-lg bg-slate-200" />
        </div>
      </header>

      <div class="border-b border-slate-100 px-4 py-3">
        <div class="h-3 w-72 max-w-full rounded bg-slate-100" />
      </div>

      <div class="min-h-0 flex-1 space-y-4 bg-slate-50/70 p-4">
        <div class="h-20 w-[62%] rounded-lg border border-slate-200 bg-white shadow-sm" />
        <div class="ml-auto h-24 w-[68%] rounded-lg border border-emerald-100 bg-emerald-50/70 shadow-sm" />
        <div class="h-28 w-[72%] rounded-lg border border-slate-200 bg-white shadow-sm" />
        <div class="ml-auto h-20 w-[56%] rounded-lg border border-emerald-100 bg-emerald-50/70 shadow-sm" />
      </div>

      <footer class="border-t border-slate-200 p-4">
        <div class="h-24 rounded-lg border border-slate-200 bg-slate-100" />
        <div class="mt-3 flex justify-between">
          <div class="h-8 w-28 rounded-lg bg-slate-100" />
          <div class="h-8 w-20 rounded-lg bg-slate-200" />
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.attendance-skeleton-detail {
  display: none;
}

@media (min-width: 48rem) {
  .attendance-skeleton-detail {
    display: flex;
  }
}
</style>
