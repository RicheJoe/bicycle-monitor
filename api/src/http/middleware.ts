import type { NextFunction, Request, Response } from "express"
import { ApiError } from "../errors.js"
import { userIdFromToken } from "../modules/auth.js"

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.userId = userIdFromToken(req.header("authorization"))
    next()
  } catch (error) {
    next(error)
  }
}

export function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    res.status(error.status).json({ code: error.code, message: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ code: "INTERNAL", message: "服务暂时不可用" })
}

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}
