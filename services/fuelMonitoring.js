import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

const VEHICLE_ID = 419
const API_URL =
  "http://www.scantech.top:8090/AndroidInterface.asmx/GetLastVehicleByVehID"

let fuelHistory = []
let activeEvent = null
let monitorInterval = null
let paused = false

let refuel_start_diff = 2
let refuel_stop_diff = 0.25
let poll_count = 120000 // 2 minutes

async function getLastPosition(vehId) {
  const body = new URLSearchParams({ vehId })
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const text = await response.text()
  const result = await parseStringPromise(text)
  const rawString = result.string._

  const parts = rawString.replace(";", "").split(",")
  return {
    vehId: parts[0],
    regNo: parts[1],
    lng: parseFloat(parts[2]),
    lat: parseFloat(parts[3]),
    speed: parseFloat(parts[4]),
    angle: parseFloat(parts[5]),
    acc: parts[6],
    timestamp: parts[7],
    fuel: parseFloat(parts[13]),
  }
}

function avgFuel(records) {
  if (!records.length) return 0
  return records.reduce((sum, r) => sum + (r.fuel || 0), 0) / records.length
}

async function sendSMS(event, liters) {
  const message = {
    type: event.type,
    fuelChange: `${liters.toFixed(1)} L`,
    location: `${event.location.lat} , ${event.location.lng}`,
    time: `${event.startTime} - ${event.endTime}`,
  }

  console.log("SMS sent:", message)
}

function pauseMonitor(ms) {
  if (monitorInterval) clearInterval(monitorInterval)
  paused = true
  console.log(`⏸️ Monitor paused for ${ms / 1000} seconds...`)

  setTimeout(() => {
    console.log("▶️ Resuming monitor...")
    paused = false
    startPolling()
  }, ms)
}

function processFuelData(record) {
  console.log({ fuel: record.fuel, time: record.timestamp })

  fuelHistory.push(record)
  if (fuelHistory.length > 15) fuelHistory.shift() // keep buffer small

  const len = fuelHistory.length
  if (len < 5) return

  const prev = fuelHistory[len - 2]
  const curr = fuelHistory[len - 1]
  const diff = curr.fuel - prev.fuel

  console.log(activeEvent, diff, refuel_stop_diff)

  // 🚀 Start event if difference > refuel_start_diff (L)
  if (!activeEvent && Math.abs(diff) > refuel_start_diff) {
    activeEvent = {
      type: diff > 0 ? "Refuel" : "Siphon",
      startTime: prev.timestamp,
      startFuel: avgFuel(fuelHistory.slice(len - 5, len - 2)), // 3 records before start
      location: { lat: curr.lat, lng: curr.lng },
    }
    console.log("Event started")

    // Pause monitor for 1 minute after event start
    pauseMonitor(poll_count)
    return
  }

  // ✅ End event if difference < refuel_stop_diff (L)
  if (activeEvent && Math.abs(diff) < refuel_stop_diff) {
    activeEvent.endTime = curr.timestamp
    activeEvent.endFuel = avgFuel(fuelHistory.slice(len - 2, len + 1)) // 3 records after stop

    const litersChanged =
      activeEvent.type === "Refuel"
        ? activeEvent.endFuel - activeEvent.startFuel
        : activeEvent.startFuel - activeEvent.endFuel

    sendSMS(activeEvent, litersChanged)
    console.log("Event ended")
    activeEvent = null
  }
}

function startPolling() {
  monitorInterval = setInterval(async () => {
    if (paused) return
    try {
      const record = await getLastPosition(VEHICLE_ID)
      processFuelData(record)
    } catch (err) {
      console.error("Polling error:", err.message)
    }
  }, 10000)
}

export function startFuelMonitor() {
  startPolling()
}

export { getLastPosition }
