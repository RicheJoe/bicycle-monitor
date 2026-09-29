<template>
  <view class="page" :style="{ height: pageHeight }">
    <view class="stage">
      <!-- #ifdef H5 -->
      <div :id="mapHostId" class="amap" />
      <view v-if="mapError" class="map-error">
        <wd-notice-bar :text="mapError" type="danger" prefix="warn-bold" wrapable :scrollable="false" />
      </view>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <map
        id="ride-map"
        class="native-map"
        style="width: 100%; height: 100%"
        :latitude="center.latitude"
        :longitude="center.longitude"
        :scale="scale"
        :markers="markers"
        :circles="circles"
        :show-location="true"
        :enable-scroll="true"
        :enable-zoom="true"
        @markertap="onMarkerTap"
      />
      <!-- #endif -->

      <view class="topbar" :style="{ paddingTop: statusBar + 12 + 'px', right: capsuleRight }">
        <view class="brand-row">
          <view class="profile-btn" @click="goProfile">
            <AppIcon name="account" :size="22" color="#00a870" />
          </view>
          <view class="brand">
            <text class="brand-name">单车骑行</text>
            <text class="brand-sub">{{ placeText }}</text>
          </view>
        </view>
        <view class="count">{{ availableBikes.length }} 辆可骑</view>
      </view>
      <view class="locate-btn">
        <wd-button size="small" plain :loading="session.locating" @click="refreshLocation">
          {{ session.locating ? "定位中" : "定位" }}
        </wd-button>
      </view>
    </view>

    <view class="sheet">
      <template v-if="session.ride">
        <view class="ride-row" @click="goRiding">
          <view>
            <text class="sheet-kicker">骑行中</text>
            <text class="sheet-title">{{ session.ride.bikeCode }}</text>
          </view>
          <view class="ride-meta">
            <text class="ride-time">{{ elapsed }}</text>
            <text class="ride-fee">预计 ¥{{ feeText }}</text>
          </view>
        </view>
        <view class="actions">
          <wd-button plain custom-style="flex: 1" @click="goRiding">查看行程</wd-button>
          <wd-button custom-style="flex: 1" @click="goReturn">扫码还车</wd-button>
        </view>
      </template>
      <template v-else>
        <text class="sheet-kicker">附近可用车辆</text>
        <view v-if="!ready" class="empty-bikes">
          <wd-notice-bar
            :text="session.locateError || '正在定位，随后显示附近车辆'"
            :type="session.locateError ? 'danger' : 'info'"
            prefix="warn-bold"
            wrapable
            :scrollable="false"
          />
        </view>
        <view v-else-if="availableBikes.length === 0" class="empty-bikes">
          <wd-status-tip image="search" tip="附近暂无可用车辆" />
        </view>
        <scroll-view v-else class="bike-scroll" scroll-x>
          <view
            v-for="bike in availableBikes"
            :key="bike.code"
            class="bike-card"
            @click="goScan(bike.code)"
          >
            <view class="bike-badge">
              <AppIcon name="bike" :size="20" color="#fff" />
            </view>
            <view class="bike-card-text">
              <text class="bike-card-code">{{ bike.code }}</text>
              <text class="bike-card-sub">可骑 · {{ bike.battery }}%</text>
            </view>
          </view>
        </scroll-view>
        <RideScanButton label="扫码用车" @click="scanToRide" />
        <text class="manual" @click="goScan()">输入编号开锁</text>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { onHide, onShow } from "@dcloudio/uni-app"
import { listBikes, listParking, placesKey, placesReady } from "../../data/nearby"
import { session, currentFix } from "../../store/session"
import { distanceMeters } from "../../utils/geo"
import { estimateFee, formatDuration, formatYuan } from "../../utils/fee"
import { loadAmap } from "../../utils/amap"
import { bikeMarkerHtml } from "../../icons/marker"
import { locateHighAccuracy } from "../../utils/locate"
import { isH5 } from "../../utils/platform"
import AppIcon from "../../components/AppIcon.vue"
import RideScanButton from "../../components/RideScanButton.vue"
// #ifndef H5
import { scanQr } from "../../utils/scan"
// #endif

const statusBar = ref(0)
const capsuleRight = ref("24rpx")
const pageHeight = ref("100dvh")
const now = ref(Date.now())
const mapError = ref("")
const mapHostId = `amap-${Math.random().toString(36).slice(2)}`
let timer = 0
let initing = false
let amap: {
  add: (overlay: unknown) => void
  remove: (overlay: unknown) => void
  destroy: () => void
  resize: () => void
  setZoomAndCenter: (zoom: number, center: [number, number]) => void
} | null = null
let meMarker: { setPosition: (position: [number, number]) => void } | null = null
let accuracyCircle: {
  setCenter: (center: [number, number]) => void
  setRadius: (radius: number) => void
} | null = null
const bikeMarkerMap = new Map<string, { show: () => void; hide: () => void }>()
let placeOverlays: unknown[] = []
let AMapRef: {
  Marker: new (opts: Record<string, unknown>) => {
    setPosition: (position: [number, number]) => void
    on: (event: string, handler: () => void) => void
    show: () => void
    hide: () => void
  }
  Circle: new (opts: Record<string, unknown>) => {
    setCenter: (center: [number, number]) => void
    setRadius: (radius: number) => void
  }
  Text: new (opts: Record<string, unknown>) => unknown
  Pixel: new (x: number, y: number) => unknown
} | null = null

const fix = computed(() => currentFix())
const ready = computed(() => placesReady())
const availableBikes = computed(() =>
  listBikes().filter((bike) => bike.code !== session.ride?.bikeCode)
)

const placeText = computed(() => {
  const waiting = session.locating && (!session.gps || session.gps.accuracy > 50)
  if (waiting) return "正在获取高精度定位"
  if (session.locateError && !session.gps) return session.locateError
  if (!session.gps) return "点击定位获取当前位置"
  const here = fix.value
  const inside = listParking().find(
    (spot) => spot.enabled && distanceMeters(here, spot) <= spot.radius + 15
  )
  const accuracy = `精度 ${Math.round(here.accuracy)} 米`
  return inside ? `${inside.name} · ${accuracy}` : `${accuracy} · 不在还车区域`
})

const FALLBACK_CENTER = { latitude: 39.90923, longitude: 116.397428 }
const center = computed(() => {
  const here = fix.value
  if (here.latitude && here.longitude) return here
  return FALLBACK_CENTER
})
const scale = computed(() => (fix.value.accuracy > 0 && fix.value.accuracy <= 50 ? 17 : 16))

const markers = computed(() => {
  const bikes = listBikes()
    .filter((bike) => bike.code !== session.ride?.bikeCode)
    .map((bike, index) => ({
      id: index + 1,
      latitude: bike.latitude,
      longitude: bike.longitude,
      width: 36,
      height: 36,
      iconPath: "/static/marker-bike.png",
      anchor: { x: 0.5, y: 0.5 },
      callout: {
        content: `${bike.code} ${bike.battery}%`,
        display: "ALWAYS" as const,
        padding: 6,
        borderRadius: 6,
        bgColor: "#ffffff",
        color: "#12382c",
        fontSize: 12,
      },
    }))
  const parks = listParking()
    .filter((spot) => spot.enabled)
    .map((spot, index) => ({
      id: 1000 + index,
      latitude: spot.latitude,
      longitude: spot.longitude,
      width: 18,
      height: 18,
      iconPath: "/static/marker-park.png",
      anchor: { x: 0.5, y: 0.5 },
      callout: {
        content: spot.name,
        display: "ALWAYS" as const,
        padding: 4,
        borderRadius: 6,
        bgColor: "#ffffff",
        color: "#067a52",
        fontSize: 12,
      },
    }))
  return [...parks, ...bikes]
})

const circles = computed(() =>
  listParking()
    .filter((spot) => spot.enabled)
    .map((spot) => ({
      latitude: spot.latitude,
      longitude: spot.longitude,
      radius: spot.radius,
      color: "#00A870",
      fillColor: "#3300A870",
      strokeWidth: 2,
    }))
)

const elapsed = computed(() =>
  session.ride ? formatDuration(session.ride.startedAt, now.value) : "00:00"
)
const feeText = computed(() =>
  session.ride ? formatYuan(estimateFee(session.ride.startedAt, now.value)) : "0.00"
)

async function initMap() {
  if (!isH5() || amap || initing) return
  const container = document.getElementById(mapHostId)
  if (!container) return
  initing = true
  try {
    const AMap = (await loadAmap()) as {
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => {
        add: (overlay: unknown) => void
        remove: (overlay: unknown) => void
        destroy: () => void
        resize: () => void
        setFitView: (overlays?: unknown, immediately?: boolean, padding?: number[]) => void
        setZoomAndCenter: (zoom: number, center: [number, number]) => void
      }
      Circle: new (opts: Record<string, unknown>) => {
        setCenter: (center: [number, number]) => void
        setRadius: (radius: number) => void
      }
      Text: new (opts: Record<string, unknown>) => unknown
      Marker: new (opts: Record<string, unknown>) => {
        setPosition: (position: [number, number]) => void
        on: (event: string, handler: () => void) => void
        show: () => void
        hide: () => void
      }
      Pixel: new (x: number, y: number) => unknown
    }
    const here = session.gps
    const map = new AMap.Map(container, {
      zoom: 17,
      center: here ? [here.longitude, here.latitude] : [116.397428, 39.90923],
      viewMode: "2D",
      resizeEnable: true,
    })
    amap = map
    AMapRef = AMap
    renderPlaces()
    mapError.value = ""
    void refreshLocation()
  } catch (error) {
    mapError.value = error instanceof Error ? error.message : "高德地图加载失败"
  } finally {
    initing = false
  }
}

function renderPlaces() {
  if (!amap || !AMapRef) return
  placeOverlays.forEach((overlay) => amap?.remove(overlay))
  placeOverlays = []
  bikeMarkerMap.clear()
  listParking().forEach((spot) => {
    const circle = new AMapRef!.Circle({
      center: [spot.longitude, spot.latitude],
      radius: spot.radius,
      strokeColor: spot.enabled ? "#00A870" : "#B0B6BF",
      strokeWeight: 2,
      strokeStyle: "dashed",
      fillColor: spot.enabled ? "#00A870" : "#8B919A",
      fillOpacity: 0.18,
    })
    const label = new AMapRef!.Text({
      text: spot.name,
      position: [spot.longitude, spot.latitude],
      offset: new AMapRef!.Pixel(0, -52),
      style: {
        "background-color": "rgba(255,255,255,0.92)",
        border: "none",
        "border-radius": "8px",
        padding: "2px 6px",
        color: spot.enabled ? "#067A52" : "#8B919A",
        "font-size": "12px",
      },
    })
    amap?.add(circle)
    amap?.add(label)
    placeOverlays.push(circle, label)
  })
  listBikes().forEach((bike) => {
    const marker = new AMapRef!.Marker({
      position: [bike.longitude, bike.latitude],
      content: bikeMarkerHtml(bike.battery),
      offset: new AMapRef!.Pixel(-18, -30),
      anchor: "center",
    })
    marker.on("click", () => {
      if (session.ride?.bikeCode === bike.code) return
      goScan(bike.code)
    })
    bikeMarkerMap.set(bike.code, marker)
    amap?.add(marker)
    placeOverlays.push(marker)
  })
  syncAvailableMarkers()
}

function syncUser() {
  const here = fix.value
  if (!amap || !AMapRef || !here.latitude || !here.longitude) return
  const position: [number, number] = [here.longitude, here.latitude]
  if (!meMarker) {
    meMarker = new AMapRef.Marker({
      position,
      content: '<div class="amap-me"><i></i></div>',
      offset: new AMapRef.Pixel(-11, -11),
      zIndex: 200,
    })
    amap.add(meMarker)
  } else {
    meMarker.setPosition(position)
  }
  const radius = Math.max(here.accuracy || 0, 15)
  if (!accuracyCircle) {
    accuracyCircle = new AMapRef.Circle({
      center: position,
      radius,
      strokeColor: "#2F80ED",
      strokeWeight: 1,
      fillColor: "#2F80ED",
      fillOpacity: 0.12,
      zIndex: 50,
    })
    amap.add(accuracyCircle)
  } else {
    accuracyCircle.setCenter(position)
    accuracyCircle.setRadius(radius)
  }
  const zoom = here.accuracy > 0 && here.accuracy <= 50 ? 17 : 16
  amap.setZoomAndCenter(zoom, position)
}

function releaseCameras() {
  if (typeof document === "undefined") return
  document.querySelectorAll("video").forEach((node) => {
    if (!(node instanceof HTMLVideoElement)) return
    const stream = node.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
    node.srcObject = null
  })
}

function refreshLocation() {
  releaseCameras()
  void locateHighAccuracy({ interactive: true }).then(() => {
    if (isH5()) syncUser()
  })
}

function onMarkerTap(event: { detail?: { markerId?: number }; markerId?: number }) {
  const id = Number(event.detail?.markerId ?? event.markerId)
  if (!id || id >= 1000) return
  const bike = listBikes().filter((item) => item.code !== session.ride?.bikeCode)[id - 1]
  if (!bike) return
  goScan(bike.code)
}

function resetMap() {
  try {
    amap?.destroy()
  } catch {
    /* 地图已销毁时忽略 */
  }
  amap = null
  meMarker = null
  accuracyCircle = null
  placeOverlays = []
  bikeMarkerMap.clear()
}

function ensureMap() {
  if (!isH5() || typeof document === "undefined") return
  const host = document.getElementById(mapHostId)
  if (!host) return
  if (!amap || host.childElementCount === 0) {
    resetMap()
    void initMap()
    return
  }
  amap.resize()
  refreshLocation()
}

function syncAvailableMarkers() {
  bikeMarkerMap.forEach((marker, code) => {
    if (session.ride?.bikeCode === code) marker.hide()
    else marker.show()
  })
}

function goProfile() {
  uni.navigateTo({ url: "/pages/profile/index" })
}

function goScan(code?: string) {
  const query = code ? `?code=${encodeURIComponent(code)}` : ""
  uni.navigateTo({ url: `/pages/scan/index${query}` })
}

async function scanToRide() {
  if (session.ride) {
    uni.navigateTo({ url: "/pages/riding/index" })
    return
  }
  if (isH5()) {
    goScan()
    return
  }
  // #ifndef H5
  try {
    const text = await scanQr()
    uni.navigateTo({
      url: `/pages/scan/index?code=${encodeURIComponent(text)}&auto=1`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    if (!message || message === "cancel" || message === "empty") return
    uni.showToast({ title: "扫码失败，请重试", icon: "none" })
  }
  // #endif
}

function goRiding() {
  uni.navigateTo({ url: "/pages/riding/index" })
}

function goReturn() {
  uni.navigateTo({ url: "/pages/return/index" })
}

function tick() {
  clearInterval(timer)
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000) as unknown as number
}

watch(
  () => [fix.value.longitude, fix.value.latitude, fix.value.accuracy],
  () => {
    syncUser()
  }
)

watch(placesKey, () => {
  renderPlaces()
})

onMounted(() => {
  nextTick(() => {
    void initMap()
  })
})

function readCapsule() {
  capsuleRight.value = "24rpx"
  // #ifdef MP-WEIXIN
  const menu = uni.getMenuButtonBoundingClientRect()
  const sys = uni.getSystemInfoSync()
  if (menu.left) capsuleRight.value = `${Math.max(sys.windowWidth - menu.left + 8, 12)}px`
  // #endif
}

function syncPageHeight() {
  const sys = uni.getSystemInfoSync()
  if (!isH5() || typeof window === "undefined") {
    if (sys.windowHeight) pageHeight.value = `${sys.windowHeight}px`
    return
  }
  const viewport = window.visualViewport
  const zoomed = viewport ? viewport.scale > 1.01 : false
  const height = !viewport || zoomed ? window.innerHeight : viewport.height
  if (height) pageHeight.value = `${Math.round(height)}px`
}

function lockPageScroll(lock: boolean) {
  if (!isH5() || typeof document === "undefined") return
  const overflow = lock ? "hidden" : ""
  document.documentElement.style.overflow = overflow
  document.body.style.overflow = overflow
  document.querySelectorAll("uni-page-body, uni-page-wrapper").forEach((node) => {
    if (node instanceof HTMLElement) node.style.overflow = overflow
  })
}

onShow(() => {
  const sys = uni.getSystemInfoSync()
  statusBar.value = sys.statusBarHeight || 0
  readCapsule()
  syncPageHeight()
  tick()
  if (isH5()) {
    lockPageScroll(true)
    window.visualViewport?.addEventListener("resize", syncPageHeight)
    window.addEventListener("resize", syncPageHeight)
    syncAvailableMarkers()
    nextTick(() => ensureMap())
    return
  }
  void locateHighAccuracy()
})

onHide(() => {
  clearInterval(timer)
  lockPageScroll(false)
  if (isH5() && typeof window !== "undefined") {
    window.visualViewport?.removeEventListener("resize", syncPageHeight)
    window.removeEventListener("resize", syncPageHeight)
  }
})

onUnmounted(() => {
  clearInterval(timer)
  lockPageScroll(false)
  resetMap()
  AMapRef = null
})
</script>

<style scoped>
.page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #e7f0e4;
}

.stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.native-map,
.amap {
  position: absolute;
  inset: 0;
  width: 100%;
  touch-action: none;
  height: 100%;
}

.map-error {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.95);
  color: #d25b2d;
  font-size: 26rpx;
  text-align: center;
  z-index: 3;
}

.locate-btn {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  z-index: 3;
  height: 64rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #067a52;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 20rpx rgba(20, 40, 30, 0.12);
}

.topbar {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 12rpx;
}

.brand-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  min-width: 0;
}

.profile-btn {
  width: 72rpx;
  height: 72rpx;
  margin-top: 4rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(30, 50, 40, 0.08);
  flex-shrink: 0;
}

.brand,
.count {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(30, 50, 40, 0.08);
}

.brand {
  padding: 16rpx 22rpx;
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 32rpx;
  font-weight: 650;
  color: #12382c;
}

.brand-sub {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #5d6b64;
}

.count {
  margin-top: 8rpx;
  padding: 14rpx 18rpx;
  font-size: 22rpx;
  color: #067a52;
}

.sheet {
  flex-shrink: 0;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding: 24rpx 28rpx calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -10rpx 30rpx rgba(20, 40, 30, 0.06);
}

.sheet-kicker {
  display: block;
  font-size: 22rpx;
  color: #8a928c;
}

.sheet-title {
  display: block;
  margin-top: 6rpx;
  font-size: 40rpx;
  font-weight: 650;
}

.bike-scroll {
  margin-top: 16rpx;
  margin-bottom: 24rpx;
  white-space: nowrap;
  width: 100%;
}

.bike-card {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  width: 260rpx;
  margin-right: 16rpx;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f4faf7;
}

.bike-badge {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #00a870;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bike-card-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bike-card-code {
  font-size: 30rpx;
  font-weight: 650;
  color: #12382c;
}

.bike-card-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #5d6b64;
}

.empty-bikes {
  margin: 16rpx 0 24rpx;
}

.manual {
  display: block;
  margin-top: 20rpx;
  text-align: center;
  font-size: 26rpx;
  color: #5d6b64;
}

.ride-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ride-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.ride-time {
  font-size: 40rpx;
  font-weight: 650;
  color: #00a870;
}

.ride-fee {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #5d6b64;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
</style>

<style>
.amap-bike {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 56px;
}

.amap-bike-battery {
  min-width: 36px;
  padding: 3px 6px;
  border-radius: 999px;
  background: #00a870;
  color: #fff;
  font-size: 11px;
  text-align: center;
  box-shadow: 0 3px 8px rgba(0, 120, 80, 0.25);
}

.amap-bike-code {
  margin-top: 2px;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: #245c45;
  font-size: 10px;
}

.amap-me {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(47, 128, 237, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.amap-me i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2f80ed;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #2f80ed;
}
</style>
