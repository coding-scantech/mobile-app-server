import mongoose from "mongoose"

// Mongoose schema + model
const clientSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  pwd: { type: String, required: true },
  fcm_tokens: [{ type: String }],
})

export const Client = mongoose.model("Client", clientSchema)
