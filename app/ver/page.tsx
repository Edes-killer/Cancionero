"use client"

// Página pública del ESPECTADOR de la "emisión directa" (link propio en la red).
// Se conecta al servidor de Electron por Socket.IO, pide unirse a la emisión y
// recibe el video+audio por WebRTC directo desde el PC (una RTCPeerConnection por
// espectador). No requiere login: la abre cualquiera en la misma red WiFi.

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { getSocketUrl } from "@/lib/servidor"

type Estado = "conectando" | "esperando" | "en-vivo" | "finalizada" | "sin-emision"

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }

export default function Ver() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const emisorRef = useRef<string | null>(null)
  const [estado, setEstado] = useState<Estado>("conectando")
  const [tocar, setTocar] = useState(false)

  useEffect(() => {
    const socket = io(getSocketUrl(), { transports: ["websocket", "polling"], forceNew: true })
    socketRef.current = socket

    const cerrarPC = () => { try { pcRef.current?.close() } catch {} pcRef.current = null }

    const unirse = () => {
      setEstado("conectando")
      socket.emit("emision:ver", {}, (res: { ok?: boolean } = {}) => {
        setEstado(res?.ok ? "esperando" : "sin-emision")
      })
    }

    socket.on("connect", unirse)
    socket.on("disconnect", () => cerrarPC())

    socket.on("emision:senal", async ({ data, de }: { data?: any; de?: string } = {}) => {
      if (!data) return
      if (data.tipo === "offer") {
        emisorRef.current = de || null
        cerrarPC()
        const pc = new RTCPeerConnection(ICE)
        pcRef.current = pc
        pc.ontrack = ev => {
          if (videoRef.current && ev.streams[0]) {
            videoRef.current.srcObject = ev.streams[0]
            setEstado("en-vivo")
            videoRef.current.play().catch(() => setTocar(true))
          }
        }
        pc.onicecandidate = ev => {
          if (ev.candidate && emisorRef.current)
            socket.emit("emision:senal", { para: emisorRef.current, data: { tipo: "ice", candidate: ev.candidate } })
        }
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState
          if (s === "failed" || s === "disconnected") setEstado("esperando")
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit("emision:senal", { para: de, data: { tipo: "answer", sdp: pc.localDescription } })
      } else if (data.tipo === "ice" && pcRef.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)) } catch {}
      }
    })

    socket.on("emision:fin", () => { cerrarPC(); setEstado("finalizada") })

    return () => { cerrarPC(); socket.disconnect() }
  }, [])

  const reproducir = () => {
    setTocar(false)
    videoRef.current?.play().catch(() => setTocar(true))
  }

  const reintentar = () => {
    setEstado("conectando")
    socketRef.current?.emit("emision:ver", {}, (res: { ok?: boolean } = {}) => {
      setEstado(res?.ok ? "esperando" : "sin-emision")
    })
  }

  const mostrarVideo = estado === "en-vivo"

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex",
      alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <video
        ref={videoRef}
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain",
          display: mostrarVideo ? "block" : "none", background: "#000" }}
      />

      {mostrarVideo && (
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center",
          gap: 7, background: "rgba(0,0,0,.5)", padding: "5px 11px", borderRadius: 999,
          fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: .3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#ef4444",
            boxShadow: "0 0 0 0 rgba(239,68,68,.7)", animation: "vivoPulso 1.6s infinite" }} />
          EN VIVO
        </div>
      )}

      {tocar && mostrarVideo && (
        <button type="button" onClick={reproducir}
          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", border: "none",
            color: "#fff", display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 14, cursor: "pointer" }}>
          <span style={{ fontSize: 64 }}>▶</span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Toca para ver y escuchar</span>
        </button>
      )}

      {!mostrarVideo && (
        <div style={{ textAlign: "center", color: "#e5e7eb", padding: 24, maxWidth: 340 }}>
          {estado === "conectando" && (<>
            <div style={{ fontSize: 40, marginBottom: 14, animation: "vivoGiro 1.1s linear infinite" }}>◠</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Conectando…</div>
          </>)}
          {estado === "esperando" && (<>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Esperando la transmisión</div>
            <div style={{ fontSize: 13.5, opacity: .6 }}>La emisión empezará en un momento. Deja esta página abierta.</div>
          </>)}
          {estado === "sin-emision" && (<>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔌</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>No hay transmisión ahora</div>
            <div style={{ fontSize: 13.5, opacity: .6, marginBottom: 18 }}>Aún no comienza o ya terminó. Prueba de nuevo en unos segundos.</div>
            <button type="button" onClick={reintentar}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #334155",
                background: "#1e293b", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Reintentar
            </button>
          </>)}
          {estado === "finalizada" && (<>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🙏</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>La transmisión terminó</div>
            <div style={{ fontSize: 13.5, opacity: .6, marginBottom: 18 }}>Gracias por acompañarnos.</div>
            <button type="button" onClick={reintentar}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #334155",
                background: "#1e293b", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Ver de nuevo
            </button>
          </>)}
        </div>
      )}

      <style>{`
        @keyframes vivoPulso { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)} 70%{box-shadow:0 0 0 7px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        @keyframes vivoGiro { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
