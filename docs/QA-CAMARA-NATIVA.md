# Laboratorio CameraX — no usar como cámara de emisión todavía

## Preparación

- Instalar `selah-live-debug.apk` recién compilada. No desinstalar la release para superar
  un conflicto de firma sin respaldar primero datos y ajustes locales.
- Abrir Cámara, desconectar del PC y desplegar **Laboratorio de cámara · solo debug**.
- Entrar en **Probar frontal / trasera con CameraX**, luego **Abrir cámara nativa de prueba**.
- La pantalla nativa no envía video al PC ni capta audio. No necesita internet para capturar.

## Comparación controlada

1. Anotar modelo, versión Android y WebView. Con la cámara habitual desconectada, probar
   frontal/trasera diez veces con luz suficiente. Registrar fallos y suavidad percibida.
2. Repetir diez cambios en el laboratorio. La imagen debe cambiar de sensor, no solo reflejarse.
   Si no existe sensor frontal compatible, debe mostrarlo sin sustituirlo silenciosamente.
3. Esperar al menos 15 segundos por sensor. Anotar resolución y FPS reales de análisis.
   No comparar este FPS como equivalente a recepción WebRTC: aquí no hay encoder ni red.
4. Tocar un objeto cercano y luego lejano. El informe indica si Android confirma enfoque;
   un sensor de foco fijo puede no confirmarlo y eso no implica fallo de apertura.
5. Girar horizontal/vertical. Verificar imagen con proporción correcta y botones accesibles.
6. Bloquear pantalla, desbloquear y volver. Android debe suspender la captura al quedar
   inactiva y reanudarla al volver; no se promete filmación en segundo plano.
7. Guardar informe y volver a cámara habitual. Comprobar preview y conexión al PC normales.
   Repetir el recorrido tres veces para detectar sensores retenidos por la otra captura.
8. Copiar el informe. Si hubo incidencias, al regresar de la Activity también se envía un
   resumen al registro de errores de Selah. El informe completo queda local en el teléfono.
9. Repetir denegando permiso de cámara desde Ajustes Android. Debe aparecer una explicación,
   sin cierre inesperado ni solicitud de permisos de micrófono por parte del laboratorio.

## Criterio para pasar a WebRTC nativo

Necesitamos cambio frontal/trasera y recuperación repetibles en el teléfono problemático
y al menos otro modelo, antes de implementar el puente de video/audio nativo y compararlo
con WebView bajo la misma carga. Medir después sincronía A/V, consumo, temperatura, pérdidas,
orientación y continuidad. El preview nativo por sí solo no valida una emisión profesional.

## Pruebas realizadas en desarrollo

- `npm.cmd test`: 82 pruebas JS aprobadas (no prueban cámaras físicas).
- `gradlew.bat :app:testDebugUnitTest`: 4 pruebas JVM del contador, incluidos reinicios,
  duplicados y pausas. No sustituye un test instrumentado de Activity.
- Build Next/TypeScript, ensamblado debug y compilación Java release correctos.
- `dependencyInsight --dependency androidx.camera --configuration releaseRuntimeClasspath`:
  CameraX ausente en release.
- Sin dispositivo ADB ni emulador configurado: pruebas físicas pendientes explícitamente.
