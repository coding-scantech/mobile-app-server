import express from "express"
import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

const router = express.Router()

// Helper: POST XML request
async function fetchXml(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  })
  const text = await response.text()
  return parseStringPromise(text)
}

// Alarm type mapping
const alarmMap = {
  11: "ACC ON",
  12: "ACC OFF",
  128: "No Alarm",
  2: "Speed Alarm",
  30: "Speed Alarm",
  1: "SOS Alarm",
  129: "SOS Alarm",
  9: "Power Alarm",
  137: "Power Alarm",
  10: "Power Low Alarm",
  138: "Power Low Alarm",
  15: "Tamper Alarm",
  143: "Tamper Alarm",
  145: "GPS cut off",
}

// Helper: format date as `YYYY-MM-DD HH:mm:ss`
function formatDate(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // getMonth() is zero-based
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Fetch vehicle list
async function fetchVehicleList() {
  const vehicleListXml = await fetchXml(
    `${process.env.BASE_URL}/AndroidInterface.asmx/GetVehicleByGroupForMobile`,
    { email: "fuel@123.com" }
  )

  const rawVehicles = vehicleListXml.ArrayOfString.string

  const vehicles = rawVehicles.map((v) => {
    const [vehId, regNo, vehSerial] = v.split(",")
    return { vehId, regNo, vehSerial }
  })

  return vehicles
}

// Fetch alarms for a single vehicle
async function fetchVehicleAlarms(vehicleId) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 1)

  const startTime = formatDate(start)
  const endTime = formatDate(end)

  const payload = new URLSearchParams({
    id: vehicleId,
    startTime,
    endTime,
    dif_time: "8",
  })

  console.log(payload)

  const response = await fetch(
    `${process.env.BASE_URL}/AndroidInterface.asmx/FillListView`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    }
  )

  const xmlText = await response.text()
  const parsed = await parseStringPromise(xmlText)
  const rawString = parsed.string._

  return (
    rawString
      ?.split(";")
      ?.filter((line) => line.trim() !== "")
      ?.map((record) => {
        const [timestamp, longitude, latitude, speed, angle, alarmType] = record
          .split(",")
          .map((v) => v.trim())

        return {
          timestamp,
          location: {
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
          },
          speed: parseFloat(speed),
          angle: parseInt(angle),
          status: alarmMap[alarmType] || "Unknown Alarm",
          alarmCode: alarmType,
        }
      }) || []
  )
}

// Main merged route
router.get("/", async (req, res) => {
  try {
    const vehicles = await fetchVehicleList()

    const allAlarms = []

    for (const vehicle of vehicles) {
      const alarms = await fetchVehicleAlarms(vehicle.vehId)

      // Detect alarm changes
      let lastStatus = null
      for (const record of alarms) {
        if (record.status !== lastStatus) {
          allAlarms.push({
            vehId: vehicle.vehId,
            regNo: vehicle.regNo,
            timestamp: record.timestamp,
            status: record.status,
            location: record.location,
            alarmCode: record.alarmCode,
          })
          lastStatus = record.status
        }
      }
    }

    // Sort alarms so most recent is first
    allAlarms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    res.json({
      totalAlarms: allAlarms.length,
      data: allAlarms,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch alarms" })
  }
})

export default router
