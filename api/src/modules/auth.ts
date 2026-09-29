import jwt from "jsonwebtoken"
import { config } from "../config.js"
import { errors } from "../errors.js"
import { prisma } from "../infra/prisma.js"

const devNickname = "骑行用户"

function sign(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" })
}

function present(user: { id: string; nickname: string }) {
  return { token: sign(user.id), user: { id: user.id, nickname: user.nickname } }
}

export async function loginDev() {
  const user = await prisma.user.findFirst({ where: { openid: null, nickname: devNickname } })
  if (!user) throw errors.unauthorized()
  return present(user)
}

export async function loginWechat(code: string) {
  if (!code || !config.wechatAppId || !config.wechatSecret) throw errors.unauthorized()
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session")
  url.searchParams.set("appid", config.wechatAppId)
  url.searchParams.set("secret", config.wechatSecret)
  url.searchParams.set("js_code", code)
  url.searchParams.set("grant_type", "authorization_code")
  const response = await fetch(url)
  const body = (await response.json()) as { openid?: string }
  if (!body.openid) throw errors.unauthorized()
  const user = await prisma.user.upsert({
    where: { openid: body.openid },
    create: { openid: body.openid, nickname: devNickname },
    update: {},
  })
  return present(user)
}

export function userIdFromToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) throw errors.unauthorized()
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret)
    if (typeof payload === "string" || typeof payload.sub !== "string") throw errors.unauthorized()
    return payload.sub
  } catch (error) {
    if (error instanceof Error && error.message === "请先登录") throw error
    throw errors.unauthorized()
  }
}

export async function profile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw errors.unauthorized()
  return { id: user.id, nickname: user.nickname, phone: user.phone }
}
