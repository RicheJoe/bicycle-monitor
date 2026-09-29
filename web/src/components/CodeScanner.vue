<template>
  <!-- #ifdef H5 -->
  <CameraScanner :paused="paused" @detect="emit('detect', $event)" />
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <view class="wrap">
    <RideScanButton :label="label" :disabled="paused" @click="scan" />
    <view v-if="error" class="error">
      <wd-notice-bar :text="error" type="danger" prefix="warn-bold" wrapable :scrollable="false" />
    </view>
  </view>
  <!-- #endif -->
</template>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { ref } from "vue"
import { isH5 } from "../utils/platform"
// #ifdef H5
import CameraScanner from "./CameraScanner.vue"
// #endif
// #ifndef H5
import RideScanButton from "./RideScanButton.vue"
import { scanQr } from "../utils/scan"
// #endif

const emit = defineEmits<{ detect: [text: string] }>()
const props = withDefaults(
  defineProps<{
    paused?: boolean
    label?: string
  }>(),
  { label: "扫码用车" }
)
const error = ref("")

async function scan() {
  if (props.paused || isH5()) return
  // #ifndef H5
  error.value = ""
  try {
    emit("detect", await scanQr())
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    if (!message || message === "cancel" || message === "empty") return
    error.value = "扫码失败，请重试"
  }
  // #endif
}
</script>

<style>
:host {
  display: block;
  width: 100%;
}
</style>

<style scoped>
.wrap {
  width: 100%;
}

.error {
  margin-top: 20rpx;
}
</style>
