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
const client = dgram.createSocket("udp4")

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

setInterval(refreshClientsCache, 30 * 60 * 1000) // 30 min

// 1. Initiate handshake

function buildHandshakeReq() {
  const buf = Buffer.alloc(4)
  buf.writeInt16LE(4, 0)
  buf.writeInt16LE(4, 2)
  return buf
}

// 2. Parse position information

function parseGISPosReq(buf) {
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

  return {
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
}

// ------------- Start , send , listen ---------------

//  On new packet
client.on("message", async (msg, rinfo) => {
  if (msg.length > 4) {
    try {
      const data = parseGISPosReq(msg)

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
    } catch (err) {
      return
    }
  }
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
      (err, bytes) => {
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
