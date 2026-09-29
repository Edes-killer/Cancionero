# Evidencia de empaquetado 0.5.40

Fecha: 29 de septiembre de 2026. Esta evidencia corresponde a la candidata de prueba,
no certifica todavía el funcionamiento físico en la iglesia.

## Android

- `npm.cmd run apk:debug`: compilación aprobada.
- `npm.cmd run apk`: compilación release aprobada, incluyendo `lintVitalRelease`.
- Identidad: `com.tuiglesia.cancionero`, `versionName 0.5.40`, `versionCode 50040`.
- APK release verificado con `apksigner`: firma v2 válida, un firmante RSA de 2048 bits.
- Certificado esperado: `CN=Selah Live, OU=Selah Live, O=Selah Live, L=Chile, ST=Chile, C=CL`.
- SHA-256 del certificado: `e2f870e235bbdf4bee71ed91b8d82c21cad9543839b1518068a65f3a7b5dab55`.
- Artefacto local: `selah-live.apk` (no se versiona en Git).

La firma v2 es válida para la instalación y actualización directa de esta APK. No cambiar el
keystore: Android rechazará una actualización firmada con otro certificado.

## Windows

- `electron-builder --win --publish never`: empaquetado NSIS aprobado.
- Electron `42.11.0`, arquitectura x64, instalador one-click por usuario.
- Artefacto local: `dist-electron/Selah Live Setup 0.5.40.exe`.
- Estado Authenticode comprobado con PowerShell: `NotSigned`.

El instalador sirve para la prueba interna y conserva el actualizador NSIS, pero Windows puede
mostrar SmartScreen. Para una distribución comercial profesional queda pendiente adquirir y
configurar un certificado Authenticode y verificar luego `Status: Valid`. La salida de
electron-builder que dice “signing with signtool.exe” no demuestra por sí sola una firma válida.

## Automatización

- `npm.cmd run qa:release`: 14 comprobaciones obligatorias.
- `npm.cmd run lint`: cero hallazgos.
- `npm.cmd run qa:eficiencia -- 30`: ambos codificadores completaron 900/900 cuadros a 31 fps,
  velocidad 1.03x, sin cola ni avisos de tiempo; `h264_mf` quedó recomendado en Windows.
- `npm.cmd run qa:destinos`: un receptor se cortó y volvió con una segunda conexión mientras el
  receptor estable continuó recibiendo; ambos procesos terminaron correctamente y se detectó
  explícitamente `Recovery successful`.
- `npm.cmd run qa:artefactos`: comprueba versión, OTA, firma/certificado de APK, hashes,
  `latest.yml`, estado Authenticode y procedencia Git embebida. Rechaza un APK o paquete Windows
  construido desde otro commit o con cambios rastreados sin confirmar. El tamaño, SHA-256 y commit
  exactos quedan guardados en `dist-electron/artefactos-0.5.40.json`, fuera de Git, para no alterar
  el commit del que provienen los binarios.
- `npm.cmd run qa:candidata`: ejecuta el gate completo del código y después verifica los artefactos.
- `npm.cmd run qa:publicar`: repite ambas capas en modo estricto y bloquea una publicación comercial
  mientras el instalador Windows no tenga firma válida.
