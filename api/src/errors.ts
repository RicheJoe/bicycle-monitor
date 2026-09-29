export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const errors = {
  unauthorized: () => new ApiError(401, "UNAUTHORIZED", "请先登录"),
  rideNotFound: () => new ApiError(404, "RIDE_NOT_FOUND", "订单不存在"),
  activeRide: () => new ApiError(409, "ACTIVE_RIDE_EXISTS", "你有未完成的订单"),
  bikeUnavailable: () => new ApiError(409, "BIKE_UNAVAILABLE", "车辆不存在或正在使用"),
  noActiveRide: () => new ApiError(409, "NO_ACTIVE_RIDE", "没有进行中的订单"),
  invalidQr: () => new ApiError(400, "INVALID_QR", "二维码无效"),
  poorAccuracy: () => new ApiError(400, "POOR_ACCURACY", "定位不准，请到空旷处重试"),
  outOfZone: () => new ApiError(400, "OUT_OF_ZONE", "不在还车区域"),
  bikeOutOfZone: () => new ApiError(400, "BIKE_OUT_OF_ZONE", "车辆不在还车区域"),
  returnInProgress: () => new ApiError(409, "RETURN_IN_PROGRESS", "正在关锁，请稍候"),
  rideNotRiding: () => new ApiError(409, "RIDE_NOT_RIDING", "订单不在骑行中"),
  lockTimeout: () => new ApiError(504, "LOCK_TIMEOUT", "锁没有响应，请重试"),
  badRequest: () => new ApiError(400, "BAD_REQUEST", "参数不正确"),
  bikeNotFound: () => new ApiError(404, "BIKE_NOT_FOUND", "车辆不存在"),
}
