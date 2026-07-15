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
  ; ✅ Matar la app y ESPERAR a que Windows libere los archivos antes de que el
  ; instalador borre los viejos. Con solo 500ms a veces los archivos seguían en
  ; uso -> "Fallo al desinstalar archivos antiguos". Dos intentos + más espera
  ; (por si un proceso auxiliar de Electron reapareció).
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1200
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1200
!macroend

; ✅ Al actualizar, el instalador primero corre en silencio el DESINSTALADOR
; VIEJO ya instalado (uninstallOldVersion) -- ese es un .exe aparte, con su
; propio chequeo de "¿está corriendo?" al inicio (customUnInit, no
; customInit). Sin este macro, el aviso seguía saliendo ahí aunque el
; instalador nuevo ya tuviera el arreglo de arriba.
!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1200
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1200
!macroend
