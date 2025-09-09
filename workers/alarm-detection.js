import { Worker, Queue } from "bullmq"

import { connection } from "../redis.js"

// ----------- Notification queue ---------------

export const notificationQueue = new Queue("notificationQueue", { connection })

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
      number_plate: packet.number_plate,
      client_id: packet.client_id,
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
  { connection }
)

alarmWorker.on("failed", (job, err) => {
  console.error(`❌ Alarm detection job ${job.id} failed:`, err.message)
})

console.log("🚀 Alarm detection worker started...")
