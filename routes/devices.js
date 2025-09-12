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

// Helper: Check online/offline status
function isOnline(timestampStr) {
  if (!timestampStr) return false
  const lastTime = new Date(timestampStr)
  const now = new Date()
  const diffMs = now - lastTime
  return diffMs <= 2 * 60 * 1000 // 2 minutes
}

function decimalToBinary(N) {
  let binary = ""

  while (N > 0) {
    binary = (N % 2) + binary
    N = Math.floor(N / 2)
  }

  return binary.padStart(8, "0")
}

function checkSixthBit(num) {
  let binary = decimalToBinary(num)

  let bit = binary[1]

  return bit === "1" ? "ON" : "OFF"
}

// GET /devices
router.get("/", async (req, res) => {
  const { email } = req.query
  try {
    // Step 1: Get all vehicles
    const vehicleListXml = await fetchXml(
      `${process.env.BASE_URL}AndroidInterface.asmx/GetVehicleByGroupForMobile`,
      { email }
    )

    const rawVehicles = vehicleListXml.ArrayOfString.string
    const vehicles = rawVehicles.map((v) => {
      const [vehId, regNo, vehSerial] = v.split(",")
      return { vehId, regNo, vehSerial }
    })

    // Step 2: Fetch details + last location
    const detailedVehicles = await Promise.all(
      vehicles.map(async (vehicle) => {
        try {
          // Fetch details (Request 1)
          const detailXml = await fetchXml(
            `${process.env.BASE_URL}AndroidInterface.asmx/GetVehDetailsClick`,
            { vehID: vehicle.vehId }
          )
          const detailStr = detailXml.string._ || detailXml.string
          const detailsArr = detailStr.split(",")

          const [
            regNoFromDetails,
            color,
            sim,
            vehSerialFromDetails,
            _1,
            contactName,
            vehicleType,
            driverName,
            frameNumber,
            address,
            engineNumber,
            purchaseDate,
            registerDate,
          ] = detailsArr

          // Fetch last known location
          const lastLocXml = await fetchXml(
            `${process.env.BASE_URL}/AndroidInterface.asmx/GetLastVehicleByVehID`,
            { vehID: vehicle.vehId }
          )
          const lastLocStr = lastLocXml.string?._ || lastLocXml.string
          const [
            _vid,
            _regNo,
            lng,
            lat,
            speed,
            angle,
            acc,
            timestamp,
            __1,
            __2,
            __3,
            __4,
            __5,
            fuelRaw,
          ] = lastLocStr.split(",")

          return {
            ...vehicle,
            color,
            sim,
            contactName,
            vehicleType,
            driverName,
            frameNumber,
            address,
            engineNumber,
            purchaseDate,
            registerDate,
            location: { lat: parseFloat(lat), lng: parseFloat(lng) },
            speed: Number(speed),
            angle: Number(angle),
            accStatus:
              acc === "11" ? "ON" : acc === "12" ? "OFF" : checkSixthBit(__5),
            fuel: fuelRaw ? Number(fuelRaw.replace("L;", "").trim()) : null,
            timestamp,
            online: isOnline(timestamp),
          }
        } catch (err) {
          console.error(`Error fetching data for vehID ${vehicle.vehId}`, err)
          return { ...vehicle, error: "Data fetch failed" }
        }
      })
    )

    res.json(detailedVehicles)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong" })
  }
})

export default router
