import express from "express"
import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

const router = express.Router()

// Helper to fetch XML and parse to JSON
async function fetchXml(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  })
  const text = await response.text()
  return parseStringPromise(text)
}

router.get("/", async (req, res) => {
  try {
    const { vehID, email } = req.query

    let vehicles = []

    if (vehID) {
      // If vehID is provided, just track that one
      vehicles = [{ vehId: vehID }]
    } else {
      // Otherwise, fetch full vehicle list
      const vehicleListXml = await fetchXml(
        `${process.env.BASE_URL}/AndroidInterface.asmx/GetVehicleByGroupForMobile`,
        { email }
      )

      const rawList = vehicleListXml["ArrayOfString"]["string"]
      vehicles = rawList?.map((entry) => {
        const [vehId, regNo, vehSerial] = entry.split(",")
        return { vehId, regNo, vehSerial }
      })
    }

    // Enrich each vehicle with last location info
    const enrichedVehicles = await Promise.all(
      vehicles?.map(async (vehicle) => {
        try {
          const lastXml = await fetchXml(
            `${process.env.BASE_URL}/AndroidInterface.asmx/GetLastVehicleByVehID`,
            { vehID: vehicle?.vehId }
          )

          const rawData = lastXml.string?._ || ""
          const [
            vehId,
            regNo,
            lng,
            lat,
            speed,
            angle,
            acc,
            timestamp,
            _1,
            _2,
            _3,
            _4,
            _5,
            fuelRaw,
          ] = rawData.split(",")

          const fuel = fuelRaw?.replace("L;", "").trim()

          return {
            ...vehicle,
            regNo,
            location: { lat: parseFloat(lat), lng: parseFloat(lng) },
            speed: Number(speed),
            accStatus: acc === "11" ? "ON" : acc == "12" ? "OFF" : "UNDEFINED",
            fuel: Number(fuel),
            timestamp,
            angle: Number(angle),
          }
        } catch (err) {
          console.error(
            `Failed to fetch last data for vehID ${vehicle.vehId}`,
            err
          )
          return { ...vehicle, error: "Failed to fetch last location info" }
        }
      })
    )

    res.status(200).json(enrichedVehicles)
  } catch (err) {
    console.error("API error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
