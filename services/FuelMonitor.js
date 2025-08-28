import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

const API_URL =
  "http://www.scantech.top:8090/AndroidInterface.asmx/GetLastVehicleByVehID"

function avgFuel(records) {
  if (!records.length) return 0
  return records.reduce((sum, r) => sum + (r.fuel || 0), 0) / records.length
}

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

export class FuelMonitor {
  constructor(vehId, opts = {}) {
    this.vehId = vehId
    this.fuelHistory = []
    this.activeEvent = null
    this.interval = null
    this.paused = false

    this.refuel_start_diff = opts.refuel_start_diff || 2
    this.refuel_stop_diff = opts.refuel_stop_diff || 0.25
    this.poll_pause = opts.poll_pause || 120000 // default 2 mins
    this.poll_interval = opts.poll_interval || 10000 // default 10s
  }

  async sendSMS(event, liters) {
    const message = {
      vehId: this.vehId,
      type: event.type,
      fuelChange: `${liters.toFixed(1)} L`,
      location: `${event.location.lat}, ${event.location.lng}`,
      time: `${event.startTime} - ${event.endTime}`,
    }
    console.log("SMS sent:", message)
  }

  pause(ms) {
    clearInterval(this.interval)
    this.paused = true
    console.log(`⏸️ Vehicle ${this.vehId} paused for ${ms / 1000}s`)

    setTimeout(() => {
      console.log(`▶️ Vehicle ${this.vehId} resumed`)
      this.paused = false
      this.start()
    }, ms)
  }

  process(record) {
    console.log({
      vehId: this.vehId,
      fuel: record.fuel,
      time: record.timestamp,
    })

    this.fuelHistory.push(record)
    if (this.fuelHistory.length > 15) this.fuelHistory.shift()

    const len = this.fuelHistory.length
    if (len < 5) return

    const prev = this.fuelHistory[len - 2]
    const curr = this.fuelHistory[len - 1]
    const diff = curr.fuel - prev.fuel

    // Start event
    if (!this.activeEvent && Math.abs(diff) > this.refuel_start_diff) {
      this.activeEvent = {
        type: diff > 0 ? "Refuel" : "Siphon",
        startTime: prev.timestamp,
        startFuel: avgFuel(this.fuelHistory.slice(len - 5, len - 2)),
        location: { lat: curr.lat, lng: curr.lng },
      }
      console.log(`🚨 Event started for vehicle ${this.vehId}`)

      this.pause(this.poll_pause)
      return
    }

    // End event
    if (this.activeEvent && Math.abs(diff) < this.refuel_stop_diff) {
      this.activeEvent.endTime = curr.timestamp
      this.activeEvent.endFuel = avgFuel(
        this.fuelHistory.slice(len - 2, len + 1)
      )

      const litersChanged =
        this.activeEvent.type === "Refuel"
          ? this.activeEvent.endFuel - this.activeEvent.startFuel
          : this.activeEvent.startFuel - this.activeEvent.endFuel

      this.sendSMS(this.activeEvent, litersChanged)
      console.log(`✅ Event ended for vehicle ${this.vehId}`)
      this.activeEvent = null
    }
  }

  start() {
    this.interval = setInterval(async () => {
      if (this.paused) return
      try {
        const record = await getLastPosition(this.vehId)
        this.process(record)
      } catch (err) {
        console.error(`Polling error [veh ${this.vehId}]:`, err.message)
      }
    }, this.poll_interval)
  }

  stop() {
    clearInterval(this.interval)
    console.log(`🛑 Monitor stopped for vehicle ${this.vehId}`)
  }
}
