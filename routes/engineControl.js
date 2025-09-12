import express from "express"
import { client, waitForResponse } from "../udp-listener.js" // <-- import waitForResponse
import dotenv from "dotenv"
import { Client } from "../models/Client.js"

dotenv.config()

const SERVER_HOST = process.env.SERVER_HOST
const SERVER_PORT = process.env.SERVER_PORT

const router = express.Router()

function getCurrentTimeHHMMSS() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")
  return `${hours}${minutes}${seconds}`
}

router.get("/", async (req, res) => {
  try {
    const { status, deviceId } = req.query

    if (!deviceId || !status) {
      return res
        .status(400)
        .json({ error: "deviceId and status query params required" })
    }

    // build command buffer
    const buf = Buffer.alloc(66)
    buf.writeInt16LE(66, 0)
    buf.writeInt16LE(6, 2)
    buf.write(deviceId, 4, 12, "ascii")
    const cmdString =
      status === "ON"
        ? `*KW,${deviceId},007,${getCurrentTimeHHMMSS()},1#`
        : `*KW,${deviceId},007,${getCurrentTimeHHMMSS()},0#`
    buf.write(cmdString, 16, 50, "ascii")

    // create the pending entry BEFORE sending
    const responsePromise = waitForResponse(deviceId, status, 8000)

    // send UDP packet
    client.send(buf, 0, buf.length, SERVER_PORT, SERVER_HOST, (err) => {
      if (err) {
        console.error("UDP send error:", err)
        // reject pending immediately if send failed
        return res.status(500).json({ error: "Failed to send UDP command" })
      }
      console.log(`Command sent to ${deviceId} status=${status}`)
    })

    // await the resolution (first or combined logic done by udp-listener)
    const result = await responsePromise

    if (result?.success) {
      try {
        // Find the client/vehicle first so we can get number_plate
        const clientDoc = await Client.findOne({
          "vehicles.device_serial": deviceId,
        })

        if (!clientDoc) {
          console.warn(`⚠️ No vehicle found for deviceId ${deviceId}`)
        }

        // Extract the correct vehicle object
        const vehicle = clientDoc.vehicles.find(
          (v) => v.device_serial === deviceId
        )

        const alert = {
          vehId: deviceId,
          alarm: status === "OFF" ? 1 : 0, // 1 = engine cut, 0 = engine restore
          time: Date.now(),
          location: {
            lat: result.second?.fLatitude ?? null,
            lng: result.second?.fLongitude ?? null,
          },
          number_plate: vehicle?.number_plate ?? "",
        }

        const update = {
          $set: {
            "vehicles.$[v].engine_deactivated": status === "OFF",
          },
          $push: {
            alerts: alert,
          },
        }

        const updated = await Client.findOneAndUpdate(
          { "vehicles.device_serial": deviceId }, // still matches the client
          update,
          {
            new: true,
            arrayFilters: [{ "v.device_serial": deviceId }], // ensures we only touch the correct vehicle
          }
        )

        if (updated) {
          console.log(
            `✅ Vehicle ${deviceId} (${
              vehicle?.number_plate
            }) engine_deactivated set to ${status === "OFF"} and alert logged`
          )
        }
      } catch (dbErr) {
        console.error(
          "❌ Failed to update engine_deactivated or log alert:",
          dbErr
        )
      }
    }

    return res.json(result)
  } catch (err) {
    console.error("API error:", err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
