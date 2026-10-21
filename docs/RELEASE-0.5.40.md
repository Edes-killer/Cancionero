# Selah Live 0.5.40 — candidata para prueba en iglesia

Estado: código automatizado aprobado; validación física pendiente. No promover como
`Latest` ni usar como único respaldo de un culto hasta completar esta prueba.

## Cambios principales

- Preflight de grabación con espacio real: advertencia bajo 8 GB y bloqueo bajo 1 GB.
- Informe final de transmisión sin claves ni direcciones RTMP.
- Recuperación a MP4 de segmentos MKV dejados por un cierre inesperado.
- Recuperación independiente por destino: una plataforma caída ya no detiene las demás y se reintenta sin recodificar.
- Estado visible por plataforma: “Enviando” o “Reconectando”, sin transportar claves RTMP a la interfaz.
- El PC devuelve al celular FPS y búfer realmente recibidos; el modo automático reduce calidad si
  la recepción se atrasa aunque Chromium no informe limitación de red.
- El preflight bloquea la salida cuando una cámara móvil seleccionada llega desconectada, con menos
  de 12 FPS o con 1,5 segundos o más de búfer.
- Windows prioriza `h264_mf`, validado a Full HD, y usa `h264_qsv` solamente como respaldo.
- La selección comprueba cada encoder de hardware a 1920×1080/30 con los mismos parámetros
  de producción; no basta con que el dispositivo declare compatibilidad.
- “Revisar salida” ejecuta esa comprobación antes de habilitar la salida al aire y también
  valida el respaldo `libx264`; si ninguno sostiene Full HD, Selah bloquea la emisión.
- El diagnóstico final conserva la causa del cierre —entrada atascada, destino, motor u operador—
  incluso cuando Windows informa que FFmpeg terminó con código nulo.
- Esa causa aparece inmediatamente en el panel del operador al cerrarse el motor; no depende
  del siguiente sondeo del archivo de diagnóstico.
- La actualización de escritorio mantiene una ventana visible con porcentaje, tamaño,
  velocidad y tiempo restante; si Windows la oculta, Selah la restaura y muestra luego
  claramente la etapa de instalación.
- La APK muestra el porcentaje real de descarga OTA y distingue descarga, verificación,
  paquete listo y aplicación. Nunca reinicia la interfaz por sorpresa durante un culto.
- El escritorio permite entrar directamente con correo y contraseña, sin abrir un navegador.
- El acceso con Google continúa en el navegador seguro del sistema —requisito de Google—,
  pero ahora vuelve por un callback local con nonce de un solo uso y entrega la sesión
  directamente al launcher, sin depender de que el navegador abra un protocolo personalizado.
- Los enlaces de acceso por correo también regresan a Selah en vez de quedarse en localhost.
- El login prioriza el enlace sin contraseña para las cuentas históricas creadas con Google,
  separa claramente ambos métodos y muestra el código seguro del rechazo sin registrar correo,
  contraseña ni tokens. Al aparecer una sesión válida, entra sin exigir una recarga manual.
- Tipos y validaciones reforzados en Transmisión, Cámara, OBS opcional y conexión.
- Capacitor Android, Sharp y Source Map actualizados para corregir una vulnerabilidad
  crítica y dos altas publicadas después de preparar la primera candidata.
- Seguridad LAN reforzada: otro equipo ya no puede definir el PIN inicial, declararse proyector,
  abrir un host de cámara/emisión ni inyectar señales WebRTC entre salas. Los archivos locales y
  la conversión PowerPoint solo aceptan solicitudes del escritorio.
- Electron registra el PIN desde cualquier módulo y siempre usa su loopback; el APK mantiene
  detección automática y reintenta si alcanza el servidor antes de que termine de iniciar el PC.

## Evidencia automática

- `npm run qa:release`: 16 comprobaciones obligatorias, incluidas la revisión sintáctica del registro operativo y del preflight de destinos, la recuperación real de un destino local y la trazabilidad del build.
- GitHub repite esa misma compuerta en Windows para cada solicitud de integración y cada
  cambio de `main`; no usa credenciales ni publica artefactos ni duplica trabajos por rama.
- 168/168 pruebas automatizadas y 26/26 escenarios del laboratorio LAN aprobados.
- Build web y TypeScript aprobados.
- Lint crítico de transmisión, cámara y conexiones: cero hallazgos.
- Auditoría de producción: cero vulnerabilidades conocidas. En herramientas quedan dos
  advisories transitivos sin versión corregida publicada (`braces` en el lint de Next.js y
  `sprintf-js` en electron-builder); un verificador por ID permite solo esos casos y bloquea
  automáticamente cualquier alerta nueva o crítica.
- La recuperación se prueba con FFmpeg real: crea segmentos, reconstruye y decodifica el MP4.
- `npm run qa:audio` aprobó retraso, silencio de espera, volumen cero, compresión de picos,
  medición y monitoreo local sin alterar la salida.
- `npm run qa:video` aprobó adaptación 1280→640→1280 y recuperación después de perder
  cuadros, conservando la misma pista y conexión WebRTC.
- `npm run qa:captura` sostuvo 60 segundos de captura H264/Opus y entregó 1800/1800
  cuadros a FFmpeg, sin avisos de tiempo ni cola acumulada.
- `npm run qa:eficiencia -- 30` compara el codificador de Windows con el fallback por software sin usar Internet ni credenciales.
- El acceso real con Google fue completado en Electron: el proceso registró inicio, retorno
  local, sesión válida y conexión posterior a Inicio, sin registrar correo ni tokens.

## Empaquetado seguro

- `npm run electron:package:win` genera el instalador sin subirlo.
- `npm run candidata:build` ejecuta el QA, empaqueta Windows, Android y el bundle OTA, y después valida
  versión, commit, firma Android, manifiestos y procedencia de los tres artefactos.
- El comando histórico `electron:build:win` continúa disponible para publicación, pero solo
  debe ejecutarse después de aprobar `qa:candidata` y la prueba física.

Esto no certifica cámaras, micrófonos, WiFi, sincronía labial ni Facebook reales.

El APK release y el instalador NSIS deben reconstruirse desde el commit final después de estas
notas; `qa:artefactos` rechazará automáticamente cualquier binario de un commit anterior.
La APK conserva firma v2; el instalador Windows todavía no tiene firma Authenticode y puede
activar SmartScreen. Evidencia y estado: [EMPAQUETADO-0.5.40.md](EMPAQUETADO-0.5.40.md).

## Diagnóstico y soporte

- Cada error queda asociado a una sesión de soporte, nivel de gravedad, versión y operación.
- Los errores repetidos en pocos segundos se agrupan para evitar registros ruidosos.
- Configuración prepara un informe único con los eventos web y del proceso de escritorio.
- Electron registra cierres inesperados, ventanas sin respuesta, fallos de carga y servicios internos que no iniciaron.
- Antes de guardar o exportar se ocultan tokens, contraseñas, correos, claves y destinos RTMP.
- Los errores de transmisión y cámara ya no muestran solo el texto técnico: identifican plataforma, permisos, fuente ocupada, imagen interrumpida, audio, motor o red y entregan una acción segura.
- Cada aviso aclara qué configuración o servicio se conserva, evitando que el operador cierre todo por reflejo.
- “Revisar salida” comprueba realmente el servidor RTMP configurado (DNS, puerto y TLS) sin enviar video ni exponer la clave; ya no confía solo en el indicador de Internet de Windows.
- Una dirección inalcanzable bloquea la salida y muestra una explicación legible antes de iniciar FFmpeg.

## Prueba corta en iglesia

Duración estimada: 15–20 minutos. Conservar la versión estable y las grabaciones anteriores.

1. Abrir Selah en el PC y confirmar que Cámara, Micrófono, destino y carpeta de grabación
   aparecen disponibles en el asistente previo.
2. Conectar el celular cerca del punto de acceso. Confirmar que recupera su nombre y su
   asignación de Cámara 1/2 sin duplicarse.
3. Grabar localmente 90 segundos, sin transmitir: Espera silenciosa, cámara principal,
   segunda cámara, letra, mensaje y tres palmadas visibles/audibles.
4. Reproducir el MP4 completo. Debe conservar encuadre, audio continuo y sincronía estable;
   el desfase no debe aumentar con el tiempo.
5. Iniciar una emisión restringida en Facebook con una clave nueva. Esperar confirmación de
   señal antes de publicarla y mantenerla cinco minutos sin alejar el celular.
6. Revisar el informe final: duración coherente, destino nombrado, cuadros caídos y respaldo
   local. No debe contener la URL ni la clave de transmisión.
7. Solo en una grabación de prueba, cerrar Selah durante la grabación. Abrirlo nuevamente,
   recuperar la grabación pendiente y reproducir el MP4 reconstruido.
8. Con dos cámaras conectadas, desconectar una. La otra y el audio deben continuar; la fuente
   perdida debe reemplazarse por el fondo de seguridad sin mostrar errores al público.

## Criterios de aprobación

- No hay cierres, bloqueos ni cuadros congelados sostenidos.
- Espera no transmite sonido de micrófonos.
- La grabación local y Facebook mantienen audio entendible y sincronía aceptable.
- Una cámara perdida no derriba la sesión completa.
- El informe final y la recuperación funcionan sin exponer secretos.

## Cuándo detenerse

Detener la prueba y conservar logs si la grabación local ya está entrecortada, el desfase
crece, FFmpeg se mantiene bajo velocidad `1.0x`, la cámara se reconecta repetidamente o el
MP4 recuperado no abre. No atribuir automáticamente el fallo a Facebook si también aparece
en la grabación local.

## Límites conocidos

- La recuperación individual usa `tee + fifo` y está validada contra receptores TCP locales;
  falta confirmar el comportamiento frente a RTMPS/Facebook real durante la prueba física.
- CameraX continúa como laboratorio debug y no reemplaza aún la cámara web de producción.
- El lint global y el gate estricto están limpios; Control también forma parte del gate obligatorio.
- La prueba prolongada de dos horas y la medición comparativa de eficiencia siguen pendientes.
