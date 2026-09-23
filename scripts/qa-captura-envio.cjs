// Captura real MediaRecorder de lienzo/audio sintéticos. Sin cámara, cuenta o red externa.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { spawn } = require('node:child_process')
const segundos = Number(process.argv[2] || 60)
if (!Number.isFinite(segundos) || segundos < 10 || segundos > 1800) throw Error('Duración: 10–1800 segundos')
if (!process.versions.electron) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const p = spawn(require('electron'), [__filename, String(segundos)], { env, stdio:'inherit', windowsHide:true })
  const timeout = setTimeout(() => p.kill(), (segundos+90)*1000)
  p.on('error', e => { console.error(e); clearTimeout(timeout); process.exitCode=1 })
  p.on('exit', c => { clearTimeout(timeout); process.exitCode=c ?? 1 })
} else {
  const { app, BrowserWindow, ipcMain } = require('electron')
  const { escribirFragmento } = require('../electron/escritura-transmision')
  const { DiagnosticoTransmision } = require('../electron/diagnostico-transmision')
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'selah-captura-qa-')))
  app.whenReady().then(async () => {
    const sockets = new Set(); let bytes = 0, proc, win, timer, progreso
    const servidor = require('node:net').createServer(s => { sockets.add(s); s.on('data',b=>bytes+=b.length); s.on('error',()=>{}); s.on('close',()=>sockets.delete(s)) })
    try {
      await new Promise(r=>servidor.listen(0,'127.0.0.1',r))
      const fuente = fs.readFileSync(path.join(__dirname,'../electron/main.js'),'utf8')
      const inicio = fuente.indexOf('function construirArgsFFmpeg('), fin = fuente.indexOf('\nfunction rutaLogTransmision',inicio)
      if (inicio<0 || fin<0) throw Error('No se encontró constructor FFmpeg')
      const construir = new Function(fuente.slice(inicio,fin)+';return construirArgsFFmpeg;')()
      const d = new DiagnosticoTransmision(); let log = ''
      proc = spawn(require('ffmpeg-static'),construir('h264_mf',[`tcp://127.0.0.1:${servidor.address().port}`],6000),{windowsHide:true,stdio:['pipe','ignore','pipe']})
      const terminado = new Promise(r=>{proc.on('error',()=>r(-1));proc.on('close',r)})
      proc.stdin.on('error',()=>{})
      proc.stderr.on('data',b=>{d.stderr(b.toString());log=(log+b.toString()).slice(-6000)})
      timer=setTimeout(()=>proc.kill(),(segundos+60)*1000)
      progreso=setInterval(()=>console.log(JSON.stringify(d.estado(proc.stdin.writableLength,true))),15000)
      win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'qa-captura-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}})
      ipcMain.handle('qa:fragmento',async(e,b)=>{
        if(e.sender!==win.webContents) throw Error('Emisor inválido')
        d.chunk(b.length); await escribirFragmento(proc.stdin,Buffer.from(b),30000,()=>d.cuadros)
      })
      await win.loadURL('data:text/html,<title>QA captura local</title>')
      const colaJS=require('typescript').transpileModule(fs.readFileSync(path.join(__dirname,'../lib/colaTransmision.ts'),'utf8'),{compilerOptions:{module:1,target:7}}).outputText
      const captura=await win.webContents.executeJavaScript(`(async()=>{
        const exports={}; ${colaJS}
        const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;document.body.appendChild(canvas);
        const ctx=canvas.getContext('2d');let n=0;
        const pintar=()=>{ctx.fillStyle=n%2?'#172238':'#132034';ctx.fillRect(0,0,1920,1080);ctx.fillStyle='white';ctx.font='64px sans-serif';ctx.fillText(n<300?'ESPERA':'CAMARA SINTETICA',80,120);ctx.fillRect((n++*12)%1800,300,100,100)};
        pintar();const tick=setInterval(pintar,1000/30);
        const ac=new AudioContext({sampleRate:48000});await ac.resume();const os=ac.createOscillator(),gain=ac.createGain(),dest=ac.createMediaStreamDestination();
        gain.gain.value=0;os.connect(gain);gain.connect(dest);os.start();const cambio=setTimeout(()=>gain.gain.value=.1,10000);
        const video=canvas.captureStream(30),stream=new MediaStream([...video.getVideoTracks(),...dest.stream.getAudioTracks()]);
        const mime='video/x-matroska;codecs=avc1,opus';if(!MediaRecorder.isTypeSupported(mime))throw Error('Formato H264/Opus no disponible');
        const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000,audioBitsPerSecond:256000});
        let fallo=null;const cola=new exports.ColaTransmision(e=>fallo=e);
        rec.ondataavailable=e=>{if(e.data.size)cola.agregar(e.data.size,async()=>window.qaCaptura.enviar(new Uint8Array(await e.data.arrayBuffer())))};
        try {rec.start(250);await new Promise(r=>setTimeout(r,${segundos*1000}));await new Promise(r=>{rec.onstop=r;rec.stop()});await cola.terminar();if(fallo)throw Error(fallo);return {mime,cuadrosDibujados:n}}
        finally {if(rec.state!=='inactive')rec.stop();clearInterval(tick);clearTimeout(cambio);stream.getTracks().forEach(t=>t.stop());os.stop();await ac.close()}
      })()`)
      proc.stdin.end();const code=await terminado;d.stderr('\n')
      const ok=code===0&&d.dts===0&&d.cuadros>=segundos*28&&bytes>0
      console.log(JSON.stringify({ok,segundos,...captura,code,cuadrosSalida:d.cuadros,avisosTiempo:d.dts,bytesRecibidos:bytes}))
      if(!ok){console.error(log);process.exitCode=1}
    }catch(e){console.error(e);process.exitCode=1}
    finally{clearTimeout(timer);clearInterval(progreso);ipcMain.removeHandler('qa:fragmento');if(proc)proc.kill();if(win&&!win.isDestroyed())win.destroy();sockets.forEach(s=>s.destroy());await new Promise(r=>servidor.close(r));app.exit(process.exitCode||0)}
  })
}
