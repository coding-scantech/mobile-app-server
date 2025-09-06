import express from "express"

const router = express.Router()

function generateFuelData(from, to, intervalSec = 30) {
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  const timestamps = []
  const values = []

  let current = start

  while (current <= end) {
    timestamps.push(new Date(current).toISOString())

    // random value between 0 and 100
    const fuel = Math.random() * 100

    values.push(Number(fuel.toFixed(2)))
    current += intervalSec * 1000
  }

  return { timestamps, values }
}

// Route: GET /fuel?vehicleId=123&from=2025-09-01T00:00:00Z&to=2025-09-07T00:00:00Z
router.get("/", (req, res) => {
  const { from, to, vehicleId } = req.query

  if (!from || !to) {
    return res.status(400).json({ error: "from and to query params required" })
  }

  const data = generateFuelData(from, to)
  res.json({ vehicleId, ...data })
})

export default router
