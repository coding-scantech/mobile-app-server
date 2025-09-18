// routes/fcm.js
import express from "express"
import { Client } from "../models/Client.js"

const router = express.Router()

router.post("/", async (req, res) => {
  try {
    const { status, clientId, token } = req.body

    if (!status || !clientId || !token) {
      return res
        .status(400)
        .json({ message: "status, clientId, and token are required" })
    }

    const client = await Client.findById(clientId)
    if (!client) {
      return res.status(404).json({ message: "Client not found" })
    }

    // Find the token entry inside fcm_tokens
    const tokenEntry = client.fcm_tokens.find((t) => t.token === token)
    if (!tokenEntry) {
      return res.status(404).json({ message: "Token not found" })
    }

    // Update logged_in status based on "in"/"out"
    if (status === "in") {
      tokenEntry.logged_in = true
    } else if (status === "out") {
      tokenEntry.logged_in = false
    } else {
      return res
        .status(400)
        .json({ message: "Invalid status. Use 'in' or 'out'." })
    }

    await client.save()

    res.json({
      message: `Token status updated successfully`,
      token: tokenEntry,
    })
  } catch (error) {
    console.error("Error updating FCM token status:", error)
    res.status(500).json({ message: "Internal server error" })
  }
})

export default router
