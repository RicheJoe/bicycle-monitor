/** 解析车身码 /b/{code} 或地面码 /p/{code}。纯编号也可直接输入。 */
export function parseCode(raw: string, tag: "b" | "p") {
  const text = raw.trim()
  if (!text) return ""
  const matched = text.match(new RegExp(`/${tag}/([A-Za-z0-9]+)`, "i"))
  if (matched) return matched[1].toUpperCase()
  if (/^https?:/i.test(text)) return ""
  return text.toUpperCase()
}
