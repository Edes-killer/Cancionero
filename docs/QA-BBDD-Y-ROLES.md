# QA de base de datos y roles

Ejecutar antes de publicar la siguiente versión. Requiere una cuenta administradora y una segunda cuenta
de prueba. No usar datos reales del culto para las acciones de creación y eliminación.

## 1. Administrador

- Iniciar sesión y confirmar que Inicio muestra la iglesia correcta.
- Abrir Configuración, cambiar un dato no crítico y guardarlo.
- Crear una invitación con rol **Músico** y copiar el código.
- Confirmar que aparecen miembros, invitaciones y registros de error.

## 2. Cuenta nueva

- Abrir el enlace de invitación en otro navegador o perfil privado.
- Iniciar sesión y aceptar la invitación.
- Confirmar que entra a Músicos y puede leer canciones/acordes.
- Intentar abrir `/configuracion`, `/control` y `/canciones`: debe ser redirigida o bloqueada.

## 3. Cambio de rol

- Desde la cuenta administradora cambiar la cuenta de prueba a **Líder**.
- Volver a iniciar la sesión de prueba y confirmar acceso a Control y Canciones.
- Crear una canción de prueba, editarla y enviarla a papelera.
- Crear y guardar una lista de culto de prueba.
- Confirmar que el líder sigue sin poder administrar miembros ni configuración de la iglesia.

## 4. Aislamiento

- Si existe otra iglesia de prueba, confirmar que ninguna cuenta ve sus canciones, listas, archivos o
  invitaciones.
- Subir una imagen a Galería, renombrarla, moverla de carpeta y eliminarla.
- Cambiar el logo y confirmar que el logo anterior no aparece en la galería.

## 5. Cierre

- Devolver la segunda cuenta a Músico o quitarla de la iglesia.
- Eliminar canción y lista de prueba.
- Ejecutar `supabase/diagnostics/verificar_integridad.sql`: todos los controles deben quedar en cero.
- Ejecutar `npm.cmd run build` y `npm.cmd test`.
