<template>
  <view class="page">
    <!-- #ifdef H5 -->
    <CodeScanner class="scan-box" :paused="confirming" @detect="onDetect" />
    <text class="hint">扫到车身二维码后，需要再确认一次才会开锁</text>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <view class="mp-lead">
      <text class="hint">扫码用车</text>
      <text class="demo">点击按钮打开微信扫一扫，识别后再确认开锁</text>
    </view>
    <CodeScanner class="scan-box" label="扫码用车" :paused="confirming" @detect="onDetect" />
    <!-- #endif -->
    <text class="demo">演示车辆 {{ demoCodes }}，也可手动输入编号</text>

    <view class="panel">
      <wd-input v-model="code" placeholder="输入车辆编号" clearable @confirm="askUnlock" />
      <wd-button block size="large" custom-style="margin-top: 24rpx" @click="askUnlock">确认开锁</wd-button>
    </view>

    <wd-toast />
    <wd-message-box />
  </view>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue"
import { onLoad, onShow } from "@dcloudio/uni-app"
import { useMessage, useToast } from "wot-design-uni"
import { bikeSpots } from "../../data/places"
import { findBike } from "../../data/nearby"
import { session, setRide } from "../../store/session"
import { locateHighAccuracy } from "../../utils/locate"
import { ApiError, createRide } from "../../utils/api"
import { parseCode } from "../../utils/qr"
import CodeScanner from "../../components/CodeScanner.vue"

const toast = useToast()
const box = useMessage()
const code = ref("")
const confirming = ref(false)
const demoCodes = bikeSpots.map((bike) => bike.code).join("、")
let autoUnlock = false

onLoad((query) => {
  if (query?.code) code.value = decodeURIComponent(String(query.code))
  autoUnlock = query?.auto === "1" && Boolean(code.value)
})

onShow(() => {
  void locateHighAccuracy()
  if (!autoUnlock) return
  autoUnlock = false
  nextTick(() => {
    void askUnlock()
  })
})

function onDetect(text: string) {
  code.value = text
  void askUnlock()
}

async function askUnlock() {
  if (session.ride) {
    toast.show("你有未完成的订单")
    uni.redirectTo({ url: "/pages/riding/index" })
    return
  }
  const bikeCode = parseCode(code.value, "b")
  if (!bikeCode) {
    toast.show("请扫描车身二维码")
    return
  }
  const bike = findBike(bikeCode)
  confirming.value = true
  try {
    await box.confirm({
      title: "确认开锁",
      msg: bike
        ? `即将解锁车辆 ${bike.code}，电量 ${bike.battery}%。请确认是这辆车。`
        : `即将解锁车辆 ${bikeCode}。请确认是这辆车。`,
      confirmButtonText: "确认开锁",
    })
    uni.showLoading({ title: "正在开锁", mask: true })
    const result = await createRide(code.value.trim())
    if (!result.ride.startedAt) throw new ApiError("LOCK_TIMEOUT", "锁没有响应，请重试")
    setRide({
      id: result.ride.id,
      bikeCode: result.ride.bikeCode,
      startedAt: result.ride.startedAt,
    })
    uni.redirectTo({ url: "/pages/riding/index" })
  } catch (error) {
    if (error instanceof ApiError) toast.show(error.message)
  } finally {
    uni.hideLoading()
    confirming.value = false
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 48rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scan-box {
  display: block;
  width: 100%;
  align-self: stretch;
  flex-shrink: 0;
}

.mp-lead {
  width: 100%;
  margin-bottom: 36rpx;
}

.mp-lead .hint {
  margin-top: 0;
}

.hint {
  margin-top: 28rpx;
  font-size: 32rpx;
  font-weight: 650;
}

.demo {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8a928c;
  text-align: center;
  line-height: 1.5;
}

.panel {
  width: 100%;
  margin-top: 48rpx;
}
</style>
