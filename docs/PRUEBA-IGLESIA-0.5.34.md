# Prueba de iglesia — 0.5.34

## Antes del culto (no durante una emisión pública)

1. Respaldar grabaciones, exportar listas importantes y anotar ajustes/dispositivos actuales.
   Conservar el instalador estable 0.5.33. No borrar datos de la APK ni cambiar IP del PC.
2. Instalar EXE 0.5.34 en el PC y APK release `selah-live.apk` en los teléfonos. Confirmar
   versión en Configuración. Si Android rechaza por firma debug, detenerse: no desinstalar
   sin respaldo. Esta candidata no llegará mediante actualización automática general.
3. Abrir primero APK y después PC. Confirmar conexión en Inicio y Control, ir y volver entre
   pantallas. Si falla, exportar diagnóstico de red y logs; no reinstalar drivers ni cambiar IP.

## Bloque A: operación del culto (10 minutos)

- Abrir lista de prueba; canciones, versículo, imagen, carrusel y mensaje.
- Modificar orden desde APK y comprobar escritorio. Confirmar iglesia/lista correctas.
- Proyectar en la pantalla de iglesia; comprobar tamaño, salida de pantalla completa y controles.
- Si falla Control o Proyector, parar la prueba de candidata y usar la estable conocida.

## Bloque B: transmisión grabada localmente (15–20 minutos)

- Usar primero una cámara y un micrófono. No transmitir todavía a Facebook.
- Hacer clip de calibración con palmada visible. Si audio llega antes, ajustar retraso;
  si llega después, registrar desfase: el control actual no adelanta audio.
- Iniciar Espera hablando al micrófono: el archivo grabado debe quedar en silencio durante
  Espera. Volver a cámara; confirmar audio. No activar monitor sin audífonos.
- Conectar dos celulares (o webcam + celular), seleccionar cámara y micrófono explícitamente.
- Desconectar un celular con su botón. El otro debe seguir funcionando. Fondo de respaldo
  o PiP oculto en la cámara perdida; sin cambiar a otro micrófono por sorpresa.
- Reconectar el mismo celular. Debe volver al mismo selector y mantener volumen/retraso.
- Solo en prueba, apagar/encender WiFi del teléfono. Puede esperar timeout del enlace viejo;
  registrar duración real. No modificar el adaptador ni IP de Windows.
- Descargar informe de cámaras. Revisar archivo grabado completo: nitidez, fluidez y sincronía.

## Bloque C: salida a plataforma (10 minutos)

Solo tras aprobar A y B, usar transmisión de prueba con la visibilidad más restringida que
permita la plataforma. Revisarla desde otro dispositivo con audífonos. Comparar grabación local
contra emisión para distinguir fallos de captura de problemas de plataforma/red.

## Preparación desde casa y nube

Probar guardar una lista desde APK con PC apagado y cargarla luego en la iglesia, con internet.
No confundir lista guardada con sincronización de diseños: el armado de Transmisión y ajustes
de Control siguen siendo locales en esta candidata. No depender de borradores offline pendientes
de subir como función validada.

## Entregar resultados

Anotar versión de ambos equipos, modelo/Android, fuente de audio, hora del fallo, acción previa
y resultado esperado/real. Adjuntar informe de cámara y log de Configuración; ocultar claves RTMP
si se comparte un log FFmpeg. Un clip breve de palmada ayuda a medir el desfase.

**Criterio de aprobación:** A sin errores críticos; B y C sin cortes inesperados, interferencia
entre cámaras ni desfase creciente. Si una prueba falla, conservar evidencias y no promover
0.5.34 a Latest. Mantener respaldo operativo conocido para el culto real.
