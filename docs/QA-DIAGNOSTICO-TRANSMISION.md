# Diagnóstico rápido de transmisión

Cambio posterior al instalador 0.5.34 publicado. Requiere nuevo escritorio.

En Salir en vivo aparece después del primer inicio: fragmentos recibidos del renderer,
cola pendiente de escritura a FFmpeg (no equivale a su búfer interno ni a la red),
cuadros informados y antigüedad del último avance, avisos de timestamps y rechazo del
destino. Se consulta cada dos segundos; el log conserva un resumen cada diez segundos
y al terminar. Copiar diagnóstico no incluye URLs ni claves. Los logs antiguos pueden
contener claves: la redacción nueva no modifica archivos históricos.

No recibir fragmentos durante ocho segundos tras la gracia inicial apunta al tramo
captura/IPC. Una cola mayor de 4 MiB señala acumulación, sin atribuir causa única.
Doce segundos sin cuadros nuevos tras el arranque indica salida sin avance confirmado.
Los umbrales son alertas operativas, no garantía de recepción/publicación en Facebook.
Multidestino tiene métricas agregadas, no confirmación individual por destino.

La protección de entrada posterior limita la cola del renderer a 8 MiB y la escritura
al pipe a 8 MiB, esperando confirmación antes del siguiente fragmento. Si una escritura
tarda cinco segundos o se excede el límite, se cierra ese proceso y se usa la reconexión
existente con contenedor nuevo. La confirmación no significa recepción por Facebook.
Cada intento lleva identidad de sesión y propietario; fragmentos viejos no entran al
nuevo proceso. Las métricas por sí solas no detienen el envío. No se ha corregido aún
la causa de los timestamps del caso real. El respaldo local comparte grabador y puede
tener huecos durante reconexiones; no anunciar grabación ininterrumpida.

QA automatizado: captura ausente, cola alta, líneas FFmpeg fragmentadas, frame 793
repetido (caso del culto), rechazo URL, errores de tiempo y redacción de destinos.
QA físico pendiente: iniciar Espera, grabar, cambiar escena, abrir Facebook y repetir
recorrido entre pisos con respaldo local. Copiar diagnóstico y exportar logs al fallo.
