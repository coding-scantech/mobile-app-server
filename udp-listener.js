import dgram from "dgram"
import { Queue } from "bullmq"
import { connection } from "./redis.js"
import dotenv from "dotenv"

dotenv.config()

const SERVER_HOST = process.env.SERVER_HOST
const SERVER_PORT = process.env.SERVER_PORT

// ---------- Bull setup -----------

export const notificationQueue = new Queue("notificationQueue", { connection })

//  ------------- UDP scocket setup -----------------
const client = dgram.createSocket("udp4")

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

  return {
    vehId,
    time,
    acc,
    alarm,
    speed,
    angle,
    lng,
    lat,
  }
}

// ------------- Start , send , listen ---------------

//  On new packet
client.on("message", async (msg, rinfo) => {
  if (msg.length > 4) {
    try {
      const alarm = parseGISPosReq(msg)

      // Add to queue
      console.log("📍:", alarm)

      await notificationQueue.add("notification", alarm, {
        removeOnComplete: true,
        removeOnFail: true,
      })
    } catch (err) {
      console.log("Unknown payload")
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
      else console.log("Handshake sent, Bytes received :", bytes)
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
        else console.log("⏱️ Handshake resent, Bytes sent:", bytes)
      }
    )
  }, 20000)
})

// Start socket
client.bind()
