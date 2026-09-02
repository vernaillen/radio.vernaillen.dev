<script setup lang="ts">
useHead({
  title: 'radio.vernaillen.dev',
  meta: [
    {
      name: 'description',
      content: 'A simple radio app'
    },
    {
      name: 'theme-color',
      id: 'theme-color',
      content: '#0a0908'
    }
  ],
  link: [
    {
      rel: 'manifest',
      key: 'webmanifest',
      href: `/manifest.webmanifest`
    }
  ]
})
</script>

<template>
  <UApp>
    <VitePwaManifest />
    <NuxtPage />
    <PwaInstallPrompt />
  </UApp>
</template>
