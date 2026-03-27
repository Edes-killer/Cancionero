const http = require("http")
const { Server } = require("socket.io")

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end("Servidor activo")
})

const io = new Server(server, {
  cors: {
    origin: "*",
  },
})

io.on("connection", (socket) => {
  console.log("📱 Cliente conectado:", socket.id)
  socket.on("cargar-cancion", (data) => {
    console.log("🎵 canción recibida",data)
    io.emit("cargar-cancion", data)
  })

  socket.on("cambiar-parte", (index) => {
    io.emit("cambiar-parte", index)
  })
})


server.listen(4000, "0.0.0.0", () => {
  console.log("🔥 Servidor en 4000")
})
