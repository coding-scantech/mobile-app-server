import { FuelMonitor } from "./FuelMonitor.js"

export class FleetManager {
  constructor(vehicleIds) {
    this.monitors = vehicleIds.map((id) => new FuelMonitor(id))
  }

  startAll() {
    this.monitors.forEach((m) => m.start())
  }

  stopAll() {
    this.monitors.forEach((m) => m.stop())
  }
}

// const fleet = new FleetManager(vehicleIds)
// fleet.startAll()
