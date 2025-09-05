import express from "express"
import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

const router = express.Router()

// Alarm type mapping
const alarmMap = {
  129: "SOS alarm",
  130: "Overspeed alarm",
  131: "Geo-fence alarm alarm",
  132: " GSM Signal lost alarm",
  137: "Power disconnection alarm",
  144: "GPS signal lost alarm",
  145: "Fuel alarm",
}

router.get("/", async (req, res) => {
  try {
    const { id, startTime, endTime } = req.query
    // These could also be taken from query params

    const payload = new URLSearchParams({
      id,
      startTime,
      endTime,
      dif_time: "8",
    })
    console.log(payload)

    // Send POST request
    const response = await fetch(
      "http://www.scantech.top:8090/AndroidInterface.asmx/FillListView",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
      }
    )

    const xmlText = await response.text()

    // Parse XML
    const parsed = await parseStringPromise(xmlText)
    const rawString = parsed.string._ // Extract the actual CSV-like string

    // Split into records and map to objects
    const records = rawString
      .split(";")
      .filter((line) => line.trim() !== "")
      .map((record) => {
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
          status: alarmMap[alarmType] ? alarmMap[alarmType] : "Unknown Alarm",
        }
      })

    res.json({
      count: records.length,
      data: records,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch or parse data" })
  }
})

export default router
