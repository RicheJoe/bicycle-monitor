/** H5 走浏览器接口。App 与微信小程序没有 document，走各端原生能力。 */
export function isH5() {
  try {
    const platform = uni.getSystemInfoSync().uniPlatform
    return platform === "web" || platform === "h5"
  } catch {
    return typeof document !== "undefined"
  }
}
