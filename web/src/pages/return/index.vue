<template>
  <view class="page">
    <view v-if="result" class="card success">
      <wd-status-tip image="content" tip="还车成功" />
      <wd-cell title="还车点" :value="result.spotName" />
      <wd-cell title="骑行时长" :value="result.duration" />
      <wd-cell title="费用" :value="`¥${result.fee}`" />
      <wd-button block size="large" custom-style="margin-top: 24rpx" @click="finish">完成</wd-button>
    </view>

    <template v-else>
      <view class="card">
        <text class="kicker">还车前确认</text>
        <text class="lead">需要停在规定区域，并扫该点的地面二维码。</text>
        <wd-cell title="定位精度" :value="accuracyText" />
        <wd-cell title="区域" :value="zoneText" />
        <wd-notice-bar
          v-if="session.locateError && locateMode === 'gps'"
          :text="session.locateError"
          type="danger"
          prefix="warn-bold"
          wrapable
          :scrollable="false"
        />
        <wd-radio-group v-model="locateMode" shape="button" custom-class="modes" @change="onModeChange">
          <wd-radio v-for="item in modes" :key="item.value" :value="item.value">{{ item.label }}</wd-radio>
        </wd-radio-group>
      </view>

      <CodeScanner class="scan-box" label="扫码还车" :paused="confirming" @detect="onDetect" />
      <!-- #ifdef H5 -->
      <text class="demo">对准地面二维码，扫到后需再确认一次。演示编号 PK3N7Q。</text>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <text class="demo">点击扫码还车，打开微信扫一扫。演示编号 PK3N7Q。</text>
      <!-- #endif -->

      <view class="panel">
        <wd-input v-model="code" placeholder="输入地面二维码编号" clearable @confirm="askReturn" />
        <wd-notice-bar
          v-if="message"
          :text="message"
          type="danger"
          prefix="warn-bold"
          wrapable
          :scrollable="false"
          custom-style="margin-top: 20rpx"
        />
        <wd-button block size="large" custom-style="margin-top: 24rpx" @click="askReturn">确认还车</wd-button>
      </view>
    </template>

    <wd-toast />
    <wd-message-box />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { onShow } from "@dcloudio/uni-app"
import { useMessage, useToast } from "wot-design-uni"
import { ACCURACY_LIMIT_M, ZONE_BUFFER_M } from "../../data/mock"
import { findParking, listParking, placesReady } from "../../data/nearby"
import { clearRide, demoFix, recordOrder, session, type LocateMode } from "../../store/session"
import { distanceMeters } from "../../utils/geo"
import { locateHighAccuracy } from "../../utils/locate"
import { parseCode } from "../../utils/qr"
import { estimateFee, formatDuration, formatYuan } from "../../utils/fee"
import CodeScanner from "../../components/CodeScanner.vue"

useToast()
const box = useMessage()

const code = ref("")
const message = ref("")
const confirming = ref(false)
const result = ref<{ spotName: string; duration: string; fee: string } | null>(null)

const locateMode = ref<LocateMode>("gps")
const modes: { label: string; value: LocateMode }[] = [
  { label: "当前定位", value: "gps" },
  { label: "区域内", value: "inside" },
  { label: "区域外", value: "outside" },
  { label: "定位不准", value: "poor" },
]

const anchor = computed(() => {
  const spot = listParking().find((item) => item.enabled && item.code === "PK3N7Q")
  return spot || { latitude: 0, longitude: 0 }
})
const fix = computed(() => demoFix(locateMode.value, anchor.value))
const accuracyText = computed(() => {
  if (locateMode.value === "gps" && session.locating && !session.gps) return "定位中"
  if (locateMode.value === "gps" && !session.gps) return "未获取"
  return `${Math.round(fix.value.accuracy)} 米`
})

const insideName = computed(() => {
  const here = fix.value
  const spot = listParking().find(
    (item) => item.enabled && distanceMeters(here, item) <= item.radius + ZONE_BUFFER_M
  )
  return spot?.name || ""
})

const zoneText = computed(() => {
  if (locateMode.value === "gps" && !session.gps) return session.locating ? "定位中" : "未获取"
  return insideName.value || "不在还车区域"
})

function onModeChange() {
  if (locateMode.value === "gps") void locateHighAccuracy()
}

function onDetect(text: string) {
  code.value = text
  void askReturn()
}

async function askReturn() {
  message.value = ""
  if (!session.ride) {
    message.value = "没有进行中的订单"
    return
  }
  if (!placesReady()) {
    message.value = "正在定位，请稍候"
    return
  }
  const pointCode = parseCode(code.value, "p")
  const spot = pointCode ? findParking(pointCode) : undefined
  if (!spot || !spot.enabled) {
    message.value = "二维码无效"
    return
  }
  if (locateMode.value === "gps" && !session.gps) {
    message.value = session.locateError || "正在定位，请稍候"
    void locateHighAccuracy()
    return
  }
  if (fix.value.accuracy > ACCURACY_LIMIT_M) {
    message.value = "定位不准，请到空旷处重试"
    return
  }
  if (distanceMeters(fix.value, spot) > spot.radius + ZONE_BUFFER_M) {
    message.value = "不在还车区域"
    return
  }
  confirming.value = true
  try {
    const fee = formatYuan(estimateFee(session.ride.startedAt))
    const duration = formatDuration(session.ride.startedAt)
    await box.confirm({
      title: "确认还车",
      msg: `车辆 ${session.ride.bikeCode} 将在${spot.name}还车。已骑行 ${duration}，预计费用 ¥${fee}。`,
      confirmButtonText: "确认还车",
    })
    if (!session.ride) return
    result.value = {
      spotName: spot.name,
      duration: formatDuration(session.ride.startedAt),
      fee: formatYuan(estimateFee(session.ride.startedAt)),
    }
    recordOrder({
      id: session.ride.id,
      bikeCode: session.ride.bikeCode,
      startedAt: session.ride.startedAt,
      endedAt: Date.now(),
      fee: estimateFee(session.ride.startedAt),
      parkingName: spot.name,
    })
    clearRide()
  } catch {
    /* 取消确认 */
  } finally {
    confirming.value = false
  }
}

function finish() {
  uni.reLaunch({ url: "/pages/map/index" })
}

onShow(() => {
  if (locateMode.value === "gps") void locateHighAccuracy()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
}

.card,
.panel {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
}

.kicker {
  display: block;
  font-size: 24rpx;
  color: #8a928c;
}

.lead {
  display: block;
  margin: 12rpx 0 8rpx;
  font-size: 28rpx;
  line-height: 1.5;
}

.scan-box {
  display: block;
  width: 100%;
  margin-top: 20rpx;
}

.demo {
  display: block;
  margin: 16rpx 8rpx 20rpx;
  font-size: 24rpx;
  color: #8a928c;
  line-height: 1.5;
}

.panel {
  margin-top: 8rpx;
}

:deep(.modes) {
  margin-top: 20rpx;
}
</style>
