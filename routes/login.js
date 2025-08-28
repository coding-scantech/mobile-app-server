import express from "express"
import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"
import { Client } from "../models/Client.js"

const router = express.Router()

// Helper to fetch and parse XML
async function fetchXml(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  })
  const text = await response.text()
  return parseStringPromise(text)
}

router.post("/", async (req, res) => {
  const { account, pwd } = req.body

  if (!account || !pwd) {
    return res.status(400).json({ error: "Account and Password required" })
  }

  try {
    // 1. Authenticate with remote service
    const xml = await fetchXml(
      `${process.env.BASE_URL}AndroidInterface.asmx/UserLoginNew`,
      { account, pwd }
    )

    // xml is parsed object like { string: { _: "0#23,fuel testing" } }
    const raw = xml?.string?._ || ""
    const [status, details] = raw.split("#")

    if (status !== "0") {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const [userId, name] = details.split(",")

    // 2. Check if Client collection exists
    let client = await Client.findOne({ email: account, pwd })

    if (!client) {
      // Create new if not exists
      client = new Client({
        pwd,
        email: account,
        name,
      })

      await client.save()
    }

    // 3. Return id + email
    return res.json({
      id: client._id,
      email: client.email,
      fcm_tokens: client.fcm_tokens,
      name: client.name,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: "Server error" })
  }
})

export default router
