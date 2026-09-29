<script setup lang="ts">
import { computed } from "vue"
// #ifndef MP
import { Icon } from "@iconify/vue"
import accountIcon from "@iconify-icons/mdi/account"
import bikeIcon from "@iconify-icons/mdi/bicycle"
// #endif

const props = withDefaults(
  defineProps<{
    name: "account" | "bike"
    size?: number | string
    color?: string
  }>(),
  { size: 24, color: "currentColor" }
)

const box = computed(() => {
  const size = typeof props.size === "number" ? `${props.size}px` : props.size
  return { width: size, height: size }
})

// #ifndef MP
const icons = { account: accountIcon, bike: bikeIcon }
// #endif
</script>

<template>
  <!-- #ifndef MP -->
  <Icon :icon="icons[name]" :width="size" :height="size" :color="color" />
  <!-- #endif -->
  <!-- #ifdef MP -->
  <view class="ico" :class="name" :style="box">
    <template v-if="name === 'account'">
      <view class="head" :style="{ background: color }" />
      <view class="body" :style="{ background: color }" />
    </template>
    <template v-else>
      <view class="wheel left" :style="{ borderColor: color }" />
      <view class="wheel right" :style="{ borderColor: color }" />
      <view class="bar" :style="{ background: color }" />
    </template>
  </view>
  <!-- #endif -->
</template>

<style scoped>
.ico {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.head {
  position: absolute;
  top: 8%;
  left: 32%;
  width: 36%;
  height: 36%;
  border-radius: 50%;
}

.body {
  position: absolute;
  left: 18%;
  bottom: 6%;
  width: 64%;
  height: 38%;
  border-radius: 40rpx 40rpx 12rpx 12rpx;
}

.wheel {
  position: absolute;
  bottom: 12%;
  width: 34%;
  height: 34%;
  border-radius: 50%;
  border-width: 2px;
  border-style: solid;
  box-sizing: border-box;
}

.wheel.left {
  left: 6%;
}

.wheel.right {
  right: 6%;
}

.bar {
  position: absolute;
  left: 22%;
  right: 22%;
  top: 38%;
  height: 2px;
  transform: rotate(-18deg);
}
</style>
