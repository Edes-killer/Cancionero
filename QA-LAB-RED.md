# Laboratorio de red y conflictos de Selah Live

Este laboratorio reproduce problemas reales sin tocar datos de una iglesia. Usa salas temporales `qa-*` y clientes Socket.IO simulados.

## Prueba automática

1. Abre Selah Live Electron en el PC.
2. En otra terminal, desde el repositorio, ejecuta:

```powershell
npm.cmd run qa:red
```

También se puede probar otro PC indicando su dirección:

```powershell
npm.cmd run qa:red -- http://192.168.100.11:4000
```

Comprueba: identificación del servidor, PIN incorrecto, sincronización entre dos controles, confirmación autoritativa al emisor, recepción del proyector, aislamiento entre iglesias y rechazo de comandos desde roles no autorizados.

La tanda automática actual contiene 15 pruebas. También fuerza comandos simultáneos, reconexión, índices inválidos, mensajes grandes, rutas manipuladas, solicitudes sobredimensionadas y archivos con extensión ejecutable.

## Prueba física corta (20 minutos)

1. Abre Electron y proyecta una canción de al menos cinco partes.
2. Vincula la APK y confirma que ambas pantallas indiquen conexión local.
3. Alterna 20 veces siguiente/anterior desde Electron y APK, incluyendo cinco pulsaciones casi simultáneas. Resultado esperado: ambos controles y el proyector terminan en la misma parte.
4. Apaga el Wi-Fi del teléfono durante 20 segundos. Avanza una parte desde Electron y vuelve a encenderlo. Resultado esperado: la APK reconecta y recupera la parte vigente.
5. Conecta el teléfono al repetidor y deja el PC en el router principal. Ejecuta detección automática y, si falla, prueba la IP manual. Guarda ambos resultados.
6. Conecta ambos al repetidor. Si ahora funciona, queda demostrado que el repetidor aislaba las dos redes y no era un error de Selah.
7. Activa el punto de acceso de Windows y conecta el teléfono. Resultado esperado: la APK descubre la nueva dirección del PC y vuelve a sincronizar.
8. Cierra Electron durante una proyección y ábrelo nuevamente. Resultado esperado: la APK informa la caída y recupera conexión cuando vuelve el puerto 4000.
9. Revisa Configuración → Log de errores y toma una captura. No debe haber cuadros de error JavaScript ni datos silenciosamente perdidos.

## Escenarios físicos recomendados

### 1. Cambio de IP del PC

- Conecta APK y Electron normalmente.
- Cambia el PC de Wi-Fi o renueva su dirección DHCP.
- La APK debe perder conexión, descubrir la nueva IP o permitir ingresarla manualmente y reconectar sin borrar datos.
- No conviene fijar una IP arbitraria fuera de la subred: puede dejar el PC sin internet. Para una IP fija, reserva la dirección desde el router.

### 2. Repetidor con aislamiento

- PC conectado al router principal y APK al repetidor.
- Ejecuta “Buscar servidor” y luego prueba la IP manual.
- Si `/ping` no responde, el repetidor está aislando clientes o creando otra subred; cambiar solamente la IP de Selah no lo soluciona.
- Repite conectando ambos al repetidor. Si ahí funciona, queda confirmado el aislamiento entre router y repetidor.

### 3. Corte y recuperación

- Proyecta una canción y avanza dos partes.
- Apaga el Wi-Fi del móvil durante 20 segundos y vuelve a encenderlo.
- Debe recuperar la sala y el índice actual sin duplicar avances.
- Reinicia Electron: Control debe mostrar la pérdida y reconectar cuando vuelva el puerto 4000.

### 4. Dos operadores simultáneos

- Abre Control en Electron y en la APK.
- Alterna siguiente/anterior rápidamente desde ambos durante un minuto.
- Ambos controles, Músicos y Proyector deben terminar en la misma parte.

### 5. Red degradada

- Usa el móvil lejos del repetidor o limita temporalmente su conexión desde el router.
- Prueba canciones, Biblia y mensajes antes de probar cámara.
- La señalización puede funcionar aunque el video WebRTC falle; registrar ambos resultados por separado.

### 6. Seguridad local

- Activa un PIN de sala.
- Prueba un PIN incorrecto desde otro dispositivo.
- Confirma que no pueda proyectar, cambiar partes ni usar el puente nube.
- Cambia el PIN y verifica que los clientes antiguos deban autenticarse nuevamente.

## Evidencia que debes guardar

- Hora exacta del fallo.
- IP y máscara del PC (`ipconfig`).
- IP del teléfono mostrada por el router.
- Si `/ping` respondió.
- Estado local/nube mostrado por Selah.
- Captura del Log de errores de Configuración.
- Acción exacta que provocó la divergencia.
