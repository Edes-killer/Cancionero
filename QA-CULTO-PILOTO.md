# Plan de prueba profesional — culto piloto

Este protocolo valida Selah Live en condiciones reales sin poner en riesgo una transmisión pública. Realizarlo idealmente 45–60 minutos antes del culto.

Antes de empaquetar una versión candidata, ejecutar `npm.cmd run qa:release`. Debe terminar con todas las
comprobaciones aprobadas; este comando valida pruebas, build/TypeScript, dependencias de producción y los
procesos Electron. No reemplaza las pruebas físicas de este documento.

## Datos de la prueba

- Fecha:
- Iglesia:
- Operador:
- PC / Windows:
- Conexión del PC: cable / Wi‑Fi:
- Celular y versión Android:
- Cámara principal / secundaria:
- Micrófono:
- Plataforma y calidad elegida:

## 1. Preparación segura (10 minutos)

1. Reiniciar el PC y abrir solamente Selah Live.
   - Esperado: inicia sin ventanas de error y conserva la configuración elegida.
2. Abrir **Configuración → Diagnóstico completo**.
   - Esperado: HTTP y Socket.IO en verde, versión visible y latencia estable.
3. Vincular el APK por QR, búsqueda automática o IP.
   - Esperado: conecta sin recargar; Control y PC muestran la misma iglesia.
4. Abrir Proyectar en la segunda pantalla.
   - Esperado: cubre toda la pantalla, incluida la barra de tareas; Alt+Tab permite volver al Control.
5. Preparar una lista con canción, Biblia, imagen, animación, carrusel, mensaje y cuenta regresiva.
   - Esperado: todos aparecen en la lista y conservan el orden.

## 2. Proyección y sincronización (10 minutos)

1. Avanzar y retroceder partes desde el PC y después desde el APK.
   - Esperado: PC, APK y proyector convergen siempre a la misma parte.
2. Activar repetir coro y recorrer una canción completa.
   - Esperado: Verso → Coro → Verso → Coro, sin bucles ni saltos indebidos.
3. Proyectar todos los tipos de la lista.
   - Esperado: la vista previa coincide con la salida y ningún recurso queda negro.
4. Desconectar el Wi‑Fi del celular durante 20 segundos y reconectarlo.
   - Esperado: el APK recupera el estado vigente sin reiniciar Selah.
5. Intentar proyectar desde un usuario músico.
   - Esperado: la acción es rechazada y queda registrada; no cambia la proyección.

## 3. Audio y cámaras (10 minutos)

1. Hablar y cantar con el micrófono seleccionado.
   - Esperado: el medidor responde, no queda en rojo continuamente y no hay distorsión.
2. Cambiar de micrófono y volver al original.
   - Esperado: recupera señal y conserva el volumen configurado.
3. Probar modo música y modo voz.
   - Esperado: música queda natural; modo voz reduce ruido sin usarse para instrumentos.
4. Cambiar Cámara 1, Cámara 2 y Ambas.
   - Esperado: no aparece pantalla negra; PiP conserva posición y tamaño.
5. Conectar Cámara Selah desde el APK, bloquear/desbloquear el teléfono y volver a la app.
   - Esperado: la cámara se recupera con el mismo código o informa claramente que está reconectando.
6. Iniciar pantalla de espera.
   - Esperado: micrófonos totalmente silenciados; al llegar a cero cambia a la escena elegida.

## 4. Ensayo de transmisión privada (15 minutos)

Usar una transmisión de prueba o con privacidad limitada, nunca la emisión pública definitiva.

1. Presionar **Revisar y salir en vivo**.
   - Esperado: lista cámara, micrófono, destino, internet y respaldo; bloquea solo fallos críticos.
2. Transmitir 10 minutos alternando escenas, canciones, Biblia, mensaje y cámaras.
   - Esperado: salud “Fluido”, velocidad cercana o superior a 0,95, FPS estable y audio sincronizado.
3. Desconectar internet del PC durante 15 segundos y restaurarlo.
   - Esperado: muestra “Reconectando”, vuelve al aire y la grabación local continúa en segmentos.
4. Finalizar la transmisión.
   - Esperado: ffmpeg termina sin error, se genera el MP4 y el botón abre su carpeta.
5. Reproducir inicio, mitad y final de la grabación.
   - Esperado: imagen y audio presentes, sincronizados y sin cortes graves.

## 5. Prueba de contingencia (5 minutos)

1. Desconectar Cámara 2 durante su uso.
   - Esperado actual: Selah informa o permite volver a Cámara 1 sin cerrar la página.
2. Cerrar y reabrir Control durante una canción.
   - Esperado: respeta la preferencia **Recordar última alabanza** de Configuración.
3. Intentar cargar un archivo con extensión extraña en Galería.
   - Esperado: rechazo legible; no se almacena ni bloquea la interfaz.
4. Abrir el log y descargar el informe.
   - Esperado: errores de la sesión incluyen detalle técnico y el JSON se descarga correctamente.

## Criterio para aprobar el piloto

El culto queda **APROBADO** si:

- no hay cierres ni bloqueos críticos;
- proyección y controles nunca quedan permanentemente desincronizados;
- el audio es entendible, sin saturación constante ni desfase perceptible;
- una caída de red se recupera sin perder la grabación completa;
- cualquier fallo ocurrido deja información útil en el registro.

Un fallo crítico deja el piloto **NO APROBADO**: pantalla negra sin recuperación, pérdida total de audio, cierre de la aplicación, proyección controlada por un rol no autorizado o grabación irrecuperable.

## Evidencia que conviene guardar

- Informe JSON descargado desde Configuración.
- `transmision.log` si hubo problemas al aire.
- Captura del panel de salud.
- Minuto exacto del incidente.
- Dispositivo, escena y acción realizada inmediatamente antes.
