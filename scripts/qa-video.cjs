// Video sintético WebRTC entre dos peers locales: no cámara, micrófono ni STUN externo.
const fs = require('node:fs')
const path = require('node:path')
if (!process.versions.electron) {
  const { spawn } = require('node:child_process')
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const p = spawn(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true })
  const limite = setTimeout(() => { p.kill(); process.exitCode = 1 }, 55000)
  p.on('error', e => { clearTimeout(limite); console.error(e.message); process.exitCode = 1 })
  p.on('exit', code => { clearTimeout(limite); process.exitCode = code ?? 1 })
} else {
  const { app, BrowserWindow } = require('electron')
  app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'selah-video-qa-')))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    try {
      const ts = require('typescript')
      const fuente = fs.readFileSync(path.join(__dirname, '../lib/calidadAdaptativa.ts'), 'utf8')
      const compilado = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
      await win.loadURL('data:text/html,<title>QA WebRTC Selah</title>')
      const resultado = await win.webContents.executeJavaScript(`(async () => {
        const exports = {}; ${compilado}
        const a = new RTCPeerConnection({ iceServers: [] }), b = new RTCPeerConnection({ iceServers: [] });
        const visor = document.createElement('video'); visor.autoplay = true; visor.muted = true; document.body.appendChild(visor);
        b.ontrack = e => { visor.srcObject = e.streams[0]; void visor.play(); };
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext('2d'); let n = 0;
        const dibujar = () => { ctx.fillStyle = n++ % 2 ? '#224488' : '#448822'; ctx.fillRect(0,0,1280,720); };
        dibujar(); const timer = setInterval(dibujar, 33);
        const stream = canvas.captureStream(30); const pista = stream.getVideoTracks()[0];
        const sender = a.addTrack(pista, stream);
        const iceA = [], iceB = [];
        a.onicecandidate = e => { if(e.candidate) { if(b.remoteDescription) void b.addIceCandidate(e.candidate); else iceB.push(e.candidate); } };
        b.onicecandidate = e => { if(e.candidate) { if(a.remoteDescription) void a.addIceCandidate(e.candidate); else iceA.push(e.candidate); } };
        let negociaciones = 0; a.onnegotiationneeded = () => negociaciones++;
        const pausa = ms => new Promise(r => setTimeout(r, ms));
        const esperar = async (predicado, etiqueta) => { for(let i=0;i<80;i++){ if(await predicado()) return; await pausa(100); } const stats = await b.getStats(); throw new Error(etiqueta+' '+JSON.stringify({estado:a.connectionState,video:[...stats.values()].filter(s=>s.type==='inbound-rtp')})); };
        const ancho = async () => { const stats = await b.getStats(); for(const s of stats.values()) if(s.type==='inbound-rtp' && s.kind==='video') return s.frameWidth; return 0; };
        try {
          // Aislar el escalado explícito de la adaptación interna de Chromium en este laboratorio.
          const inicio = sender.getParameters(); inicio.encodings = inicio.encodings.length ? inicio.encodings : [{}]; inicio.encodings[0].maxBitrate = 8000000; inicio.degradationPreference = 'maintain-resolution'; await sender.setParameters(inicio);
          await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription);
          for(const c of iceB) await b.addIceCandidate(c);
          await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription);
          for(const c of iceA) await a.addIceCandidate(c);
          await esperar(async () => a.connectionState==='connected' && await ancho()===1280, 'No llegó video inicial');
          const inicial = negociaciones;
          const ajustar = async nivel => { const p = sender.getParameters(); const perfil = exports.PERFILES_ENVIO[nivel]; p.encodings[0].scaleResolutionDownBy=perfil.escala; p.encodings[0].maxBitrate=perfil.bitrate; p.encodings[0].maxFramerate=30; await sender.setParameters(p); };
          await ajustar(2); await esperar(async () => await ancho()===640, 'No redujo resolución recibida');
          await ajustar(0); await esperar(async () => await ancho()===1280, 'No recuperó resolución recibida');
          if(sender.track!==pista || pista.readyState!=='live' || a.connectionState!=='connected' || negociaciones!==inicial) throw new Error('Se reinició la fuente o negociación');
          return { ok:true, detalle:'1280 → 640 → 1280 recibidos; misma pista y conexión, sin renegociar' };
        } finally { clearInterval(timer); stream.getTracks().forEach(t=>t.stop()); a.close(); b.close(); }
      })()`)
      console.log(JSON.stringify(resultado))
      app.exit(resultado.ok ? 0 : 1)
    } catch (e) { console.error(e.message); app.exit(1) }
  })
}
