<template>
  <view class="page">
    <view v-if="session.ride" class="card">
      <text class="time">{{ elapsed }}</text>
      <text class="fee">预计费用 ¥{{ feeText }}</text>
      <wd-cell title="车辆编号" :value="session.ride.bikeCode" />
      <wd-cell title="订单号" :value="session.ride.id" />
      <wd-cell title="计费" value="15 分钟内 1.50 元，之后每 15 分钟 0.50 元" />
      <wd-notice-bar
        text="请把车停进地图上的绿色区域，再扫描地面二维码还车。"
        prefix="warn-bold"
        wrapable
        :scrollable="false"
        custom-style="margin-top: 16rpx"
      />
      <wd-button block size="large" custom-style="margin-top: 24rpx" @click="goReturn">扫码还车</wd-button>
    </view>
    <view v-else class="card">
      <wd-status-tip image="search" tip="没有进行中的订单" />
      <wd-button block size="large" custom-style="margin-top: 24rpx" @click="goMap">去开锁</wd-button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue"
import { onHide, onShow } from "@dcloudio/uni-app"
import { session } from "../../store/session"
import { estimateFee, formatDuration, formatYuan } from "../../utils/fee"

const now = ref(Date.now())
let timer = 0

const elapsed = computed(() =>
  session.ride ? formatDuration(session.ride.startedAt, now.value) : "00:00"
)
const feeText = computed(() =>
  session.ride ? formatYuan(estimateFee(session.ride.startedAt, now.value)) : "0.00"
)

function goReturn() {
  uni.navigateTo({ url: "/pages/return/index" })
}

function goMap() {
  uni.reLaunch({ url: "/pages/map/index" })
}

onShow(() => {
  now.value = Date.now()
  clearInterval(timer)
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000) as unknown as number
})

onHide(() => {
  clearInterval(timer)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
}

.time {
  display: block;
  font-size: 72rpx;
  font-weight: 650;
  color: #00a870;
  text-align: center;
}

.fee {
  display: block;
  margin: 8rpx 0 24rpx;
  font-size: 28rpx;
  color: #5d6b64;
  text-align: center;
}
</style>
