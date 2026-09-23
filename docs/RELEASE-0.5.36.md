# Selah Live 0.5.36 — candidata de reparación de transmisión

Instalación manual para prueba. No promover Latest ni distribuir OTA antes de validar
con celular y Facebook. No requiere SQL ni borrar datos.

## Cambios respecto de 0.5.35

- El plazo de escritura a FFmpeg ya no corta a los cinco segundos si el motor avanza.
  Vigila treinta segundos sin progreso; mantiene el límite de cola de 8 MiB.
- Un atasco local se muestra y detiene el intento, sin repetir automáticamente una
  secuencia de reconexiones. Los fallos de red conservan su tratamiento existente.
- Audio remuestreado con timestamps calculados por muestras para corregir la regresión
  de arranque reproducida con MediaRecorder. No se impone un desfase fijo a las cámaras.

## Evidencia y límites

Ensayo local de 15 minutos: 27.000 cuadros, cero avisos de tiempos, cierre correcto.
Pulsos sintéticos de 30 y 60 s: todos recibidos; desfase residual máximo de 110 ms.
121 tests aprobados. Detalles en [QA de transmisión](QA-DIAGNOSTICO-TRANSMISION.md).
QA de publicación: 7/7 comprobaciones. QA sintético de audio (Espera, volumen,
retardo y monitoreo) y video WebRTC (reducción/recuperación de calidad y corte)
aprobados. APK release con versionCode 50036 y firma SHA-256
`e2f870e235bbdf4bee71ed91b8d82c21cad9543839b1518068a65f3a7b5dab55`, igual a las
anteriores. En el paquete Electron se verificó coincidencia exacta del código de
proceso principal, escritura, diagnóstico y preload con los archivos probados.
Esto no certifica WiFi, cámara frontal, sincronía labial física o publicación Facebook.
La grabación comparte captura con el envío; no prometer respaldo sin interrupciones.

## Prueba corta antes de ir a la iglesia

1. Conservar instaladores y grabaciones anteriores. Instalar encima; si Android rechaza
   la firma, detenerse y registrar el error, no desinstalar ni borrar datos.
2. Confirmar 0.5.36 en el PC. Mantener inicialmente PC y celular cerca del router,
   sin modificar IP, adaptadores ni controladores.
3. Abrir cámara y enlazar al PC. Grabar un minuto local: Espera, cambio a cámara,
   palmada visible al principio y al final. Revisar el archivo y anotar el desfase.
4. Si el archivo local ya se corta o desfasa mucho, detener la prueba: copiar diagnóstico
   de cámara y transmisión, con hora exacta. Facebook aún no interviene en ese fallo.
5. Si lo anterior funciona, crear una emisión de prueba restringida en Facebook, con
   clave nueva de esa emisión. Verificar señal allí antes de publicarla. Mantener diez
   minutos, realizar otra palmada y comparar con la grabación local.
6. Solo después probar distancia o recorrido entre pisos. Si falla, anotar primero si
   se congeló la recepción del celular, la grabación local o únicamente Facebook.

Ante fallo, no insistir con reinicios repetidos. Guardar ambos diagnósticos y el log;
no compartir URLs de emisión ni claves. No usar esta candidata como único sistema de
un culto hasta completar las pruebas.
