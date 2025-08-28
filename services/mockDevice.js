import dgram from "dgram"

// Server details
const UDP_HOST = "127.0.0.1" // Change to your server's IP if remote
const UDP_PORT = 5000 // Must match your server's UDP_PORT

// Create UDP client socket
const client = dgram.createSocket("udp4")

// Helper function to generate random telemetry
function generatePacket() {
  return {
    speed: (Math.random() * 120).toFixed(1), // km/h
    lat: (Math.random() * 180 - 90).toFixed(6), // -90 to 90
    lng: (Math.random() * 360 - 180).toFixed(6), // -180 to 180
    alert: Math.random() > 0.8 ? "Overspeed" : "Normal",
    fuel: (Math.random() * 200).toFixed(1), // L
    serial: "SN-" + Math.floor(Math.random() * 10000),
    acc: Math.random() > 0.5 ? 1 : 0, // 1 = ON, 0 = OFF
  }
}

// Send a packet every 10 seconds
setInterval(() => {
  const packet = generatePacket()
  const message = Buffer.from(JSON.stringify(packet))

  client.send(message, UDP_PORT, UDP_HOST, (err) => {
    if (err) {
      console.error("❌ Error sending packet:", err)
    } else {
      console.log("📤 Sent packet:", packet)
    }
  })
}, 10000) // 10 seconds
