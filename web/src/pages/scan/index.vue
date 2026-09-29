<template>
  <view class="page">
    <CodeScanner :paused="confirming" @detect="onDetect" />
    <text class="hint">扫到车身二维码后，需要再确认一次才会开锁</text>
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
import { ref } from "vue"
import { onLoad, onShow } from "@dcloudio/uni-app"
import { useMessage, useToast } from "wot-design-uni"
import { bikeSpots } from "../../data/places"
import { findBike, placesReady } from "../../data/nearby"
import { session, startRide } from "../../store/session"
import { locateHighAccuracy } from "../../utils/locate"
import { parseCode } from "../../utils/qr"
import CodeScanner from "../../components/CodeScanner.vue"

const toast = useToast()
const box = useMessage()
const code = ref("")
const confirming = ref(false)
const demoCodes = bikeSpots.map((bike) => bike.code).join("、")

onLoad((query) => {
  if (query?.code) code.value = String(query.code)
})

onShow(() => {
  if (!placesReady()) void locateHighAccuracy()
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
  if (!placesReady()) {
    toast.show("正在定位，请稍候")
    return
  }
  const bike = findBike(bikeCode)
  if (!bike) {
    toast.show("车辆不存在或正在使用")
    return
  }
  confirming.value = true
  try {
    await box.confirm({
      title: "确认开锁",
      msg: `即将解锁车辆 ${bike.code}，电量 ${bike.battery}%。请确认是这辆车。`,
      confirmButtonText: "确认开锁",
    })
    startRide(bike.code)
    uni.redirectTo({ url: "/pages/riding/index" })
  } catch {
    /* 取消确认 */
  } finally {
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
