<template>
  <div
    v-if="$pwa?.showInstallPrompt && !$pwa?.needRefresh"
    class="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-default bg-elevated/90 p-4 shadow-xl backdrop-blur"
    v-bind="$attrs"
  >
    <span class="text-sm">Install the radio app?</span>
    <div class="flex gap-2">
      <UButton
        icon="i-lucide-download"
        label="Install"
        @click="$pwa.install()"
      />
      <UButton
        color="neutral"
        variant="ghost"
        label="Dismiss"
        @click="$pwa.cancelInstall()"
      />
    </div>
  </div>
</template>
