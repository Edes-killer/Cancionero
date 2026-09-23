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
nuevo proceso. Las métricas por sí solas no detienen el envío. No se ha corregido aún
la causa de los timestamps del caso real. El respaldo local comparte grabador y puede
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
