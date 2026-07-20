; ══════════════════════════════════════════════════════════════════════════════
; ARREGLO DEL "Fallo al desinstalar archivos antiguos de la aplicación.: 2"
;
; Causa raíz (encontrada leyendo el código de electron-builder):
;   templates/nsis/include/allowOnlyOneInstallerInstance.nsh -> _CHECK_APP_RUNNING
;   detecta la app buscando procesos cuya RUTA empiece en $INSTDIR. Selah Live
;   corre con ~5 procesos (principal + GPU + helpers de Electron). El chequeo
;   los mata y reintenta, pero solo 2 veces; si todavía detecta alguno hace:
;       MessageBox MB_RETRYCANCEL ... /SD IDCANCEL IDRETRY loop
;       Quit
;   En modo silencioso (que es como corre el auto-update) ese MessageBox se
;   auto-responde CANCELAR -> Quit sin pasar por quitSuccess -> el desinstalador
;   sale con EXIT CODE 2 -> el instalador muestra "Fallo al desinstalar
;   archivos antiguos.: 2" y aborta toda la actualización.
;
;   Encima, ese chequeo corre en un.onInit ANTES de customUnInit, así que el
;   taskkill que teníamos ahí llegaba siempre tarde.
;
; Solución: electron-builder permite REEMPLAZAR ese chequeo definiendo
; customCheckAppRunning (ver CHECK_APP_RUNNING: si el macro existe, usa el
; nuestro en vez del suyo). El nuestro mata a la fuerza y NUNCA aborta.
; Se usa tanto en el instalador como en el desinstalador.
; ══════════════════════════════════════════════════════════════════════════════
!macro matarSelahLive
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "Selah Live.exe" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  ; Espera final: aunque los procesos ya murieron, Windows tarda en soltar los
  ; handles de los .exe/.dll mapeados en memoria.
  Sleep 2500
!macroend

; ✅ Reemplaza el chequeo de "app corriendo" de electron-builder. Nunca hace
; Quit, así que nunca genera el exit code 2 que abortaba la actualización.
!macro customCheckAppRunning
  !insertmacro matarSelahLive
!macroend

; Refuerzo: al inicio del instalador nuevo (antes de desinstalar la vieja).
!macro customInit
  !insertmacro matarSelahLive
!macroend

; Refuerzo: al inicio del desinstalador viejo.
!macro customUnInit
  !insertmacro matarSelahLive
!macroend
