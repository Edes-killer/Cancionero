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

No se ha implementado aún límite de cola/backpressure ni reparación de timestamps.
No se reintenta ni se interrumpe una emisión como efecto de este diagnóstico.

QA automatizado: captura ausente, cola alta, líneas FFmpeg fragmentadas, frame 793
repetido (caso del culto), rechazo URL, errores de tiempo y redacción de destinos.
QA físico pendiente: iniciar Espera, grabar, cambiar escena, abrir Facebook y repetir
recorrido entre pisos con respaldo local. Copiar diagnóstico y exportar logs al fallo.
