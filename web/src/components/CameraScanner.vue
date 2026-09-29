<template>
  <view class="scanner">
    <view :id="hostId" class="host" />
    <view class="mask">
      <view class="window">
        <view class="corner tl" />
        <view class="corner tr" />
        <view class="corner bl" />
        <view class="corner br" />
        <view class="laser" />
      </view>
    </view>
    <view class="torch">
      <wd-button size="small" :type="torchOn ? 'primary' : 'info'" @click.stop="toggleTorch">
        {{ torchOn ? "关闭手电筒" : "打开手电筒" }}
      </wd-button>
    </view>
    <view v-if="needTap" class="open">
      <wd-button size="small" @click.stop="start">打开相机扫码</wd-button>
    </view>
    <view v-if="error" class="error">
      <wd-notice-bar :text="error" type="danger" prefix="warn-bold" wrapable :scrollable="false" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { onHide, onUnload } from "@dcloudio/uni-app"
import { BrowserQRCodeReader } from "@zxing/browser"
import { useToast } from "wot-design-uni"

const toast = useToast()

const emit = defineEmits<{ detect: [text: string] }>()
const props = defineProps<{ paused?: boolean }>()

const hostId = `scan-host-${Math.random().toString(36).slice(2)}`
const torchOn = ref(false)
const needTap = ref(false)
const error = ref("")

let controls: { stop: () => void; switchTorch?: (on: boolean) => Promise<void> } | null = null
let running = false
let starting = false
let resume = false
let acceptScan = true
let lastText = ""
let lastAt = 0

function cameraError(err: unknown) {
  const name = err instanceof DOMException ? err.name : ""
  if (!window.isSecureContext) return "手机打开相机需要 HTTPS，请用 https 地址访问"
  if (name === "NotAllowedError") return "请允许使用相机后再扫码"
  if (name === "NotFoundError") return "没有找到摄像头"
  if (name === "NotReadableError") return "相机被其他应用占用"
  return "无法打开相机"
}

async function start() {
  if (props.paused || running) return
  if (starting) {
    resume = true
    return
  }
  starting = true
  resume = false
  acceptScan = true
  error.value = ""
  const host = document.getElementById(hostId)
  if (!host) {
    starting = false
    return
  }
  let video = host.querySelector("video")
  if (!video) {
    video = document.createElement("video")
    video.setAttribute("playsinline", "true")
    video.setAttribute("webkit-playsinline", "true")
    video.muted = true
    video.autoplay = true
    video.style.cssText = "width:100%;height:100%;object-fit:cover;background:#000;"
    host.appendChild(video)
  }
  try {
    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 400,
    })
    const opened = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      video,
      (result) => {
        if (!acceptScan || props.paused) return
        const text = result?.getText()
        if (!text) return
        const now = Date.now()
        if (text === lastText && now - lastAt < 1800) return
        lastText = text
        lastAt = now
        emit("detect", text)
        stop()
        nextTick(() => {
          if (!props.paused) void start()
        })
      }
    )
    if (!acceptScan || props.paused) {
      try {
        opened?.stop()
      } catch {
        /* 相机关闭时忽略 */
      }
      releaseVideo()
      return
    }
    controls = opened
    running = true
    needTap.value = false
    error.value = ""
  } catch (err) {
    running = false
    needTap.value = true
    error.value = cameraError(err)
  } finally {
    starting = false
    if (resume && !props.paused && !running) {
      resume = false
      void start()
    }
  }
}

function releaseVideo() {
  const video = document.getElementById(hostId)?.querySelector("video")
  const stream = video instanceof HTMLVideoElement ? video.srcObject : null
  if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
  if (video instanceof HTMLVideoElement) video.srcObject = null
}

function stop() {
  acceptScan = false
  resume = false
  torchOn.value = false
  running = false
  try {
    controls?.stop()
  } catch {
    /* 相机关闭时忽略 */
  }
  controls = null
  releaseVideo()
}

async function toggleTorch() {
  if (!controls?.switchTorch) {
    toast.show("请先打开相机")
    return
  }
  const next = !torchOn.value
  try {
    await controls.switchTorch(next)
    torchOn.value = next
  } catch {
    torchOn.value = false
    toast.show("当前浏览器无法打开手电筒")
  }
}

onMounted(() => {
  void start()
})

watch(
  () => props.paused,
  (paused) => {
    if (paused) stop()
    else void start()
  }
)

onHide(() => {
  stop()
})

onUnload(() => {
  stop()
})

onBeforeUnmount(() => {
  stop()
})
</script>

<style scoped>
.scanner {
  position: relative;
  width: 100%;
  height: 560rpx;
  border-radius: 24rpx;
  overflow: hidden;
  background: #111;
}

.host {
  position: absolute;
  inset: 0;
}

.mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.window {
  position: relative;
  width: 420rpx;
  height: 420rpx;
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

.laser {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 4rpx;
  background: #3dffb0;
  box-shadow: 0 0 12rpx #3dffb0;
  animation: sweep 2.2s linear infinite;
}

@keyframes sweep {
  0% {
    top: 8%;
  }
  100% {
    top: 88%;
  }
}

.torch {
  position: absolute;
  left: 50%;
  bottom: 24rpx;
  transform: translateX(-50%);
  z-index: 2;
}

.open {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
}

.error {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 24rpx;
  z-index: 3;
}
</style>
