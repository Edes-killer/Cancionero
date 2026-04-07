export default function Home() {
  return (
    <div style={container}>
      <h1>Cancionero Iglesia</h1>

      <div style={menu}>
        <a href="/control">🎮 Control</a>
        <a href="/proyectar">📺 Proyectar</a>
        <a href="/canciones">🎵 Canciones</a>
      </div>
    </div>
  )
}

const container = {
  height: "100vh",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "center",
  alignItems: "center",
  background: "#111",
  color: "#fff"
}

const menu = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "20px",
  marginTop: "20px"
}