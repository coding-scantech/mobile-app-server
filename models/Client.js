import mongoose from "mongoose"

const alertSchema = new mongoose.Schema({
  vehId: { type: String },
  time: { type: Number, required: true },
  acc: { type: String, required: true },
  alarm: { type: Number, required: true },
  speed: { type: Number },
  angle: { type: Number },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  number_plate: { type: String, required: true },
})

const vehicleSchema = new mongoose.Schema({
  veh_id: { type: String, required: true },
  number_plate: { type: String, required: true },
  device_serial: { type: String, required: true },
})

// Mongoose schema + model
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  pwd: { type: String, required: true },
  fcm_tokens: [{ type: String }],
  alerts: [alertSchema], // an array of alerts
  vehicles: [vehicleSchema],
})

clientSchema.pre("save", function (next) {
  if (this.alerts.length > 200) {
    this.alerts = this.alerts.slice(-200) // keep only last 200
  }
  next()
})

export const Client = mongoose.model("Client", clientSchema)
