export function amapKey() {
  return import.meta.env.VITE_AMAP_KEY || ""
}

export function loadAmap() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.reject(new Error("当前环境不支持高德 JS 地图"))
  }
  const key = amapKey()
  if (!key) return Promise.reject(new Error("缺少高德 Key"))
  const host = window as Window & { AMap?: unknown }
  if (host.AMap) return Promise.resolve(host.AMap)
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`
    script.async = true
    script.onload = () => {
      if (host.AMap) resolve(host.AMap)
      else reject(new Error("高德地图没有加载完成"))
    }
    script.onerror = () => reject(new Error("高德地图加载失败"))
    document.head.appendChild(script)
  })
}
