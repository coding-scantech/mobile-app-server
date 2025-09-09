import { Worker, Queue } from "bullmq"

import { connection } from "../redis.js"

// ----------- Notification queue ---------------

export const notificationQueue = new Queue("notificationQueue", { connection })

// const alarmTable = {
//   1: "SoSAlarm",
//   29: "SoSAlarm",
//   2: "Speed Alarm",
//   130: "Speed Alarm",
//   3: "Distance Alarm",
//   131: "Distance Alarm",
//   4: "GSM Signal Alarm",
//   132: "GSM Signal Alarm",
//   9: "Power Alarm",
//   137: "Power Alarm",
//   10: "Power Low",
//   138: "Power Low",
//   15: "Tamper Alarm",
//   143: "Tamper Alarm",
//   16: "GPS Signal Alarm",
//   144: "GPS Signal Alarm",
//   128: "Normal",
// }

async function storeAndCheckAlarm(packet, connection) {
  const key = `vehicle:${packet.vehId}:history`

  // push new packet and maintain rolling window of last 4
  await connection.lpush(key, JSON.stringify(packet))
  await connection.ltrim(key, 0, 2)

  // fetch latest and previous packets
  const [latest, previous] = (await connection.lrange(key, 0, 1)).map(
    JSON.parse
  )

  if (!previous) return null

  // detect alarm change
  if (latest.alarm !== previous.alarm && latest.alarm !== 128) {
    return {
      vehId: packet.vehId,
      alarm: latest.alarm,
      time: packet.time,
      location: { lat: packet.lat, lng: packet.lng },
    }
  }

  return null
}

// Takes in packet stream and adds to notification queue incase of alert
const alarmWorker = new Worker(
  "alarmQueue",
  async (job) => {
    const packet = job.data

    const alarm = await storeAndCheckAlarm(packet, connection)

    if (alarm) {
      console.log("🚨 Alarm detected:", alarm)

      await notificationQueue.add("notification", alarm, {
        removeOnComplete: true,
        removeOnFail: true,
      })
    }
  },
  { connection, concurrency: 50 }
)

alarmWorker.on("failed", (job, err) => {
  console.error(`❌ Alarm detection job ${job.id} failed:`, err.message)
})

console.log("🚀 Alarm detection worker started...")
