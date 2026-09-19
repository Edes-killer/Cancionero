# Prueba de cámara y audio — 19 septiembre 2026

Estado: correcciones en código, validación física pendiente. El teléfono del usuario devuelve
NotReadableError para dos dispositivos etiquetados como frontales. No se ha confirmado todavía
que estas correcciones permitan abrir su sensor frontal.

## Cambios a comprobar

- Apertura serializada: permisos, cambio de cámara y reconexión esperan su turno.
- Si se sale durante el permiso, la captura que llegue después se detiene (video y audio).
- Primer intento de cambio: liberar video. Segundo: liberar también el micrófono y reemplazar
  sus pistas en el enlace. Puede haber una breve interrupción de audio durante esta recuperación.
- Automática solicita Full HD a 30 FPS. HD, Full HD y 4K se pueden elegir; WebRTC prioriza fluidez.
- El celular muestra resolución/FPS/bitrate realmente enviados. El PC mide resolución/FPS/bitrate
  recibidos y espera en el búfer. El búfer NO mide latencia completa hasta Facebook ni sincronía A/V.
- Retrasar audio: 0–2000 ms, guardado por micrófono. Solo corrige sonido que llega antes de la imagen.

## Secuencia física

1. Instalar el debug nuevo y abrir escritorio con `npm.cmd run electron:dev` actualizado.
2. Antes de conectar, voltear tres veces; esperar a que termine cada apertura. Debe mostrar el sensor
   contrario, no solo reflejar la imagen. Si falla, guardar modelo, Android y diagnóstico de Configuración.
3. Conectar solo el móvil con calidad Automática. Grabar localmente 60 segundos moviendo una mano.
   Copiar la medición enviada y recibida. Registrar si los FPS caen sostenidamente bajo 24.
4. Añadir webcam del PC. Repetir 60 segundos con ambas visibles y comparar las mediciones del móvil.
5. Seleccionar explícitamente el micrófono del móvil, retraso 0. Grabar tres palmadas frente a la cámara.
   Repetir con el micrófono del PC. Identificar si el sonido llega antes o después y cuánto, usando la
   grabación local antes de agregar el retraso de una plataforma.
6. Si el sonido se adelanta, ajustar el retraso y volver a grabar. Comprobar después de cinco minutos
   que el desfase no crece. No usar retraso positivo para intentar corregir audio ya atrasado.
7. Durante la prueba, voltear estando conectado. Comprobar video remoto, audio, nombre del sensor y
   restauración de la cámara anterior si Android rechaza el cambio.
8. Entrar en Espera: comprobar silencio inmediato; volver a Cámara y comprobar recuperación de volumen.
9. Desconectar y reconectar; luego salir de Cámara y volver. Ninguna captura anterior debe mantener
   la cámara ocupada. Volver a ejecutar el paso 2.

No publicar como corrección definitiva del sensor hasta completar esta prueba en el teléfono afectado.
