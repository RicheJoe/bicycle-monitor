<template>
  <view class="page">
    <view class="hero">
      <view class="avatar">
        <AppIcon name="account" :size="36" color="#00a870" />
      </view>
      <view class="who">
        <text class="name">{{ profile.name }}</text>
        <text class="phone">{{ profile.phone }}</text>
      </view>
    </view>

    <view class="stats">
      <view class="stat">
        <text class="stat-num">{{ orderCount }}</text>
        <text class="stat-label">全部订单</text>
      </view>
      <view class="stat">
        <text class="stat-num">{{ ridingText }}</text>
        <text class="stat-label">当前行程</text>
      </view>
      <view class="stat">
        <text class="stat-num">¥{{ totalFee }}</text>
        <text class="stat-label">累计费用</text>
      </view>
    </view>

    <wd-cell-group border custom-style="margin-top: 24rpx">
      <wd-cell title="我的订单" value="查看" is-link @click="goOrders" />
    </wd-cell-group>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "../../components/AppIcon.vue"
import { profile } from "../../data/profile"
import { session } from "../../store/session"
import { computed } from "vue"

const orderCount = computed(() => session.orders.length + (session.ride ? 1 : 0))
const ridingText = computed(() => (session.ride ? "骑行中" : "无"))
const totalFee = computed(() =>
  session.orders.reduce((sum, order) => sum + order.fee, 0).toFixed(2)
)

function goOrders() {
  uni.navigateTo({ url: "/pages/orders/index" })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
}

.hero {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 48rpx 32rpx 36rpx;
  background: #00a870;
}

.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.who {
  display: flex;
  flex-direction: column;
}

.name {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
}

.phone {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.88);
}

.stats {
  display: flex;
  margin: -28rpx 24rpx 0;
  padding: 28rpx 0;
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(20, 40, 30, 0.06);
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 32rpx;
  font-weight: 700;
  color: #12382c;
}

.stat-label {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #8a928c;
}

.menu {
  margin: 24rpx;
  border-radius: 20rpx;
  background: #fff;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
}

.menu-left,
.menu-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.menu-title {
  font-size: 30rpx;
  color: #1c1c1e;
}

.menu-extra {
  font-size: 24rpx;
  color: #8a928c;
}
</style>
