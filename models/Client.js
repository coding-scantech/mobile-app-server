import mongoose from "mongoose"

const alertSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g. "overspeed", "tamper", "low fuel"
  time: { type: Date, required: true }, // when alert occurred
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  extra: { type: String }, // flexible field for extra info
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

export const Client = mongoose.model("Client", clientSchema)
