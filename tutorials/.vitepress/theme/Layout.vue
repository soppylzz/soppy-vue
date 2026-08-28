<script setup lang="ts">
import DefaultTheme from "vitepress/theme"
import HeroLogo from "./HeroLogo.vue"
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <HeroLogo />
    </template>
  </DefaultTheme.Layout>
</template>
