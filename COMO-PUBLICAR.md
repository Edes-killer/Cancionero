# Cómo publicar una versión de Selah Live

Todo sale de **un número**: la `version` en `package.json`.

Hay **dos tipos de actualización** para el celular:

| Tipo de cambio | Canal | Qué hace el usuario |
|---|---|---|
| **Solo web** (React/JS: pantallas, arreglos, lógica) | **OTA** | Al abrir, "Actualización lista → Aplicar". **Sin reinstalar.** |
| **Nativo** (plugin/permiso nuevo de Capacitor) | **APK** | "Hay versión nueva → Actualizar" → descarga e instala el APK. |

> El **95%** de los cambios son solo-web → van por **OTA** (rápido, sin reinstalar).
> El escritorio (Electron) siempre se actualiza solo con el `.exe`.

---

## Release SOLO-WEB (lo normal)

1. **Sube la versión** en `package.json` (deja `minApk` igual):
   ```json
   "version": "0.5.27",
   "minApk": "0.5.26",
   ```
2. **Commit + push** (actualiza `version.json` y `ota.json` en GitHub):
   ```bash
   git add -A && git commit -m "chore: 0.5.27" && git push
   ```
3. **Compila** los 3 artefactos:
   ```bash
   $env:GH_TOKEN = "TU_TOKEN"   # PowerShell
   npm run electron:build:win   # .exe (crea el release)
   npm run apk                  # selah-live.apk
   npm run ota                  # bundle.zip (la parte web para el OTA)
   ```
4. **Sube al release** vX.Y.Z (github.com/Edes-killer/Cancionero/releases → ✏️):
   arrastra **`selah-live.apk`** y **`bundle.zip`** (junto al `.exe`).
5. **Publish release**.

Resultado:
- **Celulares** → al abrir, "Actualización lista" → Aplicar (OTA, sin reinstalar).
- **Escritorio** → se actualiza solo con el `.exe`.

---

## Release con cambio NATIVO (plugin/permiso nuevo)

Cuando agregas un plugin de Capacitor o cambias permisos, el OTA **no basta** — hace
falta un APK nuevo. Ahí, además de subir `version`, **sube también `minApk`** al mismo
número:

```json
"version": "0.5.30",
"minApk": "0.5.30",
```

Con eso, el aviso de **"instala el APK nuevo"** aparece en los celulares (además del
OTA). El resto del flujo es igual (pasos 2-5).

> Regla simple: **¿tocaste algo en `android/`, `capacitor.config.ts`, o agregaste un
> plugin?** → sube `minApk`. Si solo tocaste código web → deja `minApk` igual.

---

## Cosas que NO hay que olvidar

- **Respalda el keystore** fuera del PC: `android/app/selah-live-release.keystore` +
  contraseña (`android/keystore.properties`) + alias `selah-live`. Sin él no se puede
  actualizar la APK nunca más.
- **Nunca release solo-APK** sin el `.exe`: el auto-update de escritorio se guía por el
  mismo release y daría error si no encuentra el `.exe`/`latest.yml`.
- **Firma:** debug → release exige desinstalar; release → release instala encima.
- **GitHub raw cachea ~5 min** los manifiestos → el aviso puede tardar unos minutos.
- Los **assets** del release deben llamarse EXACTO: `selah-live.apk` y `bundle.zip`.

---

## Resumen ultra-corto (release solo-web)

```
1. package.json → sube "version" (deja "minApk")
2. git add -A && git commit -m "chore: X.Y.Z" && git push
3. $env:GH_TOKEN="..." ; npm run electron:build:win ; npm run apk ; npm run ota
4. GitHub → release → subir selah-live.apk + bundle.zip → Publish
```
