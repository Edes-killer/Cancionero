; ══════════════════════════════════════════════════════════════════════════════
; ARREGLO DEL "Fallo al desinstalar archivos antiguos de la aplicación.: 2"
;
; CAUSA REAL (leída del código de electron-builder, templates/nsis/):
;
; 1) uninstaller.nsh (líneas ~164-180): cuando es una ACTUALIZACIÓN
;    (${isUpdated}), el desinstalador NO borra los archivos: llama a
;    un.atomicRMDir, que intenta MOVER/RENOMBRAR cada archivo de $INSTDIR a
;    una carpeta temporal. Si UN SOLO archivo está ocupado (p.ej. el .exe de
;    la app, que Windows mantiene mapeado en memoria un rato tras cerrarla):
;        DetailPrint "File is busy, aborting: $R0"
;        Abort `Can't rename "$INSTDIR" ...`
;    Ese Abort sale SIN pasar por quitSuccess -> el desinstalador devuelve
;    EXIT CODE 2 (ver common.nsh: "# avoid exit code 2").
;
; 2) installUtil.nsh (handleUninstallResult): el instalador ve ese 2 y hace
;    MessageBox "$(uninstallFailed): $R0" + SetErrorLevel 2 + Quit
;    -> aborta TODA la actualización. Eso es lo que veía el usuario.
;
; SOLUCIÓN (dos frentes):
;   A) customUnInstallCheck / customUnInstallCheckCurrentUser -> hacen que
;      handleUninstallResult RETORNE antes del chequeo de error, o sea que el
;      instalador nuevo IGNORA el fallo del desinstalador viejo y sigue
;      instalando (sobreescribe los archivos igual). Esto vive en el instalador
;      NUEVO, así que aplica de inmediato, sin esperar otra versión.
;   B) customRemoveFiles -> reemplaza el atomicRMDir que aborta por un borrado
;      normal que NO aborta. Así los desinstaladores futuros dejan de fallar.
; ══════════════════════════════════════════════════════════════════════════════

!macro matarSelahLive
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "Selah Live.exe" /T'
  Sleep 800
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  ; Windows tarda en soltar los .exe/.dll mapeados aunque el proceso ya murió.
  Sleep 2500
!macroend

; ── A) El instalador NO debe abortar si el desinstalador viejo falla ──────────
; handleUninstallResult retorna apenas inserta estos macros, salteándose el
; MessageBox de error y el SetErrorLevel 2 + Quit.
!macro customUnInstallCheck
  DetailPrint "Continuando con la instalación (limpieza de la versión anterior omitida)."
!macroend

!macro customUnInstallCheckCurrentUser
  DetailPrint "Continuando con la instalación (limpieza de la versión anterior omitida)."
!macroend

; ── B) Borrado de archivos que NO aborta ─────────────────────────────────────
; Reemplaza el bloque atomicRMDir/Abort del desinstalador.
!macro customRemoveFiles
  ; un.onInit hace SetOutPath $INSTDIR, lo que deja la carpeta "en uso" por el
  ; propio desinstalador. Hay que salir antes de intentar borrarla.
  SetOutPath $TEMP
  !insertmacro matarSelahLive
  ; RMDir /r borra lo que puede y sigue; NO aborta si algo quedó ocupado.
  RMDir /r "$INSTDIR"
!macroend

; ── Reemplaza el chequeo de "app corriendo" (nunca aborta) ───────────────────
!macro customCheckAppRunning
  !insertmacro matarSelahLive
!macroend

!macro customInit
  !insertmacro matarSelahLive
!macroend

!macro customUnInit
  !insertmacro matarSelahLive
!macroend
