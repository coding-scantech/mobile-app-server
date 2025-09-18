// routes/fcm.js
import express from "express"
import { Client } from "../models/Client.js"

const router = express.Router()

router.post("/", async (req, res) => {
  const { clientId, fcmToken } = req.body

  if (!clientId || !fcmToken) {
    return res.status(400).json({ error: "clientId and fcmToken are required" })
  }

  try {
    const client = await Client.findById(clientId)
    if (!client) {
      return res.status(404).json({ error: "Client not found" })
    }

    if (!client.fcm_tokens.map(({ token }) => token).includes(fcmToken)) {
      client.fcm_tokens.push({
        token: fcmToken,
        logged_in: true,
      })
      await client.save()
    }

    res.json({ success: true, fcm_tokens: client.fcm_tokens })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

export default router
