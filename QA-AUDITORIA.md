# Auditoría de calidad — Selah Live 0.5.26

Fecha: 1 de septiembre de 2026

## Resultado ejecutivo

La compilación web/Electron está operativa y las rutas principales cargan con una sesión real. Durante la auditoría se corrigieron fallas de seguridad, conexión local, actualización OTA, autenticación web y mensajes de producto. No se hicieron cambios destructivos en los datos de la iglesia.

## Pruebas aprobadas

- `npm test`: 3/3 pruebas aprobadas (rutas seguras, galería y orígenes de Electron).
- `npm run build`: compilación Next.js y TypeScript aprobada; 25 rutas generadas.
- `npm audit --omit=dev`: 0 vulnerabilidades de producción.
- `node --check`: `electron/main.js`, `electron/preload.js` y `electron/security.js` aprobados.
- Empaquetado Electron sin instalador (`electron-builder --win --dir`) aprobado.
- Servidor Electron real: `/info` y `/ping` responden como Selah Live en el puerto 4000.
- Protección de rutas del servidor: intento de escapar de la galería rechazado con HTTP 400.

## QA con sesión real

| Área | Estado | Resultado |
| --- | --- | --- |
| Inicio | Aprobado | Iglesia, plan y estadísticas cargan correctamente. |
| Configuración | Aprobado | Datos, logo, PIN, fuentes, miembros, tours, plan y preferencia de última alabanza visibles. |
| Log de errores | Aprobado | Registra categoría, ruta, plataforma, fecha y detalle; se visualizaron errores reales históricos de cámara. |
| Cancionero | Aprobado | 1.120 canciones; búsqueda exacta y estado sin resultados funcionan. |
| Historial | Aprobado | 3 cultos, estadísticas y filtros cargan. |
| Control | Aprobado con entorno | Herramientas y repertorio cargan; en navegador indica sin conexión porque no existe servidor Electron local. |
| Músicos | Aprobado con entorno | Repertorio, afinador, improvisador y ensayo cargan; conexión local requiere Electron. |
| Transmisión nativa | Aprobado visual | Cámaras/micrófonos, escenas, fuentes, apariencia y destinos cargan. Emisión real requiere Electron y hardware. |
| OBS avanzado | Aprobado | Ahora se identifica claramente como opcional y enlaza a Transmisión nativa. |
| Proyector | Pendiente UX | Sin servidor Electron permanece en “Preparando proyección”; en el uso real Electron entrega el estado. |

## Fallas encontradas y corregidas

- El descubrimiento automático nunca podía validar Electron: `/ping` no enviaba `app: "selah-live"`.
- El bloqueo especial de sesión de Android se aplicaba también a web/Electron y podía producir falsos estados sin conexión.
- Next.js bloqueaba recursos de desarrollo al alternar entre `localhost` y `127.0.0.1`.
- La actualización OTA podía aplicar archivos web que exigían una versión APK nativa superior.
- El puente nube aceptaba eventos sin validar suficientemente el emisor y el tipo de evento.
- El servidor local necesitaba límites de tamaño y validación más estricta de nombres, extensiones y rutas.
- La página OBS parecía ser el método principal; ahora se declara integración avanzada opcional.
- Textos públicos antiguos hablaban de OBS y de “300+” himnos; fueron actualizados al producto actual.
- El pie del Inicio mostraba una versión fija antigua; ahora usa la versión real.

## Pendientes que requieren prueba física

1. APK: vinculación automática y manual desde una red con repetidor, incluyendo PC y móvil en segmentos distintos.
2. Cámara Selah: cámara frontal/trasera, audio del teléfono y persistencia al cambiar de aplicación.
3. Transmisión: 30 minutos continuos, reconexión, audio externo, cuenta regresiva silenciosa, multicámara y grabación sin emitir.
4. Proyector: dos pantallas físicas, videos, carrusel, Biblia, mensajes, cuenta regresiva y recuperación tras cerrar/reabrir.
5. Actualizaciones: OTA web de APK y actualización completa cuando cambia la parte nativa.
6. Roles: repetir permisos con cuentas separadas de músico, líder y administrador.

## Deuda técnica

- `Control`, `En vivo`, `Canciones`, `Configuración` y `electron/main.js` son archivos demasiado grandes; conviene dividirlos por dominio antes de seguir agregando funciones.
- `app/server/index.js` duplica una implementación antigua del servidor local; debe consolidarse con `electron/main.js` para evitar divergencias.
- El lint completo todavía tiene deuda previa (tipos `any`, dependencias de hooks y funciones declaradas después de usarse). El build es correcto, pero el lint aún no puede exigirse como puerta de publicación.
- Falta versionar migraciones SQL/RLS para poder auditar la base de datos de forma reproducible.

## Flujo recomendado antes de publicar

```powershell
npm.cmd test
npm.cmd run build
npm.cmd audit --omit=dev
npm.cmd run electron:build:win
npm.cmd run apk
```

No publicar si falla una de las tres primeras órdenes. Para Electron/APK, completar además las pruebas físicas anteriores.
