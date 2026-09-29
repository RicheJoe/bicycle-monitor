import mqtt, { type MqttClient } from "mqtt"
import { config } from "../config.js"

let client: MqttClient | null = null
let onUplink: ((topic: string, payload: Buffer) => Promise<void>) | null = null

export function setUplinkHandler(handler: (topic: string, payload: Buffer) => Promise<void>) {
  onUplink = handler
}

export function connectMqtt(subscribeUplink: boolean) {
  client = mqtt.connect(config.mqttUrl, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    reconnectPeriod: 2000,
  })
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      client?.off("connect", onConnect)
      reject(error)
    }
    const onConnect = () => {
      client?.off("error", onError)
      if (subscribeUplink) client?.subscribe("bike/+/event/#", { qos: 1 })
      resolve()
    }
    client?.once("error", onError)
    client?.once("connect", onConnect)
  }).then(() => {
    client?.on("message", (topic, payload) => {
      if (!onUplink) return
      void onUplink(topic, payload).catch((error: unknown) => console.error(error))
    })
  })
}

export function publishCommand(bikeId: string, action: "unlock" | "lock", commandId: string, rideId: string) {
  if (!client?.connected) return Promise.reject(new Error("MQTT is not connected"))
  const topic = `bike/${bikeId}/command/${action}`
  const payload = JSON.stringify({ commandId, action, rideId, ts: Date.now() })
  return new Promise<void>((resolve, reject) => {
    client?.publish(topic, payload, { qos: 1 }, (error) => (error ? reject(error) : resolve()))
  })
}

export function closeMqtt() {
  client?.end(true)
  client = null
}
