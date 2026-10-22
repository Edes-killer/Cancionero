# Selah Live 0.5.42 — instalación visible y verificable

## Cambio principal

- Al elegir **Instalar ahora**, Selah muestra una transición clara antes de cerrarse.
- El instalador de Windows mantiene una ventana visible mientras reemplaza los archivos.
- Las etapas se presentan como **Preparando**, **Instalando** y **Completada**; no se muestra un porcentaje inventado durante una fase que Windows no permite medir con precisión.
- Al volver a abrir, Selah confirma que la versión nueva quedó instalada.
- Si la instalación no se completa, la siguiente apertura lo informa y deja el incidente en el registro operativo.

## Validación

- 169 pruebas automáticas aprobadas.
- Revisión crítica sin advertencias.
- Empaquetado NSIS de Windows compilado correctamente con la interfaz persistente del instalador.
