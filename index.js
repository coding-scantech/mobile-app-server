import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"

import loginRouter from "./routes/login.js"
import registerFCMRouter from "./routes/registerFCM.js"

import trackRouter from "./routes/track.js"
import devicesRouter from "./routes/devices.js"
import playbackRouter from "./routes/playback.js"
import alertsRouter from "./routes/alerts.js"
import { startFuelMonitor } from "./services/fuelMonitoring.js"
import { FleetManager } from "./services/FleetManager.js"

import "./workers/alarm-detection.js"
import "./workers/push-notification.js"
import "./udp-listener.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
)

// Middleware to parse JSON bodies
app.use(express.json())

// Register routes
app.use("/login", loginRouter)
app.use("/registerFCM", registerFCMRouter)
app.use("/track", trackRouter)
app.use("/devices", devicesRouter)
app.use("/playback", playbackRouter)
app.use("/alerts", alertsRouter)

// Default route
app.get("/", (req, res) => {
  res.json({ message: "Vehicle API is running" })
})

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB")
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })
