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

Pendiente: validar micrófonos físicos, deriva en grabaciones largas e identidad persistente
de cada celular entre conexiones. El retraso solo compensa audio adelantado. La protección
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

Pendiente: validación física de adaptación en distintos WebView, integración de estas
medidas con carga del encoder final y reporte completo de sesión/audio/destinos.
Las pruebas unitarias verifican la política y sus deltas, no simulan hardware ni WiFi real.
`npm.cmd run qa:video` prueba dos peers WebRTC reales en Electron, con video sintético:
1280 → 640 → 1280 sin sustituir pista ni renegociar. Este laboratorio usa maintain-resolution
para aislar el escalado explícito; producción usa maintain-framerate y Chromium también
puede adaptar internamente. No equivale a probar la política completa bajo congestión real.

## 3. Captura móvil nativa — pendiente de prototipo y comparación

Evaluar CameraX/Camera2 integrado con WebRTC y comparar contra la captura actual de WebView.
Debe demostrar mejora de apertura frontal/trasera, enfoque, exposición y continuidad en
varios equipos antes de sustituir el motor. No exigir una aplicación externa al usuario.

## 4. Continuidad del culto — pendiente de ampliación y pruebas

Recuperación por destino, alternativa cuando se pierde una cámara, grabación local recuperable
tras cierre inesperado y detección de poco espacio. Probar cortes provocados de red y fuentes.

## 5. Eficiencia del motor — pendiente de medición

Cuantificar costo de canvas → MediaRecorder → FFmpeg, comparar alternativas y selección de
codificador por GPU. No reemplazar toda la arquitectura sin un benchmark y una ruta de retorno.

## 6. Validación del servicio — pendiente

Asistente previo al culto, informe final y pruebas de dos horas con dos cámaras, grabación,
varios celulares/PC y cortes de red controlados. Nunca cambiar la IP de la tarjeta del usuario
como requisito del laboratorio (ya causó pérdida de conectividad en una prueba anterior).

Procedimiento de audio y cámaras: [QA-CAMARA-TRANSMISION.md](QA-CAMARA-TRANSMISION.md).
