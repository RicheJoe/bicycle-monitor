import bikeIcon from "@iconify-icons/mdi/bicycle"
import type { IconifyIcon } from "@iconify/vue"
import { iconToHTML, iconToSVG } from "@iconify/utils"

export { bikeIcon }

export function iconMarkup(icon: IconifyIcon, size: number, color: string) {
  const rendered = iconToSVG(icon, { width: String(size), height: String(size) })
  return iconToHTML(rendered.body, {
    ...rendered.attributes,
    style: `color:${color};display:block`,
  })
}

export function bikeMarkerHtml(battery: number) {
  return `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="width:36px;height:36px;border-radius:50%;background:#00a870;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,120,80,.35)">
      ${iconMarkup(bikeIcon, 22, "#ffffff")}
    </div>
    <span style="margin-top:2px;background:rgba(255,255,255,.94);color:#245c45;border-radius:4px;padding:0 4px;font-size:10px;line-height:14px">${battery}%</span>
  </div>`
}
