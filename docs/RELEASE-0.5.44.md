# Selah Live 0.5.44 — Control fluido y cierre confiable

## Reparaciones

- Control ya no deja a Electron esperando una confirmación invisible al cerrar la ventana.
- El borrador del culto continúa protegido en la caché local, por lo que cerrar Selah no pierde la lista preparada.
- El proceso principal permite cerrar la ventana incluso si alguna pantalla intenta bloquear accidentalmente la salida.
- Se eliminó una tarea de ajuste visual que se reinstalaba en cada renderizado de Control.
- Inicio, Canciones y Ajustes se precargan para reducir la espera al cambiar de módulo desde Control.

## Seguridad y estabilidad

- Next.js se actualizó a 16.4.2 para incorporar las correcciones críticas publicadas el 22 de octubre de 2026.
- Electron se actualizó dentro de su misma rama estable a 42.11.18.
- La auditoría de dependencias de producción informa cero vulnerabilidades.

## Validación

- 171 pruebas automatizadas aprobadas.
- Compilación web y TypeScript aprobada.
- Lint de módulos críticos aprobado.
- Auditorías de producción y herramientas aprobadas.
- Flujo completo de GitHub Actions aprobado.
