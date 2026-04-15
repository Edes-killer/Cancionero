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
    console.log("🎵 canción recibida", data)
    io.emit("cargar-cancion", data)
  })

  socket.on("cambiar-parte", (index) => {
    io.emit("cambiar-parte", index)
  })

  socket.on("cancion-activa", (data) => {
    console.log("🟢 canción activa:", data)
    io.emit("cancion-activa", data)
  })

  socket.on("mostrar-imagen", (data) => {
    console.log("🖼️ imagen recibida:", data)
    io.emit("mostrar-imagen", data)
  })

  socket.on("mostrar-biblia", (data) => {
    console.log("📖 Biblia recibida:", data)
    io.emit("mostrar-biblia", data)
  })

socket.on("control-siguiente", () => {
  console.log("➡️ control siguiente")
  io.emit("control-siguiente")
})

socket.on("control-anterior", () => {
  console.log("⬅️ control anterior")
  io.emit("control-anterior")
})

socket.on("cambiar-pagina-biblia", (pagina) => {
  console.log("📖 cambiar página biblia:", pagina)
  io.emit("cambiar-pagina-biblia", pagina)
})

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id)
  })
})

server.listen(4000, "0.0.0.0", () => {
  console.log("🔥 Servidor en 4000")
})