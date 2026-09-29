/** 调起微信 / App 原生扫码，只识别相机里的二维码。 */
export function scanQr() {
  return new Promise<string>((resolve, reject) => {
    uni.scanCode({
      onlyFromCamera: true,
      scanType: ["qrCode"],
      success(res) {
        const text = (res.result || "").trim()
        if (!text) {
          reject(new Error("empty"))
          return
        }
        resolve(text)
      },
      fail(err) {
        const msg = err.errMsg || ""
        if (/cancel/i.test(msg)) {
          reject(new Error("cancel"))
          return
        }
        reject(new Error(msg || "fail"))
      },
    })
  })
}
