import dgram from "dgram"
import { Queue } from "bullmq"
import { connection } from "./redis.js"
import dotenv from "dotenv"
import { Client } from "./models/Client.js"

dotenv.config()

const SERVER_HOST = process.env.SERVER_HOST
const SERVER_PORT = process.env.SERVER_PORT

// ---------- Bull setup -----------

export const alarmQueue = new Queue("alarmQueue", { connection })

//  ------------- UDP scocket setup -----------------
export const client = dgram.createSocket("udp4")

// ------------- Client list ------------------
let clientsCache = []

async function refreshClientsCache() {
  try {
    const clients = await Client.find({})

    // Flatten into a lookup array: {vehId, number_plate, clientId}
    clientsCache = clients.flatMap((c) =>
      c.vehicles.map((v) => ({
        client_id: c._id.toString(),
        device_serial: v.device_serial,
        number_plate: v.number_plate,
      }))
    )

    console.log(`✅ Clients cache updated with ${clientsCache.length} vehicles`)
  } catch (err) {
    console.error("❌ Failed to refresh clients cache:", err.message)
  }
}

const pendingRequests = new Map()

setInterval(refreshClientsCache, 30 * 60 * 1000) // 30 min

// 1. Initiate handshake

function buildHandshakeReq() {
  const buf = Buffer.alloc(4)
  buf.writeInt16LE(4, 0)
  buf.writeInt16LE(4, 2)
  return buf
}

// 2. Parse position information

async function parseGISPosReq(buf) {
  let offset = 4

  // const acc = buf.readUInt8(offset)

  const acc = ((buf.readUInt8(offset) >> 6) & 1) === 1 ? "ON" : "OFF"

  offset += 1
  const alarm = buf.readUInt8(offset)
  offset += 1
  const speed = buf.readInt32LE(offset)
  offset += 4
  const angle = buf.readDoubleLE(offset)
  offset += 8
  const lng = buf.readDoubleLE(offset)
  offset += 8
  const lat = buf.readDoubleLE(offset)
  offset += 8

  const ID_LEN = 11

  const vehId = buf
    .slice(offset, offset + ID_LEN)
    .toString("ascii")
    .replace(/\0/g, "")
  offset += ID_LEN

  const time = Date.now()

  const fuel = buf.readUInt16LE(buf.length - 2)

  let data = {
    vehId,
    time,
    acc,
    alarm,
    speed,
    angle,
    lng,
    lat,
    fuel,
  }

  const vehicle = clientsCache.find((v) => v.device_serial === data.vehId)

  if (!vehicle) return

  const enrichedData = {
    ...data,
    number_plate: vehicle.number_plate,
    client_id: vehicle.client_id,
  }

  console.log("📍:", enrichedData)

  // Add to queue that checks if it is an alarm
  await alarmQueue.add("alarm", enrichedData, {
    removeOnComplete: true,
    removeOnFail: true,
  })
}

export function waitForResponse(deviceId, status, timeout = 8000) {
  if (!deviceId) return Promise.reject(new Error("deviceId required"))
  if (pendingRequests.has(deviceId)) {
    return Promise.reject(
      new Error("Another request is already pending for this device")
    )
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(deviceId)
      reject(new Error("Response timeout"))
    }, timeout)

    pendingRequests.set(deviceId, {
      responses: [],
      status,
      resolve: (result) => {
        clearTimeout(timer)
        pendingRequests.delete(deviceId)
        resolve(result)
      },
      reject: (err) => {
        clearTimeout(timer)
        pendingRequests.delete(deviceId)
        reject(err)
      },
    })
  })
}

function parseGISCommandResp(buf) {
  let offset = 0

  const nPackLen = buf.readInt16LE(offset)
  offset += 2
  const nFlag = buf.readInt16LE(offset)
  offset += 2
  const nErrorCode = buf.readUInt8(offset)
  offset += 1
  const bEnable = buf.readUInt8(offset)
  offset += 1
  const bAlarm = buf.readUInt8(offset)
  offset += 1

  // NO padding, go straight to nSpeed
  const nSpeed = buf.readInt32LE(offset)
  offset += 4

  const fDirection = buf.readDoubleLE(offset)
  offset += 8
  const fLongitude = buf.readDoubleLE(offset)
  offset += 8
  const fLatitude = buf.readDoubleLE(offset)
  offset += 8

  const sUserID = buf
    .slice(offset, offset + 12)
    .toString("ascii")
    .replace(/\0/g, "")
  offset += 12

  const lDateTime = buf.readInt32LE(offset)
  offset += 4

  let resp = {
    nPackLen,
    nFlag,
    nErrorCode,
    bEnable,
    bAlarm,
    nSpeed,
    fDirection,
    fLongitude,
    fLatitude,
    sUserID,
    lDateTime,
  }

  console.log("Parsed as GISCommandResp:", resp)

  const pending = pendingRequests.get(sUserID)

  if (!pending) {
    // no pending HTTP caller waiting for this device — ignore or log
    console.warn("No pending request for", sUserID)
    return
  }

  pending.responses.push(resp)

  // First packet logic
  if (pending.responses.length === 1) {
    if (nErrorCode === 1) {
      // device offline -> resolve immediately
      return pending.resolve({
        success: false,
        reason: "Device offline",
        first: resp,
      })
    }
    // if nErrorCode === 0 -> device online, wait for second packet
    return
  }

  // Second packet logic
  if (pending.responses.length >= 2) {
    const second = resp.nErrorCode
    const wantedStatus = pending.status // "ON" or "OFF"

    if (wantedStatus === "OFF") {
      if (second === 28) {
        pending.resolve({
          success: true,
          message: "Engine cut off successfully",
          first: pending.responses[0],
          second: resp,
        })
      } else if (second === -28) {
        pending.resolve({
          success: false,
          message: "Engine cut failed",
          first: pending.responses[0],
          second: resp,
        })
      } else {
        pending.resolve({
          success: false,
          message: `Unexpected second code: ${second}`,
          first: pending.responses[0],
          second: resp,
        })
      }
    } else if (wantedStatus === "ON") {
      if (second === 35) {
        pending.resolve({
          success: true,
          message: "Engine enabled successfully",
          first: pending.responses[0],
          second: resp,
        })
      } else if (second === -35) {
        pending.resolve({
          success: false,
          message: "Engine enable failed",
          first: pending.responses[0],
          second: resp,
        })
      } else {
        pending.resolve({
          success: false,
          message: `Unexpected second code: ${second}`,
          first: pending.responses[0],
          second: resp,
        })
      }
    } else {
      pending.resolve({
        success: false,
        message: "Unknown requested status",
        first: pending.responses[0],
        second: resp,
      })
    }
  }
}

function handleBuffer(buf) {
  const startByte = buf.readUInt8(0) // get first byte

  console.log(startByte)

  if (startByte === 0x36) {
    parseGISCommandResp(buf)
  } else if (startByte === 0x35) {
    parseGISPosReq(buf)
  } else {
    return
  }
}
// ------------- Start , send , listen ---------------

//  On new packet
client.on("message", async (msg, rinfo) => {
  handleBuffer(msg)
})

// Send first packet
client.on("listening", () => {
  console.log("UDP client started. Sending handshake...")

  const handshake = buildHandshakeReq()

  client.send(
    handshake,
    0,
    handshake.length,
    SERVER_PORT,
    SERVER_HOST,
    (err, bytes) => {
      if (err) console.error("Handshake send error:", err)
    }
  )

  setInterval(() => {
    const handshake = buildHandshakeReq()
    client.send(
      handshake,
      0,
      handshake.length,
      SERVER_PORT,
      SERVER_HOST,
      (err) => {
        if (err) console.error("Handshake resend error:", err)
      }
    )
  }, 20000)
})
;(async () => {
  await refreshClientsCache()

  // Refresh every 30 minutes
  setInterval(refreshClientsCache, 30 * 60 * 1000)

  // Start socket
  client.bind()
})()
