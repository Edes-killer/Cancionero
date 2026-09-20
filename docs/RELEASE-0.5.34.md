# Selah Live 0.5.34 — candidata de prueba en iglesia

Publicación preliminar, no actualización estable general. Instalar manualmente ambos
equipos. No se publicará bundle OTA para esta candidata: no debe cambiar silenciosamente
la preparación de otros usuarios. No requiere ejecutar SQL nuevo.

## Incluido

- Exportación de listas/estudios bíblicos a texto y Word.
- Ajustes del retorno de inicio de sesión Google en APK y reconexión con el escritorio.
- Salida Full HD y selección de resolución del celular; la resolución efectiva depende
  del dispositivo y de la adaptación de calidad, no se garantiza 4K ni 30 FPS constantes.
- Audio: medición entrada/salida, compresión de picos, monitoreo opcional por audífonos,
  clip de calibración local y retraso manual por micrófono. Espera silencia la salida.
- Calidad automática de envío del celular, con reducción y recuperación gradual.
- Diagnóstico de recepción por cámara y descarga de informe sin claves RTMP.
- Protección ante congelación: fondo de iglesia y recuperación visual sin cambiar de cámara.
- Identidad persistente del celular: conserva selección de Cámara 1/2 y micrófono durante
  la sesión de escritorio al reconectar con otro socket. Desconectar uno no detiene los demás.
- Corrección del identificador en avisos de desconexión y rechazo de identidad duplicada activa.

## Archivos

- `Selah-Live-Setup-0.5.34.exe`: instalador Windows.
- `selah-live.apk`: APK release firmada, para uso de prueba habitual.
- `selah-live-debug.apk`: laboratorio CameraX adicional, solo para diagnóstico frontal/trasera.
  Tiene firma debug; no sustituir la release desinstalándola sin respaldar datos primero.
- Documentos de prueba y SHA256SUMS.txt para comprobar los instaladores.

La release Android no incluye el laboratorio nativo. La transmisión sigue usando WebRTC
actual. CameraX todavía no transmite ni reemplaza ese motor.

## Validación y límites

93 pruebas JS aprobadas; pruebas de Web Audio e interfaz en Electron, WebRTC sintético con
corte/recuperación y Socket.IO real con desconexión/nuevo socket. QA de publicación 7/7,
incluida auditoría de dependencias de producción (bloqueo en severidad alta).
Instalador Windows y APK release compilados; Android 0.5.34 (versionCode 50034), con
la misma firma que la APK release 0.5.33 publicada. Laboratorio debug compilado y sus
4 pruebas JVM aprobadas. No instalar la APK debug sobre una release: sus firmas difieren.
Estos resultados no certifican cámara frontal, WiFi de la iglesia, sincronía de audio
durante horas ni compatibilidad de todos los equipos. Seguir PRUEBA-IGLESIA-0.5.34.md.

## Pendientes ordenados — no incluidos como funciones terminadas

1. **Validación física bloqueante:** frontal/trasera, dos celulares, audio/video, proyección
   y red real. Si falla una función crítica, no promover esta candidata a estable.
2. **Configuraciones compartidas en nube:** perfiles versionados por iglesia para Control
   (Pro/Premium) y Transmisión (Premium), con conflictos detectables, caché y aplicación
   explícita fuera del vivo. No subir claves RTMP ni configuración de hardware/red/disco.
3. **Preparación de cultos en APK:** conservar listas compartidas también en Gratis dentro
   de sus cupos. Verificar preparación con internet y PC apagado. Borradores offline con
   envío pendiente y resolución de conflictos no deben anunciarse hasta implementarse.
4. **Planes y permisos:** iglesia como unidad de suscripción; Gratis para culto básico,
   Pro amplía cupos/configuración Control, Premium suma transmisión escritorio y cámara
   móvil de la misma iglesia. Aplicar restricciones reales, no solo insignias visuales.
   Quitar promesa de transmitir autónomamente desde APK. Validar cupos de nube por iglesia
   antes de prometer 2/10 GB; revisar respaldo, multisede y soporte anunciados en landing.
5. **Continuidad restante:** perfiles/armado al reiniciar escritorio, recuperación por destino,
   poco espacio y archivos de grabación recuperables. No hay garantía completa aún.
6. **Motor nativo y rendimiento:** comparar laboratorio CameraX en dispositivos reales antes
   de integrar WebRTC nativo; medir doble codificación y carga sostenida de dos horas.

La candidata no bloquea hoy Transmisión a iglesias sin Premium: ese control comercial es
pendiente explícito. No venderla todavía como producto con planes plenamente implementados.
