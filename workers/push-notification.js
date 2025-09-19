import { Worker } from "bullmq"
import { connection } from "../redis.js"
import axios from "axios"
import { GoogleAuth } from "google-auth-library"
import { Client } from "../models/Client.js"
import moment from "moment/moment.js"

const serviceKey = {
  type: "service_account",
  project_id: "scantech-55f5b",
  private_key_id: "75d84c67ceda9a7d500d7fd20bcd6c4a308c90ff",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDBdFmGhmzdNhqq\nA8EcUa4xZxmqz2daCstvWdo1/KeBjM9xzh/YqvS86RVTndrHnnyKGlqIF54z+CXQ\ncxpf8a+orJtjn80FWQ95PhDzR+BolyqRaIyDBq1OgxIh1HQXj9dMZP4WjWuApq1G\nV0NDLK+hIc9ydinbqU2esrvoC6q0B6Ke58mgoCr+iGBQPPU/zeWvHGtMnWjBBCKZ\nhPRAcl9/vC9DDc0nkG4JDiktLmfyeIPdHJdj/Puz3BRKglCk7oEuX1YnUdo7516t\noa9gUzW19HaDUdzr0+sxGmoscrbcGEzDrQEPyhyNfRT6BMw1z/BIasI+h5QhZHQg\nqIhPWJqfAgMBAAECggEAAZcpLWs6qYOxyFlboTNlovX1Jsuf9iuqx6jtuSbACaYg\n6MqUdyPUDwuLYCZYNHihD0KvXD46smWvE3Fh5LS778kwu9wjqwaMnSI4nRHiohXO\n2KuU89kgyCwKYykzG+kY8xVW3KzV0e1gkp/5k7V117p8s7UXiClLDwlNYQiqSmyv\nDAl8RCKJtwPu5e6MK+qk2zfYjklzJGsg+XA1vsFvArhNgLxOuqGOnIMG3gRZhq3F\nVVN26iKzIkT+lYX6ef2IRPp0fiI/uckzw6B0fXxb+kc3b5bef5CMt2VNK9vlUaxr\nZthdK/3gB1t6yHcNrcPGTykXf6wZDGzD3Sqg7cD50QKBgQD0beaJq9B7DW10I5We\ntguFRVkGOlvROXXIcUEyctWjTJekWT3uUdlxKqHcCPV1WcgrH1HM/Uy3Gl5bIhwD\nu7dFNzfD2aZjvkf5BYSjzfIYEIQJn+CEDGREx32SVauJQ1BDxtU8svWT9Oc1//FB\nmr1EtjlwW3XnmKOWLUU90Ao/cQKBgQDKnLbp2NXmD++i1QA/IMDbroYCo7IxdXtz\n9vvMYcQGjoKHiF+4vpcYGdIlEGuHHRttJNf/folc08K45LzrSbwSen4YHjUF3rW9\nmWPf1XF4WQQ7rXHH2HNyB10EUI93s4yN3B2oKU/WKxDJwCJZHWge5G+c/tYM/d5Q\nubgAGuGTDwKBgQDd6s3NHoX4wpcmQ4x6/RL2m6CY6/EiwwVxx4mG8QWP7mEbIL7+\nmadOfINZz3RzZ+E5bYUKFMtKzpDuMsi2hv58xAZINVpA4qhbqavkQH3VZWFLj7D6\nknmSjIAwlMFZrRi5gFNneZ9HBqnIuCflBUVjlgIORauFamrTVSSxWymCsQKBgFoK\nvUs9XwnICUI/EMX9Q1gdvlaL8xQB1uRZXdudkyUqzh13YLrUkIdYakiofHDmYZrm\npctYq6kCPuY2WTLjaN55a3JCcmPybqgc9AK0c6H9RWFUGl2q9ts1JIRXXPrgY1Vj\n/hYOjflq2CIg7eLWq8AW2vdVVUEezV7oujnpuFfHAoGBAOfbYpnhlXX8lDKDWNKO\ne4krZpHF6jp7Qab2W/fxwotOilcgkCRKWkhnJ/BSR/z6MjkfhEkUN+wvioYa6gSs\naaQs3aZnrG+96kOwr/6sF45XcreBfuMmPMMpPxahFWxIYRDlOYf2pUVK+lvv18PF\nkpSZ4Rfavoos3iRPgG/5/4lc\n-----END PRIVATE KEY-----\n",
  client_email:
    "firebase-adminsdk-fbsvc@scantech-55f5b.iam.gserviceaccount.com",
  client_id: "111501909043533821308",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40scantech-55f5b.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
}

const alarmTemplates = {
  129: {
    title: "SOS Alert",
    body: (v, t) =>
      `Your vehicle (${v}) sent an SOS alert at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  130: {
    title: "Overspeed Alert",
    body: (v, t) =>
      `Your vehicle (${v}) exceeded the speed limit at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  131: {
    title: "Geo-fence Alert",
    body: (v, t) =>
      `Your vehicle (${v}) crossed the geofence at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  132: {
    title: "GSM Signal Lost",
    body: (v, t) =>
      `Your vehicle (${v}) lost GSM signal at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  137: {
    title: "Power Disconnection",
    body: (v, t) =>
      `Your vehicle (${v}) power supply was cut at ${t}. Click to view location.`,
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
  145: {
    title: "Fuel Alert",
    body: (v, t) =>
      `Your vehicle (${v}) fuel dropped by 10% in 60 seconds ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  146: {
    title: "Engine ON",
    body: (v, t) =>
      `Your vehicle (${v}) engine was started at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
  147: {
    title: "Engine OFF",
    body: (v, t) =>
      `Your vehicle (${v}) engine was stopped at ${t}. Click to view location.`,
    link: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`,
  },
}

const constructNotificationBody = (alarm) => {
  const number_plate = alarm?.number_plate

  const formattedTime = moment(new Date(alarm?.time)).format(
    "hh:mm a , Do MMM YYYY"
  )

  // Pick template from table
  const template = alarmTemplates[alarm?.alarm]

  return {
    title: template.title,
    body: template.body(number_plate, formattedTime),
    link: template.link(alarm?.lat, alarm?.lng),
  }
}

async function sendPushNotification(alarm, token) {
  const { title, body, link } = constructNotificationBody(alarm)

  const auth = new GoogleAuth({
    credentials: serviceKey,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  })

  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()

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

  const response = await axios.post(
    `https://fcm.googleapis.com/v1/projects/${serviceKey.project_id}/messages:send`,
    message,
    {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
    }
  )

  console.log(" FCM Response:", response.data)
}

async function sendFuelPushNotification(fuelData, token) {
  console.log(fuelData)
  const auth = new GoogleAuth({
    credentials: serviceKey,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  })

  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()

  // Format times (optional: use a date library like dayjs if you want pretty times)
  const startTimeStr = new Date(fuelData.extra.startTime).toLocaleString()
  const endTimeStr = new Date(fuelData.extra.endTime).toLocaleString()

  // Pick notification title & body based on event type
  let title, body
  if (fuelData.alarm === 100) {
    title = "Fuel dropping"
    body = `Your vehicle ${
      fuelData.number_plate
    } has lost ${fuelData.extra.litres.toFixed(
      1
    )} L of fuel. Level went from ${fuelData.extra.startFuel.toFixed(
      1
    )} L at ${startTimeStr} to ${fuelData.extra.endFuel.toFixed(
      1
    )} L at ${endTimeStr}. Click to view location.`
  } else {
    title = "Fuel top-up"
    body = `Your vehicle ${
      fuelData.number_plate
    } has been topped up with ${fuelData.extra.litres.toFixed(
      1
    )} L of fuel. Level went from ${fuelData.extra.startFuel.toFixed(
      1
    )} L at ${startTimeStr} to ${fuelData.extra.endFuel.toFixed(
      1
    )} L at ${endTimeStr}. Click to view location.`
  }

  const link = `https://www.google.com/maps?q=${fuelData.location.lat},${fuelData.location.lng}`

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

  const response = await axios.post(
    `https://fcm.googleapis.com/v1/projects/${serviceKey.project_id}/messages:send`,
    message,
    {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
    }
  )

  console.log(" FCM Response:", response.data)
}

const notificationWorker = new Worker(
  "notificationQueue",
  async (job) => {
    console.log("📥 Notification job received:", job.name, job.data)

    if (job.name === "notification") {
      const alarm = job.data

      const client = await Client.findOne({
        "vehicles.device_serial": alarm.vehId,
      })

      if (!client) {
        console.warn(`⚠️ No client found for vehId: ${alarm.vehId}`)
        return
      }

      const { client_id, ...alarmWithoutClientId } = alarm

      client.alerts.push(alarmWithoutClientId)

      if (client.alerts.length > 200) {
        client.alerts = client.alerts.slice(-200) // keep only last 200
      }

      await client.save()

      for (const token of client.fcm_tokens) {
        if (token.logged_in) {
          try {
            await sendPushNotification(alarmWithoutClientId, token.token)
            console.log(`✅ Sent FCM notification to ${token.token}`)
          } catch (err) {
            console.error(`❌ Failed to send FCM notification:`, err.message)
          }
        } else {
          console.log(`⏭️ Skipped token ${token.token} (not logged in)`)
        }
      }
    } else if (job.name === "fuel-notification") {
      const fuelData = job.data

      console.log(fuelData)

      const client = await Client.findOne({
        "vehicles.device_serial": fuelData.vehId,
      })

      if (!client) {
        console.warn(`⚠️ No client found for vehId: ${fuelData.vehId}`)
        return
      }

      client.alerts.push({
        vehId: fuelData.vehId,
        alarm: fuelData.type === "Siphon" ? 100 : 99, // Siphon 100 , Refuel 99
        time: Date.now(),
        location: {
          lat: fuelData.location.lat,
          lng: fuelData.location.lng,
        },
        number_plate: fuelData.number_plate,
        extra: JSON.stringify({
          litres: fuelData.litersChanged,
          startTime: fuelData.startTime,
          endTime: fuelData.endTime,
          startFuel: fuelData.startFuel,
          endFuel: fuelData.endFuel,
        }),
      })

      if (client.alerts.length > 200) {
        client.alerts = client.alerts.slice(-200) // keep only last 200
      }

      await client.save()

      for (const token of client.fcm_tokens) {
        if (token.logged_in) {
          try {
            await sendFuelPushNotification(
              {
                vehId: fuelData.vehId,
                alarm: fuelData.type === "Siphon" ? 100 : 99, // Siphon 100 , Refuel 99
                time: Date.now(),
                location: {
                  lat: fuelData.location.lat,
                  lng: fuelData.location.lng,
                },
                number_plate: fuelData.number_plate,
                extra: {
                  litres: fuelData.litersChanged,
                  startTime: fuelData.startTime,
                  endTime: fuelData.endTime,
                  startFuel: fuelData.startFuel,
                  endFuel: fuelData.endFuel,
                },
              },
              token.token
            )
            console.log(`✅ Sent FCM notification to ${token.token}`)
          } catch (err) {
            console.error(`❌ Failed to send FCM notification:`, err.message)
          }
        } else {
          console.log(`⏭️ Skipped token ${token.token} (not logged in)`)
        }
      }
    }
  },
  { connection }
)

notificationWorker.on("failed", (job, err) => {
  console.error(`❌ Notification job ${job.id} failed:`, err.message)
})

console.log("🚀 Notification worker started...")
