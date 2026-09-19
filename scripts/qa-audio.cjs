// Prueba el motor real de Web Audio de Electron sin abrir cámara ni micrófono.
const fs = require("node:fs")
const path = require("node:path")

if (!process.versions.electron) {
  const { spawn } = require("node:child_process")
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const proceso = spawn(require("electron"), [__filename], { env, stdio:"inherit", windowsHide:true })
  const limite = setTimeout(() => { proceso.kill(); process.exitCode = 1 }, 55000)
  proceso.on("error", error => { clearTimeout(limite); console.error(error.message); process.exitCode = 1 })
  proceso.on("exit", codigo => { clearTimeout(limite); process.exitCode = codigo ?? 1 })
} else {
  const { app, BrowserWindow } = require("electron")
  app.setPath("userData", fs.mkdtempSync(path.join(require("node:os").tmpdir(), "selah-audio-qa-")))
  app.disableHardwareAcceleration()
  app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show:false, webPreferences:{ sandbox:true, contextIsolation:true, nodeIntegration:false } })
    ventana.webContents.on("console-message", evento => console.log(evento.message))
    try {
      const ts = require("typescript")
      const fuente = fs.readFileSync(path.join(__dirname, "../lib/audioEmision.ts"), "utf8")
      const compilado = ts.transpileModule(fuente, { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020 } }).outputText
      await ventana.loadURL("data:text/html," + encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'"><title>Prueba de audio Selah</title>'))
      const resultado = await ventana.webContents.executeJavaScript(`(async () => {
        const exports = {};
        ${compilado}
        const pruebas = [];
        const validar = (nombre, ok, detalle) => pruebas.push({ nombre, ok, detalle });
        const generar = async (volumen, retardo, silencio) => {
          const ctx = new OfflineAudioContext(1, 48000 * 2, 48000);
          const motor = crearCadenaAudioEmision(ctx);
          ajustarAudioEmision(motor, ctx, volumen, retardo, silencio);
          const fuente = ctx.createOscillator(); fuente.frequency.value = 440;
          const nivel = ctx.createGain(); nivel.gain.value = 0.9;
          fuente.connect(nivel); nivel.connect(motor.entrada); motor.salida.connect(ctx.destination);
          fuente.start(0.25); fuente.stop(1.5);
          const datos = (await ctx.startRendering()).getChannelData(0);
          return { datos, motor };
        };
        const base = await generar(100, 0, false);
        const retrasado = await generar(100, 200, false);
        const inicio = datos => datos.findIndex(v => Math.abs(v) > 0.01) / 48000;
        const diferencia = inicio(retrasado.datos) - inicio(base.datos);
        validar("200 ms de retraso efectivo", Math.abs(diferencia - 0.2) < 0.005, diferencia);
        const mudo = await generar(100, 500, true);
        validar("Espera silencia incluso con audio retrasado", mudo.datos.every(v => v === 0));
        const cero = await generar(0, 0, false);
        validar("Volumen 0 silencia la salida", medirAudio(cero.datos.slice(24000)).picoDb < -80);
        const fuerte = await generar(150, 0, false);
        const pico = medirAudio(fuerte.datos.slice(24000, 60000)).picoDb;
        validar("La protección comprime los picos de una señal fuerte", pico < 20 * Math.log10(1.35) - 2, pico);
        validar("La medición reconoce silencio y amplitud", medirAudio(new Float32Array([0,0])).picoDb === -96 && Math.abs(medirAudio(new Float32Array([0.5,-0.5])).picoDb + 6.0206) < 0.001);
        const ctx = new OfflineAudioContext(1, 48000, 48000);
        const motor = crearCadenaAudioEmision(ctx);
        ajustarAudioEmision(motor, ctx, NaN, Infinity, true);
        const tono = ctx.createOscillator(); tono.connect(motor.entrada); motor.salida.connect(ctx.destination); tono.start();
        const corrupto = (await ctx.startRendering()).getChannelData(0);
        validar("Valores corruptos no rompen el silencio", corrupto.every(v => v === 0));
        const probarMonitor = async activo => {
          const ctx = new OfflineAudioContext(2, 48000, 48000);
          const motor = crearCadenaAudioEmision(ctx);
          const mezcla = ctx.createChannelMerger(2);
          motor.salida.connect(mezcla, 0, 0);
          motor.monitor.gain.value = activo ? 0.65 : 0;
          motor.monitor.connect(mezcla, 0, 1);
          mezcla.connect(ctx.destination);
          const tono = ctx.createOscillator(); tono.connect(motor.entrada); tono.start();
          const render = await ctx.startRendering();
          return [render.getChannelData(0), render.getChannelData(1)];
        };
        const sinMonitor = await probarMonitor(false), conMonitor = await probarMonitor(true);
        validar("Monitoreo apagado no suena y al activarlo no cambia la emisión", sinMonitor[1].every(v => v === 0) && conMonitor[1].some(v => Math.abs(v) > 0.01) && sinMonitor[0].every((v,i) => Math.abs(v - conMonitor[0][i]) < 0.00001));
        return pruebas;
      })()`)
      for (const prueba of resultado) console.log(`${prueba.ok ? "OK" : "FALLO"}: ${prueba.nombre}${prueba.detalle !== undefined ? ` (${prueba.detalle})` : ""}`)
      // Ejecutar el componente real con cámara de canvas y tono sintético.
      // La ventana permanece oculta y el tono nunca se conecta a los parlantes.
      const panel = new BrowserWindow({ show:false, webPreferences:{ sandbox:false, nodeIntegration:true, contextIsolation:false, backgroundThrottling:false } })
      await panel.loadURL("data:text/html," + encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\'; media-src blob:"><div id="root"></div>'))
      const ui = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../components/transmision/PanelAudioProfesional.tsx"), "utf8"), { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText
      const pruebaUI = await panel.webContents.executeJavaScript(`(async () => {
        const cargar = require('node:module').createRequire(${JSON.stringify(__filename)});
        const requireUI = nombre => nombre === '@/lib/Errorlogger' ? { logCatch: e => console.error(e) } : cargar(nombre);
        const modulo = { exports: {} };
        ((require, exports) => { ${ui} })(requireUI, modulo.exports);
        const React = cargar('react'), { createRoot } = cargar('react-dom/client');
        const ctx = new AudioContext(); await ctx.resume();
        const destino = ctx.createMediaStreamDestination(), tono = ctx.createOscillator();
        tono.connect(destino); tono.start();
        const audio = destino.stream.getAudioTracks()[0];
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
        const dibujo = canvas.getContext('2d');
        const pintar = setInterval(() => { dibujo.fillStyle = Date.now() % 2 ? 'blue' : 'green'; dibujo.fillRect(0,0,320,180); }, 50);
        let video;
        const crearStream = () => { video = canvas.captureStream(20).getVideoTracks()[0]; return new MediaStream([video, audio]); };
        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(modulo.exports.default, {
          leerMedicion: () => ({entradaDb:-12,salidaDb:-12,reduccionDb:0,saturado:false}),
          monitor:false,cambiarMonitor:()=>{},retardoMs:0,cambiarRetardo:()=>{},
          crearStream,bloqueado:false,micNombre:'Micrófono de prueba',enEspera:false,
        }));
        const pausa = ms => new Promise(r => setTimeout(r, ms));
        await pausa(250);
        document.querySelector('details').open = true;
        const boton = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Grabar prueba'));
        boton.click(); await pausa(9200);
        const clip = document.querySelector('video');
        const generado = !!clip?.src?.startsWith('blob:') && clip.paused;
        const conservado = audio.readyState === 'live' && video.readyState === 'ended';
        boton.click(); await pausa(250); root.unmount();
        const cancelado = audio.readyState === 'live' && video.readyState === 'ended';
        clearInterval(pintar); tono.stop(); audio.stop(); await ctx.close();
        return { generado, conservado, cancelado };
      })()`)
      console.log(`Prueba de interfaz: ${JSON.stringify(pruebaUI)}`)
      app.exit(resultado.every(p => p.ok) && Object.values(pruebaUI).every(Boolean) ? 0 : 1)
    } catch (error) { console.error(error); app.exit(1) }
  })
}
