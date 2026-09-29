<template>
  <view class="ride-btn" :class="{ disabled }" @click="onClick">
    <view class="mark">
      <view class="corner tl" />
      <view class="corner tr" />
      <view class="corner bl" />
      <view class="corner br" />
    </view>
    <text class="label">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string
    disabled?: boolean
  }>(),
  { label: "扫码用车", disabled: false }
)
const emit = defineEmits<{ click: [] }>()

function onClick() {
  if (props.disabled) return
  emit("click")
}
</script>

<style scoped>
.ride-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  width: 100%;
  height: 96rpx;
  border-radius: 48rpx;
  background: #00a870;
  box-shadow: 0 10rpx 24rpx rgba(0, 120, 80, 0.28);
}

.ride-btn.disabled {
  opacity: 0.55;
}

.mark {
  position: relative;
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.corner {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-color: #fff;
  border-style: solid;
}

.tl {
  top: 0;
  left: 0;
  border-width: 4rpx 0 0 4rpx;
}
.tr {
  top: 0;
  right: 0;
  border-width: 4rpx 4rpx 0 0;
}
.bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 4rpx 4rpx;
}
.br {
  right: 0;
  bottom: 0;
  border-width: 0 4rpx 4rpx 0;
}

.label {
  color: #fff;
  font-size: 34rpx;
  font-weight: 650;
  line-height: 1;
}
</style>
