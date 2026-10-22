# Selah Live 0.5.43 — reparación crítica del autoactualizador

## Reparación

- Se corrigió el instalador que se cerraba a sí mismo al intentar apagar Selah Live.
- La aplicación anterior puede cerrar todos sus procesos sin terminar el instalador que acaba de lanzar.
- Se conserva el flujo visible de tres etapas: **Preparando**, **Instalando** y **Completada**.
- La descarga mantiene su porcentaje real y la instalación informa etapas sin inventar un porcentaje.

## Causa comprobada

El instalador era hijo del proceso de Selah. El comando de cierre usaba la opción `/T`, que termina el proceso indicado y todo su árbol de hijos. Por eso cerraba simultáneamente Selah y el instalador nuevo antes de reemplazar archivos.

## Validación

- Prueba automática que impide volver a introducir `taskkill /T` en el instalador.
- Compilación NSIS real de Windows.
- Candidata completa con pruebas, lint, APK, OTA y trazabilidad de artefactos.
