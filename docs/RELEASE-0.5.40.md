# Selah Live 0.5.40 — candidata para prueba en iglesia

Estado: código automatizado aprobado; validación física pendiente. No promover como
`Latest` ni usar como único respaldo de un culto hasta completar esta prueba.

## Cambios principales

- Preflight de grabación con espacio real: advertencia bajo 8 GB y bloqueo bajo 1 GB.
- Informe final de transmisión sin claves ni direcciones RTMP.
- Recuperación a MP4 de segmentos MKV dejados por un cierre inesperado.
- Tipos y validaciones reforzados en Transmisión, Cámara, OBS opcional y conexión.
- Dependencias transitivas actualizadas sin cambios mayores de API.

## Evidencia automática

- `npm run qa:release`: 12/12 comprobaciones aprobadas.
- 138/138 pruebas automatizadas aprobadas.
- Build web y TypeScript aprobados.
- Lint crítico de transmisión, cámara y conexiones: cero hallazgos.
- Auditoría de dependencias de producción y de compilación: cero vulnerabilidades conocidas.
- La recuperación se prueba con FFmpeg real: crea segmentos, reconstruye y decodifica el MP4.
- `npm run qa:eficiencia -- 30` compara el codificador de Windows con el fallback por software sin usar Internet ni credenciales.

Esto no certifica cámaras, micrófonos, WiFi, sincronía labial ni Facebook reales.

El APK release y el instalador NSIS fueron generados localmente. La APK tiene firma v2 válida;
el instalador Windows todavía no tiene firma Authenticode y puede activar SmartScreen. Evidencia:
[EMPAQUETADO-0.5.40.md](EMPAQUETADO-0.5.40.md).

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

- La recuperación individual de un destino caído todavía requiere separar codificación y
  distribución; el `tee` actual conserva los otros destinos, pero no puede reinsertar uno.
- CameraX continúa como laboratorio debug y no reemplaza aún la cámara web de producción.
- El lint global y el gate estricto están limpios; Control también forma parte del gate obligatorio.
- La prueba prolongada de dos horas y la medición comparativa de eficiencia siguen pendientes.
