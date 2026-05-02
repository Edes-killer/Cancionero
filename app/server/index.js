const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")
let estadoActual = null
try {
  const data = fs.readFileSync("estado.json", "utf-8")
  estadoActual = JSON.parse(data)
  console.log("♻️ estado restaurado")
} catch {
  console.log("⚠️ sin estado previo")
}
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

  estadoActual = {
    tipo: "cancion",
    data
  }
  fs.writeFileSync("estado.json", JSON.stringify(estadoActual))
  io.emit("cargar-cancion", data)
})

  socket.on("cambiar-parte", (index) => {
  console.log("➡️ parte:", index)

  if (estadoActual && estadoActual.tipo === "cancion") {
    estadoActual.data.index = index
  }

  io.emit("cambiar-parte", index)
})

  socket.on("cancion-activa", (data) => {
  console.log("🟢 canción activa:", data)
  io.emit("cancion-activa", data)
})

  socket.on("mostrar-imagen", (data) => {
    console.log("🖼️ imagen recibida:", data)
    estadoActual = {
      tipo: "imagen",
      data
    }
    fs.writeFileSync("estado.json", JSON.stringify(estadoActual))
    io.emit("mostrar-imagen", data)
  })

  socket.on("mostrar-biblia", (data) => {
    console.log("📖 Biblia recibida:", data)
    estadoActual = {
      tipo: "biblia",
      data
    }
    fs.writeFileSync("estado.json", JSON.stringify(estadoActual))
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

  socket.on("precargar-imagenes", (urls) => {
  io.emit("precargar-imagenes", urls)
  })

  socket.on("mostrar-estado", (data) => {
  io.emit("mostrar-estado", data)
})
  socket.on("get-estado", () => {
  if (estadoActual) {
    socket.emit("estado-actual", estadoActual)
  }
})
})

server.listen(4000, "0.0.0.0", () => {
  console.log("🔥 Servidor en 4000")
})