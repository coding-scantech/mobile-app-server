import mongoose from "mongoose"

const alertSchema = new mongoose.Schema({
  vehId: { type: String },
  alarm: { type: Number, required: true },
  time: { type: Number, required: true },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  number_plate: { type: String },
  extra: { type: String },
})

const vehicleSchema = new mongoose.Schema({
  veh_id: { type: String, required: true },
  number_plate: { type: String },
  device_serial: { type: String, required: true },
  fuel_history: [
    {
      time: { type: Date },
      litres: { type: Number },
    },
  ],
  next_service: { type: Date },
  engine_deactivated: { type: Boolean, default: false },
})

// Mongoose schema + model
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  pwd: { type: String, required: true },
  fcm_tokens: [
    {
      token: { type: String },
      logged_in: { type: Boolean },
    },
  ],
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
