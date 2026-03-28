import Link from "next/link"

export default function Home() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Cancionero Iglesia</h1>

      <ul>
        <li>
          <Link href="/canciones">Ir a Canciones</Link>
        </li>
        <li>
          <Link href="/proyectar">Modo Proyector</Link>
        </li>
      </ul>
    </div>
  )
}