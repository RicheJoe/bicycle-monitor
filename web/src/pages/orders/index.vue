<template>
  <view class="page">
    <wd-cell-group v-if="session.ride" border custom-style="margin-bottom: 16rpx">
      <wd-cell
        :title="session.ride.bikeCode"
        :label="`${formatClock(session.ride.startedAt)} 开始 · 查看行程`"
        is-link
        @click="goRiding"
      >
        <wd-tag type="success" plain>骑行中</wd-tag>
      </wd-cell>
    </wd-cell-group>

    <wd-status-tip
      v-if="session.orders.length === 0 && !session.ride"
      image="search"
      tip="还没有订单"
    />

    <wd-cell-group v-if="session.orders.length" border>
      <wd-cell
        v-for="order in session.orders"
        :key="order.id"
        :title="order.bikeCode"
        :value="`¥${order.fee.toFixed(2)}`"
        :label="`${formatClock(order.startedAt)} - ${formatClock(order.endedAt)} · ${order.parkingName}`"
      />
    </wd-cell-group>
  </view>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app"
import { refreshAccount, session } from "../../store/session"

function formatClock(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function goRiding() {
  uni.navigateTo({ url: "/pages/riding/index" })
}

onShow(() => {
  void refreshAccount()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}
</style>
