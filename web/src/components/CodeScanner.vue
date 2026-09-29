<template>
  <!-- #ifdef H5 -->
  <CameraScanner :paused="paused" @detect="emit('detect', $event)" />
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <view class="scanner">
    <view class="frame">
      <view class="corner tl" />
      <view class="corner tr" />
      <view class="corner bl" />
      <view class="corner br" />
    </view>
    <view class="action">
      <wd-button size="small" :disabled="paused" @click="scan">
        <!-- #ifdef MP-WEIXIN -->
        微信扫一扫
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        扫一扫
        <!-- #endif -->
      </wd-button>
    </view>
    <view v-if="error" class="error">
      <wd-notice-bar :text="error" type="danger" prefix="warn-bold" wrapable :scrollable="false" />
    </view>
  </view>
  <!-- #endif -->
</template>

<script setup lang="ts">
import { ref } from "vue"
import { isH5 } from "../utils/platform"
// #ifdef H5
import CameraScanner from "./CameraScanner.vue"
// #endif
// #ifndef H5
import { scanQr } from "../utils/scan"
// #endif

const emit = defineEmits<{ detect: [text: string] }>()
const props = defineProps<{ paused?: boolean }>()
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

<style scoped>
.scanner {
  position: relative;
  width: 100%;
  height: 560rpx;
  border-radius: 24rpx;
  overflow: hidden;
  background: #12382c;
}

.frame {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 420rpx;
  height: 420rpx;
  transform: translate(-50%, -50%);
}

.corner {
  position: absolute;
  width: 44rpx;
  height: 44rpx;
  border-color: #fff;
  border-style: solid;
}

.tl {
  top: 0;
  left: 0;
  border-width: 6rpx 0 0 6rpx;
}
.tr {
  top: 0;
  right: 0;
  border-width: 6rpx 6rpx 0 0;
}
.bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 6rpx 6rpx;
}
.br {
  right: 0;
  bottom: 0;
  border-width: 0 6rpx 6rpx 0;
}

.action {
  position: absolute;
  left: 50%;
  bottom: 36rpx;
  transform: translateX(-50%);
  z-index: 2;
}

.error {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 24rpx;
  z-index: 3;
}
</style>
