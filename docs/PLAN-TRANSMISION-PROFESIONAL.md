# Transmisión profesional: plan aceptado

El usuario aprobó el plan el 19 de septiembre de 2026, después de reportar una prueba de
transmisión con buen resultado. Esa confirmación general no demuestra aún compatibilidad
con todos los teléfonos ni valida cada fallo anterior por separado.

## 1. Audio y mediciones — primera entrega implementada

- Medidor de salida real y medición de entrada para detectar saturación.
- Compresión de picos y silencio de Espera al final de la cadena.
- Monitoreo optativo por audífonos, independiente de la emisión.
- Calibración manual mediante clip local de 8 segundos, sin publicar.
- Volumen y retraso por identificador de micrófono.
- QA con señales sintéticas en Web Audio real y prueba de interfaz en Electron.

Pendiente: validar micrófonos físicos y deriva en grabaciones largas. La identidad persistente
del celular ya vincula sus perfiles entre conexiones. El retraso solo compensa audio adelantado. La protección
actual es compresión de picos, no un limitador de pico verdadero certificado.

## 2. Calidad y diagnóstico automáticos — primera entrega implementada

Usar mediciones de envío, recepción y codificación para detectar saturación sostenida,
adaptar calidad con recuperación gradual y producir avisos accionables. Conservar un
informe de la sesión sin claves RTMP. Diferenciar FPS de captura, de recepción y de salida.

Implementado: modo automático del celular ajusta bitrate y escala del sender WebRTC
sin detener pistas ni renegociar. Tres muestras limitadas por CPU/red reducen un nivel;
diez muestras estables recuperan uno, con 15 segundos mínimos entre cambios. Las
selecciones manuales no activan esta política. Si el navegador rechaza el ajuste, se
conserva el nivel anterior, se avisa y se registra el error. FPS bajos sin causa conocida
no se atribuyen automáticamente a la red. La captura sigue siendo la elegida; el ajuste
afecta al envío, no garantiza aliviar el costo de captura del sensor.

En escritorio: diagnóstico por celular de FPS recibidos, bitrate y búfer incremental,
con avisos y descarga de las últimas 480 líneas de medición. Se conserva localmente
el último informe (muestras cada 15 segundos); no incluye logs FFmpeg ni claves RTMP.
Las mediciones faltantes se muestran como desconocidas, no como cero.

La prueba física del 29 de septiembre mostró 7,7–13 segundos de búfer y solo 11–14 FPS
recibidos mientras el emisor aún no declaraba limitación de ancho de banda. El PC ahora devuelve
esas métricas al celular: tres muestras degradadas reducen el perfil automático. El preflight
considera crítica una fuente seleccionada con al menos 1,5 segundos de búfer o menos de 12 FPS y
no permite salir al aire hasta que se estabilice o se reduzca su calidad.

Pendiente: validación física de adaptación en distintos WebView, integración de estas
medidas con carga del encoder final y reporte completo de sesión/audio/destinos.
Las pruebas unitarias verifican la política y sus deltas, no simulan hardware ni WiFi real.
`npm.cmd run qa:video` prueba dos peers WebRTC reales en Electron, con video sintético:
1280 → 640 → 1280 sin sustituir pista ni renegociar. Este laboratorio usa maintain-resolution
para aislar el escalado explícito; producción usa maintain-framerate y Chromium también
puede adaptar internamente. No equivale a probar la política completa bajo congestión real.

## 3. Captura móvil nativa — laboratorio local implementado; comparación pendiente

Evaluar CameraX/Camera2 integrado con WebRTC y comparar contra la captura actual de WebView.
Debe demostrar mejora de apertura frontal/trasera, enfoque, exposición y continuidad en
varios equipos antes de sustituir el motor. No exigir una aplicación externa al usuario.

Primera prueba aislada con CameraX 1.5.3: Activity nativa y plugin Capacitor exclusivamente
en `src/debug`, con dependencias `debugImplementation`. Frontal/trasera, enfoque por toque,
preview que conserva proporciones, resolución real y FPS de cuadros entregados al analizador.
Objetivo comparativo 1080p con selección alternativa de CameraX; no promete 1080p en todos los
sensores. No abre micrófono ni guarda imágenes. Informe local acotado a 200 entradas.

Se abre desde Cámara → Laboratorio de cámara, únicamente desconectado. Navegar a la página
de laboratorio desmonta y libera la captura web antes de abrir la nativa manualmente.
En producción no está el plugin, Activity ni dependencias CameraX. `/camara-lab` conserva
la restricción de líder/admin y muestra indisponibilidad fuera de debug Android.

Validación: build web, compilación debug y Java release; 82 tests JS existentes y 4 tests
JVM nuevos del contador de FPS. Verificado grafo release sin androidx.camera. No hay teléfono
conectado ni AVD configurado: apertura, enfoque, orientación y permisos requieren prueba física.
**Todavía NO está integrada con WebRTC, ni sustituye la cámara de transmisión.**
La decisión de integrar requiere comparar frontal/trasera, temperatura, FPS y reconexión
en varios dispositivos; un resultado visual bueno aislado no basta.

Referencias oficiales: [Preview y ciclo de vida](https://developer.android.com/media/camera/camerax/preview),
[análisis de cuadros](https://developer.android.com/media/camera/camerax/analyze),
[versiones CameraX](https://developer.android.com/jetpack/androidx/releases/camera).

## 4. Continuidad del culto — recuperación local y por destino implementadas; pruebas físicas pendientes

La alternativa visual cuando se pierde una cámara ya está implementada. La salida usa una sola
codificación y `tee + fifo` de FFmpeg: cada destino tiene cola acotada, descarta durante una caída
antes que frenar a los demás, reintenta cada cinco segundos y vuelve desde un keyframe. Después de
12 intentos consecutivos abandona solo esa salida; si era la única, el mecanismo general recrea la
sesión. La prueba `npm.cmd run qa:destinos` corta y restablece un receptor TCP real mientras otro
continúa recibiendo. El panel identifica cada salida como Enviando o Reconectando y vuelve a verde
solo después de `Recovery successful`; los eventos enviados al renderer no contienen URL ni clave.
“Enviando” significa que FFmpeg entrega paquetes, no que la plataforma ya publicó el video.
Pendiente confirmar la misma recuperación contra RTMPS de plataformas reales.

La recuperación de grabación local ya detecta segmentos MKV abandonados después de un cierre
inesperado y permite reconstruirlos como MP4 desde Transmisión. La operación excluye la sesión
activa y conversiones en curso, impide procesar el mismo grupo dos veces y conserva los originales
si FFmpeg falla o genera una salida vacía. Hay una prueba de integración que crea dos MKV reales,
los concatena con el mismo plan usado en producción y decodifica el MP4 resultante. Falta validar
un cierre forzado real durante una grabación larga en el PC de la iglesia.

Detección de poco espacio implementada: el escritorio consulta el volumen real de la carpeta
de grabaciones, muestra el resultado en el preflight, advierte bajo 8 GB y bloquea el inicio
bajo 1 GB. La comprobación se repite al abrir el archivo para evitar depender de un dato antiguo.

Primera entrega: compositor vigila cada cámara local/remota por pista y contador de cuadros.
Pista no disponible se oculta inmediatamente; tres segundos sin nuevos cuadros activan fondo
brandeado, sin mensajes técnicos al público ni cambio automático a otra cámara. El PiP se oculta
independientemente. Recuperación tras un segundo de cuadros continuos. Audio y proceso de
emisión no se modifican. Aviso al operador y registro limitado a una incidencia cada 30 s.
Sin contador compatible solo se verifica disponibilidad de pista; no afirmar detección de
congelación en ese caso. `qa:video` verifica corte/retorno reales en WebRTC local sintético.

Identidad persistente implementada: UUID aleatorio local, sin IMEI ni huella del dispositivo.
Las fuentes y perfiles de audio ya no dependen del socket efímero. Durante la sesión de escritorio
se conserva el nombre, Cámara 1/2 y micrófono seleccionado cuando el celular pierde conexión.
Un enlace atrasado no cierra al nuevo; una identidad duplicada activa se rechaza y se reintenta.
Desconectar otro celular no detiene los demás. Aviso de cierre intencional del host se distingue
de caída inesperada. La identidad es correlación, no una credencial de autorización.

Validación: pruebas de identidad y prueba Socket.IO real con handlers del servidor, puerto
local efímero, desconexión y nuevo socket. No prueba imagen/audio físicos ni restaura el armado
al reiniciar escritorio. Requiere APK y escritorio nuevos; borrar datos de APK cambia identidad.
Pendientes destinos y pruebas físicas prolongadas. La prueba no demuestra funcionamiento en
todos los teléfonos.

## 5. Eficiencia del motor — benchmark reproducible implementado

Cuantificar costo de canvas → MediaRecorder → FFmpeg, comparar alternativas y selección de
codificador por GPU. No reemplazar toda la arquitectura sin un benchmark y una ruta de retorno.

`npm.cmd run qa:eficiencia -- 30` ejecuta el mismo transcodificador Full HD de producción
contra un receptor TCP local, sin cámara, micrófono, Internet ni credenciales. En Windows compara
Media Foundation (`h264_mf`), Quick Sync (`h264_qsv`) y `libx264`; exige 30 fps, cero cola y cero avisos de tiempo, e
informa cuadros, bitrate, velocidad y duración. En el PC de desarrollo ambos completaron 30 segundos
con 900/900 cuadros, 31 fps, velocidad 1.03x, cola cero y ningún aviso temporal; `h264_mf` quedó
recomendado. Esta medición valida el pipeline aislado,
no la captura WebRTC/canvas ni la carga térmica de un culto largo; esas capas se deben medir juntas
durante la prueba física de dos horas.

La prueba física del 29 de septiembre eligió QSV porque el selector anterior solo comprobaba
0,3 segundos a 640×360. En un intento cayó a `speed=0.03x` sin producir cuadros. El selector ahora
prioriza Media Foundation —la alternativa que sí sostuvo el ensayo Full HD— y conserva QSV solo
como respaldo cuando MF no está disponible. Antes de elegir cualquiera de los dos, ejecuta en ese
PC un ensayo Full HD de dos segundos con los mismos parámetros de producción y exige al menos 55
cuadros y velocidad 0,95x; si ambos fallan utiliza `libx264`.

`Revisar salida` ejecuta esta prueba antes de habilitar la confirmación al aire. Evalúa también
`libx264`; si ningún motor sostiene Full HD, bloquea la emisión y explica que se deben cerrar
programas pesados o usar otro PC. La selección aprobada queda cacheada durante esa ejecución.

## 6. Validación del servicio — informe implementado; prueba prolongada pendiente

Asistente previo al culto, informe final y pruebas de dos horas con dos cámaras, grabación,
varios celulares/PC y cortes de red controlados. Nunca cambiar la IP de la tarjeta del usuario
como requisito del laboratorio (ya causó pérdida de conectividad en una prueba anterior).

El asistente previo ya comprueba fuentes, micrófono, destino, internet, respaldo y espacio.
Al terminar, Selah conserva un informe descargable con duración, calidad, nombres de destinos,
reconexiones, cuadros caídos, tamaño/carpeta del respaldo y diagnóstico final. El informe elimina
direcciones RTMP y no afirma que Facebook u otra plataforma haya publicado el video.

El diagnóstico terminal conserva la causa después de cerrar FFmpeg: distingue protección por
entrada atascada, interrupción del destino, fallo del motor y finalización del operador. Un cierre
forzado que Node informa como `código null` ya no borra la causa con el mensaje genérico de proceso
detenido. La intención de cierre pertenece a cada sesión para no contaminar una reconexión nueva.

Procedimiento de audio y cámaras: [QA-CAMARA-TRANSMISION.md](QA-CAMARA-TRANSMISION.md).
