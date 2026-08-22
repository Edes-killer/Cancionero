# Cómo publicar una versión de Selah Live

Guía para sacar una versión nueva (escritorio **y** celular). Todo sale de **un
solo número**: la `version` en `package.json`.

---

## Paso 0 — Subir la versión (la fuente única)

En `package.json`, línea 3, cambia el número:

```json
  "version": "0.5.26",
```

O por comando:

```bash
npm version 0.5.26 --no-git-tag-version
```

> De ese número salen solos: el `.exe`, la versión del APK, y el `version.json`
> que dispara el aviso de actualización en los celulares.

---

## Paso 1 — Commit + push

```bash
git add -A
git commit -m "chore: 0.5.26"
git push
```

Esto publica el nuevo `version.json` en GitHub → los celulares con versión vieja
verán el aviso al abrir (GitHub tarda ~5 min en refrescar el archivo).

---

## Paso 2 — Compilar y publicar el .exe (escritorio)

En **PowerShell** (necesita tu token de GitHub):

```powershell
$env:GH_TOKEN = "TU_TOKEN"
```
```powershell
npm run electron:build:win
```

Crea el release **vX.Y.Z como borrador** en GitHub con el `.exe` y `latest.yml`.

> El token es un GitHub PAT classic con scope `repo`. **Vencen** — si falla el
> publish, regenera uno en github.com/settings/tokens.

---

## Paso 3 — Compilar el APK (celular)

```bash
npm run apk
```

Deja **`selah-live.apk`** (firmado con el keystore de release) en la raíz.
Debe decir **"✅ Listo"** — si dice "SIN FIRMAR", revisar el keystore.

> Usa SIEMPRE `npm run apk` (release), **nunca** `apk:debug` para lo que subas.
> Todas las release comparten el mismo keystore → se instalan encima sin desinstalar.

---

## Paso 4 — Subir el APK al release y publicar

1. Ve a **github.com/Edes-killer/Cancionero/releases**
2. Abre el borrador **vX.Y.Z** (arriba, recién creado por el paso 2) → lápiz ✏️
3. Arrastra **`selah-live.apk`** a los assets (junto al `.exe`)
4. Baja y dale a **"Publish release"** (botón verde)

Listo. `latest/download/selah-live.apk` ya apunta a la versión nueva.

---

## Qué pasa después

- **Escritorio:** las iglesias con Electron se actualizan solas.
- **Celular:** al abrir la app, ven "🔄 Hay una versión nueva" → botón "Actualizar"
  → Chrome baja el APK → instalar (encima de la anterior, misma firma).

---

## Cosas que NO hay que olvidar

- **Respalda el keystore** fuera de este PC (Drive/USB): `android/app/selah-live-release.keystore`
  + la contraseña (`android/keystore.properties`) + alias `selah-live`. Si lo pierdes,
  **no podrás volver a actualizar** los celulares ya instalados.
- **Nunca crees un release solo-APK** (sin el `.exe`): el auto-update de escritorio se
  guía por el mismo release y daría error si no encuentra el `.exe`/`latest.yml`.
- **Firma:** debug → release necesita desinstalar; release → release se instala encima.
  Para las iglesias, siempre release.
- **Firewall (conexión del celular):** en cada PC de iglesia, la instalación MANUAL
  abre el firewall sola (UAC una vez), o Config → "Reparar" en escritorio.
- Los **borradores viejos** (0.3.x de junio) en Releases son basura — se pueden borrar.

---

## Resumen ultra-corto

```
1. package.json → nuevo número
2. git add -A && git commit -m "chore: X.Y.Z" && git push
3. $env:GH_TOKEN="..." ; npm run electron:build:win
4. npm run apk
5. GitHub → release → subir selah-live.apk → Publish
```
