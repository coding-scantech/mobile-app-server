import express from "express"
import { Client } from "../models/Client.js"

const router = express.Router()

// ✅ Route: Get all alerts for a client by email
router.get("/", async (req, res) => {
  try {
    const { email } = req.query // body should contain email

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    const client = await Client.findOne({ email })

    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    return res.json({ alerts: client.alerts })
  } catch (err) {
    console.error("Error fetching alerts:", err)
    res.status(500).json({ error: "Server error" })
  }
})

export default router
