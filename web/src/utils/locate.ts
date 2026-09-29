import { applyGps, session, type Fix } from "../store/session"
import { refreshNearby } from "../data/nearby"
import { isH5 } from "./platform"
import { wgs84ToGcj02 } from "./gcj"

const PRECISE_M = 30
let requestSeq = 0
let watchId: number | null = null
let askedSetting = false

export function locateHighAccuracy(options?: { interactive?: boolean }) {
  const seq = ++requestSeq
  stopWatch()
  session.locating = true
  session.locateError = ""
  const task = (isH5() ? locateByBrowser(seq) : locateByUni(seq, Boolean(options?.interactive))).finally(() => {
    if (seq !== requestSeq) return
    session.locating = false
  })
  return task
}

function stopWatch() {
  if (watchId === null || typeof navigator === "undefined" || !navigator.geolocation) {
    watchId = null
    return
  }
  navigator.geolocation.clearWatch(watchId)
  watchId = null
}

function locateByUni(seq: number, interactive: boolean) {
  return new Promise<void>((resolve) => {
    uni.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      highAccuracyExpireTime: 8000,
      success(res) {
        if (seq !== requestSeq) {
          resolve()
          return
        }
        applyGps({
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy || 0,
        })
        if (session.gps) void refreshNearby(session.gps)
        resolve()
      },
      fail(err) {
        if (seq !== requestSeq) {
          resolve()
          return
        }
        const msg = err.errMsg || ""
        const denied = /auth deny|auth denied|authorize|permission/i.test(msg)
        if (!session.gps) session.locateError = denied ? "请允许使用定位" : "定位失败，请允许定位权限"
        if (denied && interactive && !askedSetting) {
          askedSetting = true
          uni.showModal({
            title: "需要定位权限",
            content: "用于展示附近车辆，并判断是否停在还车区域",
            confirmText: "去设置",
            success(res) {
              if (res.confirm) uni.openSetting({})
            },
          })
        }
        resolve()
      },
    })
  })
}

function locateByBrowser(seq: number) {
  return new Promise<void>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (seq === requestSeq) session.locateError = "当前浏览器不支持高精度定位"
      resolve()
      return
    }
    let best: Fix | null = null
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (seq !== requestSeq) {
        resolve()
        return
      }
      stopWatch()
      if (!best) {
        if (!session.gps) session.locateError = "定位超时，请允许定位后重试"
        resolve()
        return
      }
      if (seq === requestSeq) {
        applyGps(toGcj(best))
        if (session.gps) void refreshNearby(session.gps)
      }
      resolve()
    }
    const timer = setTimeout(finish, 12000)
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (seq !== requestSeq || settled) return
        const age = Date.now() - pos.timestamp
        if (age > 15000) return
        const sample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 9999,
        }
        if (!best || sample.accuracy < best.accuracy) best = sample
        if (sample.accuracy <= PRECISE_M) finish()
      },
      (err) => {
        if (seq !== requestSeq || settled) return
        if (err.code === 1) {
          session.locateError = "请允许浏览器使用定位"
          settled = true
          clearTimeout(timer)
          stopWatch()
          resolve()
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
  })
}

function toGcj(fix: Fix): Fix {
  const point = wgs84ToGcj02(fix.longitude, fix.latitude)
  return { ...point, accuracy: fix.accuracy }
}
