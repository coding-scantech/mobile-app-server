import express from "express"
import cors from "cors"
import dotenv from "dotenv"

import trackRouter from "./routes/track.js"
import devicesRouter from "./routes/devices.js"
import playbackRouter from "./routes/playback.js"
import alertsRouter from "./routes/alerts.js"

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
app.use("/track", trackRouter)
app.use("/devices", devicesRouter)
app.use("/playback", playbackRouter)
app.use("/alerts", alertsRouter)

// Default route
app.get("/", (req, res) => {
  res.json({ message: "Vehicle API is running" })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
