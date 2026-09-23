# Selah Live 0.5.35 — prueba en iglesia

> Actualización posterior a la prueba de terreno: **no usar esta candidata para una
> emisión importante**. El timeout fijo de cinco segundos introdujo reinicios repetidos.
> Las reparaciones posteriores del watchdog y de timestamps están en el código, pero
> NO en los instaladores de esta publicación. Seguimiento y pruebas:
> [QA de transmisión](QA-DIAGNOSTICO-TRANSMISION.md).

Instalar manualmente el EXE en el PC y `selah-live.apk` en el celular. APK release
firmada, no debug. Esta candidata no reemplaza Latest 0.5.33 ni requiere SQL.

## Reparaciones incluidas

- Cámara completa sin recorte/zoom, con franjas negras según proporción, también en PiP.
- Avisos en el celular de recepción de cuadros y grabación en el PC. La confirmación
  caduca si se pierde el enlace; no implica publicación en Facebook ni cámara seleccionada.
- Diagnóstico rápido de captura, cola de entrada, avance FFmpeg y errores de tiempos.
  Copiar diagnóstico y resúmenes en logs; nuevos destinos RTMP ocultos en los registros.
- Cola de entrada limitada y escritura confirmada. Si una escritura se atasca cinco
  segundos o se excede el límite, se cierra ese intento y se usa la reconexión existente.
- Identidad por intento: fragmentos y cierres antiguos no afectan al nuevo proceso.

## Límites importantes

Validación previa: 115 pruebas automatizadas aprobadas, compilación web/TypeScript,
QA de audio y video sintético aprobado y auditoría de producción sin vulnerabilidades
reportadas. APK versionCode 50035 verificada con la misma firma de la release 0.5.33.
Estas pruebas no certifican la transmisión real de Facebook ni la señal entre pisos.

No se ha demostrado resuelta la causa de los saltos de timestamps del culto anterior.
La grabación comparte capturador con el envío y puede tener huecos al reconectar.
No confirma automáticamente que Facebook haya publicado ni verifica cada destino por
separado. Configuraciones compartidas en nube y aplicación completa de planes pendientes.
Los logs históricos pueden contener claves: la redacción nueva no los modifica.

## Prueba antes del culto

1. Conservar instaladores anteriores, grabaciones y listas importantes. Actualizar ambos
   equipos sin borrar datos; comprobar 0.5.35. Si hay conflicto de firma, no desinstalar
   sin respaldo. No cambiar IP ni drivers para esta prueba.
2. Grabar localmente: Espera en silencio, cambio a cámara, palmada visible para comprobar
   sincronía, encuadre completo y cambio de cámaras. Revisar el archivo resultante.
3. Celular conectado sin grabar: debe avisar que el PC no graba. Iniciar grabación y
   comprobar confirmación; detener y comprobar nuevo aviso.
4. En prueba, bajar entre pisos: si se pierde video o confirmación, no debe quedar verde.
   Regresar, verificar recuperación y que otra cámara siga funcionando.
5. Preparar una emisión de prueba en Facebook con visibilidad restringida; usar URL/clave
   de ESA emisión. Iniciar Espera desde Selah y revisar señal antes de publicar.
6. Mantener 15 minutos, abrir Facebook, alternar escenas y revisar desde otro equipo.
   Si falla, copiar Diagnóstico rápido, hora exacta y log. No compartir claves.

No usar como único respaldo del culto hasta pasar las pruebas. Los tests automatizados
no sustituyen red, cámara y plataforma reales. Descargar EXE y APK desde esta publicación,
no desde el enlace Latest, que conserva la estable.
