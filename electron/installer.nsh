; ✅ Arregla el falso "No se puede cerrar Selah Live" que muestra el
; instalador de electron-builder incluso cuando el Administrador de tareas
; no muestra nada corriendo. El chequeo interno de electron-builder busca
; procesos cuya ruta empiece en $INSTDIR vía PowerShell/tasklist, y falla
; en falso si queda un proceso auxiliar de Electron (GPU/crashpad handler)
; que no terminó junto con la ventana principal.
;
; customInit corre al inicio de .onInit, ANTES de que el instalador llegue
; a su propio chequeo -- forzamos el cierre de cualquier proceso residual
; acá para que ese chequeo ya no encuentre nada y nunca muestre el aviso.
!macro customInit
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 500
!macroend
