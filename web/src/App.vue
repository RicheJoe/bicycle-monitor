<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app"
import { ensureSession } from "./store/session"

onLaunch(() => {
  void ensureSession()
})
</script>

<style>
/* #ifdef H5 */
html,
body,
page,
uni-page-body,
uni-page-wrapper {
  touch-action: pan-x pan-y;
}

.amap,
.amap * {
  touch-action: none;
}
/* #endif */

page {
  --wot-color-theme: #00a870;
}

/* #ifdef H5 */
uni-page-body {
  --wot-color-theme: #00a870;
}
/* #endif */

page {
  background: #f3f5f7;
  color: #1c1c1e;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue",
    sans-serif;
}

view,
text,
input {
  box-sizing: border-box;
}
</style>
