import { Worker } from "bullmq"
import { connection } from "../redis.js"
import axios from "axios"
import { readFileSync } from "fs"
import { GoogleAuth } from "google-auth-library"
import { Client } from "../models/Client.js"
import moment from "moment/moment.js"

const serviceKey = JSON.parse(
  readFileSync("./fcm-service-account.json", "utf8")
)

const auth = new GoogleAuth({
  credentials: serviceKey,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
})

const client = await auth.getClient()
const accessToken = await client.getAccessToken()

const alarmTemplates = {
  1: {
    title: "SOS Alert",
    body: (v, t) =>
      `Your vehicle (${v}) sent an SOS alert at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  29: {
    title: "SOS Alert",
    body: (v, t) =>
      `Your vehicle (${v}) sent an SOS alert at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  2: {
    title: "Overspeed Alert",
    body: (v, t) =>
      `Your vehicle (${v}) exceeded the speed limit at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  130: {
    title: "Overspeed Alert",
    body: (v, t) =>
      `Your vehicle (${v}) exceeded the speed limit at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  3: {
    title: "Distance Alarm",
    body: (v, t) =>
      `Your vehicle (${v}) triggered a distance alarm at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  131: {
    title: "Distance Alarm",
    body: (v, t) =>
      `Your vehicle (${v}) triggered a distance alarm at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  4: {
    title: "GSM Signal Lost",
    body: (v, t) =>
      `Your vehicle (${v}) lost GSM signal at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  132: {
    title: "GSM Signal Lost",
    body: (v, t) =>
      `Your vehicle (${v}) lost GSM signal at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  9: {
    title: "Power Cut",
    body: (v, t) =>
      `Your vehicle (${v}) power supply was cut at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  137: {
    title: "Power Cut",
    body: (v, t) =>
      `Your vehicle (${v}) power supply was cut at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  10: {
    title: "Low Power",
    body: (v, t) =>
      `Your vehicle (${v}) battery is low as of ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  138: {
    title: "Low Power",
    body: (v, t) =>
      `Your vehicle (${v}) battery is low as of ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  15: {
    title: "Tamper Alert",
    body: (v, t) =>
      `Tamper detected on vehicle (${v}) at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  143: {
    title: "Tamper Alert",
    body: (v, t) =>
      `Tamper detected on vehicle (${v}) at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  16: {
    title: "GPS Signal Lost",
    body: (v, t) =>
      `Your vehicle (${v}) lost GPS signal at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  144: {
    title: "GPS Signal Lost",
    body: (v, t) =>
      `Your vehicle (${v}) lost GPS signal at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  128: {
    title: "Normal",
    body: (v, t) =>
      `Your vehicle (${v}) reported normal status at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },

  ACC_ON: {
    title: "Engine Started",
    body: (v, t) =>
      `Your vehicle (${v}) engine was started at ${t}. Click to view location.`,
  },

  ACC_OFF: {
    title: "Engine Stopped",
    body: (v, t) =>
      `Your vehicle (${v}) engine was switched off at ${t}. Click to view location.`,
  },
}

const constructNotificationBody = (alarm) => {
  const number_plate = alarm?.number_plate

  const formattedTime = moment(new Date(alarm?.time)).format(
    "hh:mm a , Do MMM YYYY"
  )

  // Pick template from table
  const template = alarmTemplates[alarm?.type]

  return {
    title: template.title,
    body: template.body(number_plate, formattedTime),
    link: template.link(alarm?.location?.lat, alarm?.location?.lng),
  }
}

async function sendPushNotification(alarm, token) {
  const { title, body, link } = constructNotificationBody(alarm)

  const message = {
    validate_only: false,
    message: {
      token,
      notification: {
        title,
        body,
      },
      data: {
        link,
      },
    },
  }

  await axios.post(
    `https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`,
    message,
    {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
    }
  )
}

const notificationWorker = new Worker(
  "notificationQueue",
  async (job) => {
    const alarm = job.data

    // 1. Find the client who owns this vehicle
    const client = await Client.findOne({
      "vehicles.veh_id": alarm.vehId,
    })

    if (!client) {
      console.warn(`⚠️ No client found for vehId: ${alarm.vehId}`)
      return
    }

    // 2. Find the vehicle object to get number_plate
    const vehicle = client.vehicles.find((v) => v.veh_id === alarm.vehId)
    const number_plate = vehicle?.number_plate || "Unknown"

    const enrichedAlarm = {
      ...alarm,
      number_plate,
    }

    client.alerts.push(enrichedAlarm)

    await client.save()

    for (const token of client.fcm_tokens) {
      try {
        await sendPushNotification(enrichedAlarm, token)
        console.log(`✅ Sent notification for ${number_plate} to ${token}`)
      } catch (err) {
        console.error(
          `❌ Failed to send notification to ${token}:`,
          err.message
        )
      }
    }
  },
  { connection, concurrency: 50 }
)

notificationWorker.on("failed", (job, err) => {
  console.error(`❌ Notification job ${job.id} failed:`, err.message)
})

console.log("🚀 Notification detection worker started...")
