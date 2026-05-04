const http = require("http")
const { Server } = require("socket.io")
const fs = require("fs")

let estadosPorSala = {}

try {
  const data = fs.readFileSync("estado.json", "utf-8")
  const parsed = JSON.parse(data)

  // Compatibilidad con estado viejo: { tipo, data }
  if (parsed?.tipo && parsed?.data) {
    estadosPorSala = {
      global: parsed
    }
  } else {
    estadosPorSala = parsed || {}
  }

  console.log("♻️ estados restaurados:", Object.keys(estadosPorSala))
} catch {
  console.log("⚠️ sin estado previo")
}

const guardarEstados = () => {
  fs.promises
    .writeFile("estado.json", JSON.stringify(estadosPorSala, null, 2))
    .catch((error) => {
      console.error("❌ Error guardando estados:", error)
    })
}

const salaDe = (socket) => {
  return socket.data?.sala || "global"
}

const guardarEstadoSala = (sala, estado) => {
  estadosPorSala[sala] = estado
  guardarEstados()
}

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end("Servidor activo")
})

const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

io.on("connection", (socket) => {
  console.log("📱 Cliente conectado:", socket.id)

  socket.on("unirse-sala", ({ sala }) => {
    const salaFinal = sala || "global"

    socket.data.sala = salaFinal
    socket.join(salaFinal)

    console.log(`🏠 ${socket.id} unido a sala: ${salaFinal}`)
  })

  socket.on("cargar-cancion", (data) => {
    const sala = salaDe(socket)

    console.log("🎵 canción recibida", {
      sala,
      titulo: data?.titulo
    })

    guardarEstadoSala(sala, {
      tipo: "cancion",
      data: {
        ...data,
        index: data.index || 0
      }
    })

    io.to(sala).emit("cargar-cancion", data)
  })

  socket.on("cambiar-parte", (index) => {
    const sala = salaDe(socket)

    console.log("➡️ cambiar parte:", {
      sala,
      index
    })

    const estadoActual = estadosPorSala[sala]

    if (estadoActual && estadoActual.tipo === "cancion") {
      estadoActual.data.index = index
      guardarEstadoSala(sala, estadoActual)
    }

    io.to(sala).emit("cambiar-parte", index)
  })

  socket.on("cancion-activa", (data) => {
    const sala = salaDe(socket)

    console.log("🟢 canción activa:", {
      sala,
      data
    })

    io.to(sala).emit("cancion-activa", data)
  })

  socket.on("mostrar-imagen", (data) => {
    const sala = salaDe(socket)

    console.log("🖼️ imagen recibida:", {
      sala,
      url: data?.url
    })

    guardarEstadoSala(sala, {
      tipo: "imagen",
      data
    })

    io.to(sala).emit("mostrar-imagen", data)
  })

  socket.on("mostrar-biblia", (data) => {
    const sala = salaDe(socket)

    console.log("📖 Biblia recibida:", {
      sala,
      referencia: data?.referencia
    })

    guardarEstadoSala(sala, {
      tipo: "biblia",
      data: {
        ...data,
        pagina: data.pagina || 0
      }
    })

    io.to(sala).emit("mostrar-biblia", data)
  })

  socket.on("cambiar-pagina-biblia", (pagina) => {
    const sala = salaDe(socket)

    console.log("📖 cambiar página biblia:", {
      sala,
      pagina
    })

    const estadoActual = estadosPorSala[sala]

    if (estadoActual && estadoActual.tipo === "biblia") {
      estadoActual.data.pagina = pagina
      guardarEstadoSala(sala, estadoActual)
    }

    io.to(sala).emit("cambiar-pagina-biblia", pagina)
  })

  socket.on("mostrar-estado", (data) => {
    const sala = salaDe(socket)

    console.log("🟡 estado especial recibido:", {
      sala,
      tipo: data?.tipo
    })

    guardarEstadoSala(sala, {
      tipo: "estado",
      data
    })

    io.to(sala).emit("mostrar-estado", data)
  })

  socket.on("control-siguiente", () => {
    const sala = salaDe(socket)

    console.log("➡️ control siguiente pedido por:", {
      sala,
      socket: socket.id
    })

    socket.broadcast.to(sala).emit("control-siguiente")
  })

  socket.on("control-anterior", () => {
    const sala = salaDe(socket)

    console.log("⬅️ control anterior pedido por:", {
      sala,
      socket: socket.id
    })

    socket.broadcast.to(sala).emit("control-anterior")
  })

  socket.on("precargar-imagenes", (urls) => {
    const sala = salaDe(socket)
    io.to(sala).emit("precargar-imagenes", urls)
  })

  socket.on("get-estado", () => {
    const sala = salaDe(socket)
    const estadoActual = estadosPorSala[sala]

    console.log("📡 cliente pidió estado actual:", sala)

    if (estadoActual) {
      console.log("📤 enviando estado actual:", {
        sala,
        tipo: estadoActual.tipo
      })

      socket.emit("estado-actual", estadoActual)
    } else {
      console.log("⚪ no hay estado guardado para sala:", sala)
    }
  })

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id)
  })
})

const PORT = process.env.PORT || 4000

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Servidor en ${PORT}`)
})