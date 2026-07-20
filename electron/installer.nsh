; ✅ Mata TODOS los procesos de Selah Live y espera a que Windows libere los
; archivos antes de que el instalador los toque. Historial: con 2 intentos +
; 2.4s a veces el proceso (o un helper de Electron: GPU/utility/crashpad) seguía
; vivo o con handles abiertos a mitad de instalación -> "Fallo al desinstalar
; archivos antiguos" / "No se puede cerrar Selah Live" con la barra ya avanzada.
; Ahora: varios intentos, por nombre de macro Y por nombre fijo (por si la macro
; no resolviera), con más espera total para que se liberen los handles.
!macro matarSelahLive
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "Selah Live.exe" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "Selah Live.exe" /T'
  ; Espera final más larga: aunque el proceso ya murió, Windows tarda en soltar
  ; los handles de los .dll/.exe mapeados; sin esto el copiado fallaba igual.
  Sleep 3000
!macroend

; customInit corre al inicio de .onInit del instalador NUEVO, ANTES de su propio
; chequeo de "¿app corriendo?" y ANTES de desinstalar la versión vieja. Si acá
; matamos todo, los pasos siguientes ya no encuentran la app viva.
!macro customInit
  !insertmacro matarSelahLive
!macroend

; customUnInit corre al inicio del DESINSTALADOR viejo (que el instalador nuevo
; ejecuta para quitar la versión anterior).
!macro customUnInit
  !insertmacro matarSelahLive
!macroend
