// Utilidades WebRTC compartidas.

// Mejora el audio opus del SDP para MÚSICA: estéreo + bitrate alto + FEC.
// Por defecto opus negocia mono a ~32 kbps (pensado para voz), que suena
// comprimido con cantos/instrumentos. Añadimos los parámetros a la línea
// a=fmtp del opus (48000/2). Se aplica tanto en la oferta (emisor, con
// sprop-stereo=1 = "voy a mandar estéreo") como en la respuesta (espectador,
// con stereo=1 = "quiero recibir estéreo").
export function opusHiFi(sdp: string, kbps = 256): string {
  if (!sdp) return sdp
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i)
  if (!m) return sdp
  const pt = m[1]
  const extra: Record<string, string> = {
    stereo: "1",
    "sprop-stereo": "1",
    maxaveragebitrate: String(kbps * 1000),
    maxplaybackrate: "48000",
    useinbandfec: "1",
  }
  const fmtpRe = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`)
  if (fmtpRe.test(sdp)) {
    return sdp.replace(fmtpRe, (_full, params: string) => {
      let p = params
      for (const [k, v] of Object.entries(extra)) {
        if (new RegExp(`(^|;)\\s*${k}=`).test(p)) p = p.replace(new RegExp(`${k}=[^;]*`), `${k}=${v}`)
        else p += `;${k}=${v}`
      }
      return `a=fmtp:${pt} ${p}`
    })
  }
  // Sin línea fmtp previa: crearla justo tras el rtpmap del opus.
  const nueva = Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(";")
  return sdp.replace(m[0], `${m[0]}\r\na=fmtp:${pt} ${nueva}`)
}

// Sube el bitrate del track de audio de un sender (además del SDP).
export async function subirBitrateAudio(pc: RTCPeerConnection, kbps = 256): Promise<void> {
  const sender = pc.getSenders().find(s => s.track?.kind === "audio")
  if (!sender) return
  try {
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) (params as any).encodings = [{}]
    params.encodings[0].maxBitrate = kbps * 1000
    await sender.setParameters(params)
  } catch { /* algunos navegadores no lo permiten; el SDP ya ayuda */ }
}
