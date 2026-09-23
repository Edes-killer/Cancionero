# Diagnóstico rápido de transmisión

Cambio posterior al instalador 0.5.34 publicado. Requiere nuevo escritorio.

En Salir en vivo aparece después del primer inicio: fragmentos recibidos del renderer,
cola pendiente de escritura a FFmpeg (no equivale a su búfer interno ni a la red),
cuadros informados y antigüedad del último avance, avisos de timestamps y rechazo del
destino. Se consulta cada dos segundos; el log conserva un resumen cada diez segundos
y al terminar. Copiar diagnóstico no incluye URLs ni claves. Los logs antiguos pueden
contener claves: la redacción nueva no modifica archivos históricos.

No recibir fragmentos durante ocho segundos tras la gracia inicial apunta al tramo
captura/IPC. Una cola mayor de 4 MiB señala acumulación, sin atribuir causa única.
Doce segundos sin cuadros nuevos tras el arranque indica salida sin avance confirmado.
Los umbrales son alertas operativas, no garantía de recepción/publicación en Facebook.
Multidestino tiene métricas agregadas, no confirmación individual por destino.

La protección de entrada posterior limita la cola del renderer a 8 MiB y la escritura
al pipe a 8 MiB, esperando confirmación antes del siguiente fragmento. Si una escritura
tarda sin progreso treinta segundos o se excede el límite, se detiene ese intento con
error visible SIN reconexión automática por atasco local. La vigilancia se renueva si
los cuadros de FFmpeg o bytes escritos avanzan; no basta una estadística repetida.
Esto reemplaza el timeout fijo de cinco segundos publicado en 0.5.35, que provocó
reinicios repetidos en terreno. La confirmación no significa recepción por Facebook.
Cada intento lleva identidad de sesión y propietario; fragmentos viejos no entran al
nuevo proceso. Las métricas por sí solas no detienen el envío. Se reprodujo y corrigió
un síntoma de timestamps de arranque (ver abajo), no todos los fallos del caso real.
El respaldo local comparte grabador y puede
tener huecos durante reconexiones; no anunciar grabación ininterrumpida.

QA automatizado: captura ausente, cola alta, líneas FFmpeg fragmentadas, frame 793
repetido (caso del culto), rechazo URL, errores de tiempo y redacción de destinos.
QA físico pendiente: iniciar Espera, grabar, cambiar escena, abrir Facebook y repetir
recorrido entre pisos con respaldo local. Copiar diagnóstico y exportar logs al fallo.

Ensayo reproducible: `node scripts/qa-envio-local.cjs 60` (o `900` para 15 minutos).
Genera 1080p30 H264+Opus y usa los argumentos reales del encoder h264_mf contra un
receptor FLV/TCP limitado a 127.0.0.1. No publica, no lee cámaras ni micrófonos.
No sustituye el ensayo MediaRecorder/WebRTC/RTMPS: solo aísla entrada, encoder y salida
local. Exige cuadros esperados, salida recibida y ausencia de avisos de timestamps.

Resultado del ensayo local de 60 s posterior a 0.5.35: 1800 cuadros, 0 avisos de
tiempos, 46 490 883 bytes recibidos, ambos procesos terminaron con código 0. Pendiente
ensayo de 15 minutos y captura real MediaRecorder con cámara/Espera/Facebook.

## Captura MediaRecorder: reproducción y reparación parcial

`npm.cmd run qa:captura -- 60` ejecuta Electron oculto con canvas 1080p30, oscilador
inaudible localmente, diez segundos iniciales de silencio y luego audio, MediaRecorder
H264/Opus a 12 Mbps y chunks de 250 ms, cola e IPC confirmados, FFmpeg h264_mf y
receptor FLV/TCP local. No usa dispositivo real, WebRTC ni RTMPS/Facebook.

Antes del cambio: ensayo 30 s, 900 cuadros y tres advertencias iguales al registro:
AAC backward in time y dos DTS regresivos. Después de aresample se aplica
`asetpts=N/SR/TB`, numeración por muestras descrita en
https://ffmpeg.org/ffmpeg-filters.html#asetpts . No se altera el reloj de video.
Después: ensayo 60 s, 1799 cuadros de salida, cero avisos de tiempos, 19 890 828 bytes
recibidos y proceso terminado con código 0. 118 pruebas de regresión aprobadas.
Esto corrige el síntoma de arranque reproducido; no prueba sincronía labial perfecta
ni explica por sí solo el rendimiento 0.54x de la iglesia.

Ensayo prolongado completado: **900 s, 27 000 cuadros de salida, cero avisos de
timestamps, 308 248 322 bytes recibidos, código 0**. Son 30 cuadros/s de promedio;
el conteo agregado no demuestra que cada intervalo haya sido perfectamente fluido.
No hubo reinicio del proceso. Pendiente validación WebRTC/dispositivos/plataforma.

## Medición de sincronía sintética

`npm.cmd run qa:captura -- 30 --pulsos` alterna negro y destellos blancos de 200 ms
con tonos programados en el mismo reloj AudioContext, cada cinco segundos. Guarda la
salida FLV en un directorio temporal `selah-captura-qa-*` y la decodifica con FFmpeg:
`blackdetect` y `silencedetect` permiten comparar inicios de imagen y sonido.
El resultado incluye diferencias firmadas en ms (positivo: audio posterior al video).
Exige todos los pulsos programados, al menos dos, y desfase absoluto máximo de 200 ms.
El cierre de silencio/negro al final del archivo no se cuenta como pulso.

Ese umbral es una alarma de regresión, no una certificación de sincronía labial ni
una meta de calidad. No incluye captación física, WebRTC, WiFi o Facebook. Ejecutar
este ensayo separado del de 900 s para no competir por el mismo encoder.

Resultados locales del 23/09/2026:

- 30 s: 900 cuadros, 6/6 pulsos, audio posterior al video entre 64 y 98 ms.
- 60 s: 1800 cuadros, 12/12 pulsos, desfases en ms:
  `42, 109, 76, 109, 76, 110, 76, 109, 76, 110, 78, 110`.
- Ambas pasadas sin avisos de timestamps; encoder y decodificador terminaron con
  código 0. No se observa crecimiento continuo en esos intervalos, pero hay un
  desfase residual. No se aplica compensación fija a dispositivos reales basándose
  únicamente en esta señal sintética.
- 121 pruebas de regresión aprobadas. Reparaciones aún sin nuevo instalador.

Siguiente validación: comparar palmada visible en recepción del celular, grabación
local y emisión de prueba de Facebook; conservar hora, diagnóstico y logs sin claves.
Separar inicialmente red local estable del recorrido entre pisos. No cambiar IP ni
controladores como método de prueba.
