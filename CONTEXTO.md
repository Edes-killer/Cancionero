# INSTRUCCIONES PARA CLAUDE

- Responde en español, con tono técnico, directo y práctico.
- Este proyecto ya tiene bastante trabajo avanzado. **No propongas rehacer la arquitectura** salvo que haya una razón fuerte y explícita.
- Prioriza **cambios quirúrgicos**, paso a paso, y evita repetir instrucciones ya dadas.
- Asume que el usuario suele ejecutar inmediatamente los pasos sugeridos. Si no indica lo contrario, **asume que ya hizo los cambios anteriores**.
- Antes de sugerir refactors grandes, **diagnostica con precisión** el problema actual.
- Si algo no está confirmado en este archivo, dilo claramente en vez de inventarlo.
- Cuando propongas cambios en código, intenta dar **bloques exactos para reemplazar**, con texto buscable.
- Respeta estas decisiones del proyecto:
  - Mantener el himnario y canciones dentro de la estructura actual `canciones` + `partes_cancion`.
  - Las alabanzas base del himnario deben quedar **globales para toda iglesia** (`iglesia_id = null`).
  - Evitar agregar tablas nuevas si se puede resolver bien con el esquema existente.
  - Preferir UX móvil práctica para uso real en culto.
- Antes de sugerir cambios contradictorios con decisiones previas, revisa la sección **DECISIONES TÉCNICAS IMPORTANTES**.

---

# 1. STACK TÉCNICO

## Frontend
- **Next.js 16.2.4**
- React con App Router (`app/...`)
- TypeScript / TSX
- Estilos inline con `CSSProperties`
- Cliente Supabase en frontend con `@supabase/supabase-js`
- En algunas rutas/auth se trabajó con `@supabase/ssr`

## Backend / tiempo real
- **Socket.IO**
- Servidor socket separado en `server/index.js` (reinicio manual en desarrollo cuando cambia lógica)
- Comunicación por `http://<hostname>:4000`

## Base de datos / backend cloud
- **Supabase**
- PostgreSQL
- Auth de Supabase con Google
- Storage de Supabase para imágenes/logo

## Herramientas auxiliares usadas
- Node.js local para scripts de importación
- Python local para scraping/exportación
- ADB + SQLite para extraer datos de app Android del himnario
- Java local para pruebas con ABE (`abe-540a57d.jar`)

## Versiones vistas explícitamente
- Next.js: **16.2.4**
- Java: **1.8.0_491**
- Node.js: **v24.14.0**
- Python local visto en logs: **3.14**

---

# 2. ARQUITECTURA

## Estructura general del proyecto (conocida)
No se tiene un árbol completo del repo, pero sí esta estructura funcional:

- `app/`
  - `page.tsx` → Inicio
  - `login/page.tsx`
  - `control/page.tsx`
  - `proyectar/page.tsx`
  - `musicos/page.tsx`
  - `canciones/page.tsx`
  - `auth/callback/route.ts` (flujo OAuth)
- `lib/`
  - `supabase.ts`
  - `supabaseServer.ts`
- `server/`
  - `index.js` → servidor Socket.IO
- scripts auxiliares locales fuera del proyecto:
  - `importar_final.js`
  - `scraping_acordes.py`
  - `cruzar.py`
  - varios JSON de himnario

## Comunicación entre partes

### Next.js + Socket.IO + Supabase
- **Supabase** guarda usuarios, iglesias, canciones, partes, listas de culto y recursos persistentes.
- **Socket.IO** sincroniza en tiempo real lo que el operador hace en `/control` con las pantallas `/proyectar` y `/musicos`.
- **Next.js** maneja UI, auth y consultas a Supabase.

## Flujo funcional

### `/control`
Pantalla operativa principal.
- Busca canciones en Supabase
- Arma la lista de culto
- Emite eventos por socket para proyectar canciones, Biblia, imágenes y estados especiales
- Gestiona cultos guardados
- Abre `/proyectar` y `/musicos`

### `/proyectar`
Pantalla pública.
- Recibe eventos por socket
- Muestra letras limpias, Biblia, imágenes, estados especiales
- Tiene transición overlay negra entre cambios
- No muestra navbar

### `/musicos`
Pantalla de músicos.
- Recibe eventos por socket
- Muestra acordes/letra
- Permite transposición
- Permite escala latina/americana
- Permite ocultar/mostrar acordes
- No muestra navbar

---

# 3. BASE DE DATOS SUPABASE

## Tablas conocidas

### `public.canciones`
- `id uuid PK default gen_random_uuid()`
- `iglesia_id uuid default gen_random_uuid()` *(en uso real: para himnario base se usa `null`)*
- `titulo text not null`
- `autor text` *(legado; se quiere reemplazar por `categoria`)*
- `tono text`
- `fecha_creacion timestamp default now()`
- `categoria text` *(agregada después)*
- `numero integer` *(agregada después)*

### `public.iglesias`
- `id uuid PK default gen_random_uuid()`
- `nombre text not null`
- `creado_en timestamp default now()`
- `logo_url text`
- `logo_nombre text`

### `public.items_lista`
- `id uuid PK default gen_random_uuid()`
- `lista_id uuid not null`
- `cancion_id uuid`
- `orden bigint`
- `referencia_biblica text`
- `texto_biblico text`
- `tipo text`
- `imagen_url text`
- `estado_modo text`
- `estado_titulo text`
- `estado_subtitulo text`
- `estado_url text`

Relaciones:
- `lista_id -> listas_culto(id)`
- `cancion_id -> canciones(id)`

### `public.listas_culto`
- `id uuid PK default gen_random_uuid()`
- `nombre text not null`
- `fecha date`
- `iglesia_id uuid`

### `public.partes_cancion`
- `id uuid PK default gen_random_uuid()`
- `cancion_id uuid not null`
- `tipo text`
- `texto text`
- `orden bigint`
- `texto_letra text`
- `texto_acordes text`
- `tiene_acordes boolean default false`

Relación:
- `cancion_id -> canciones(id)`

### `public.usuarios_iglesia`
- `id uuid PK default gen_random_uuid()`
- `user_id uuid`
- `iglesia_id uuid`
- `creado_en timestamp default now()`

Relaciones:
- `user_id -> auth.users(id)`
- `iglesia_id -> iglesias(id)`

## RLS policies
- **No documentadas en este contexto.**
- Se sabe que el proyecto usa auth Supabase y relación usuario/iglesia, pero las políticas exactas no fueron compartidas.

## Functions / triggers
- **No documentados en este contexto.**
- No hay evidencia de triggers custom discutidos.

---

# 4. SOCKET.IO

## Eventos identificados

### Emitidos desde `/control`
- `cargar-cancion`
- `cambiar-parte`
- `mostrar-biblia`
- `cambiar-pagina-biblia`
- `mostrar-imagen`
- `mostrar-estado`

También se usa sincronización de navegación / estado activo:
- `cancion-activa`
- `control-siguiente`
- `control-anterior`

## Recibidos en `/proyectar`
- `cargar-cancion`
  - payload:
    - `partes`
    - `index`
    - `titulo`
    - `tono`
    - `iglesia`
- `cambiar-parte`
  - payload: índice numérico
- `mostrar-biblia`
  - payload con contenido bíblico y `pagina`
- `cambiar-pagina-biblia`
  - payload: número de página
- `mostrar-imagen`
  - payload:
    - `url`
    - `iglesia`
- `mostrar-estado`
  - payload:
    - `tipo`
    - `titulo`
    - `subtitulo`
    - `url`

## Recibidos en `/musicos`
- `cargar-cancion`
  - payload:
    - `partes`
    - `index`
    - `titulo`
    - `tono`
- `cambiar-parte`
  - payload: índice numérico

## Recibidos en `/control`
- `cancion-activa`
  - payload:
    - `id`
- `control-siguiente`
- `control-anterior`

## Uso funcional de eventos
- `/control` manda el estado
- `/proyectar` refleja al público
- `/musicos` refleja versión con acordes/transposición
- `server/index.js` es el intermediario

---

# 5. PÁGINAS Y COMPONENTES

## `app/login/page.tsx`
- Login con Google por Supabase
- Se trabajó bastante el callback y problemas de PKCE
- Hubo problemas de `PKCE code verifier missing`
- Se solucionó alinear cliente/SSR y callback real

## `app/control/page.tsx`
Pantalla operativa principal.

### Funcionalidad
- Buscar canciones
- Filtrar por tono
- Construir lista de culto
- Reordenar lista
- Proyectar elementos
- Guardar, cargar, renombrar y duplicar cultos
- Manejo móvil mejorado
- Accesos para abrir `/proyectar` y `/musicos`

### Estado local relevante
Hay muchos `useState` y `useEffect`; lo importante:
- `lista`
- `indiceLista`
- `indiceActivoLista`
- `activaId`
- `partes`
- `index`
- `socket`
- `busqueda`
- `filtroTono`
- `mensajeRapido`
- `logoEsperaUrl`
- `logoEsperaNombre`
- `cultos`
- `listaIdActual`
- `nombreCulto`
- `isMobile`
- estados de paneles plegables en móvil
- estados para menús `⋮`

### Lógica de negocio importante
- Si `listaIdActual` existe, se está editando un culto guardado
- Estados especiales (`negro`, `espera`, `logo`, `mensaje`) se guardan en `items_lista`
- Himnario base debe quedar global (`iglesia_id = null`)
- En móvil, `Lista de Culto` va primero

## `app/proyectar/page.tsx`
Pantalla pública.

### Funcionalidad
- Render de canción limpia
- Render de imagen
- Render de Biblia paginada
- Render de estado especial
- Fade de transición usando overlay negro
- Oculta acordes
- Estados especiales no deben bloquear luego otras proyecciones

### Decisiones importantes
- La transición buena fue: negro instantáneo + reveal
- El overlay actual fue la solución que sí funcionó
- Problema pendiente: mensajes demasiado largos pueden saturar

## `app/musicos/page.tsx`
Pantalla de músicos.

### Funcionalidad
- Recibe canción por socket
- Detecta formato con corchetes o línea superior de acordes
- Transpone acordes
- Escala latina / americana
- Toggle mostrar/ocultar acordes

### Estado relevante
- `partes`
- `index`
- `titulo`
- `tono`
- `transposicion`
- `mostrarAcordes`
- `usarAmericano`

### Lógica importante
Actualmente procesa:
- `parte.texto`
- No estaba leyendo bien `texto_acordes`
- Necesita usar prioridad:
  - `texto_acordes` si existe
  - si no, `texto`

## `app/canciones/page.tsx`
No se tiene el archivo completo aquí, pero se sabe:
- Crea/edita canciones
- Problema actual: al editar himnos con acordes no necesariamente usa `texto_acordes`
- Debe migrarse para trabajar con `categoria` en lugar de `autor`

## Navbar
- No se muestra en `/proyectar` ni `/musicos`
- Se simplificó para uso real:
  - `Inicio`
  - `Canciones`
  - `Control`
  - botón pequeño `Salir`
- Se quitaron `Proyectar` y `Músicos` del nav general por flujo UX

---

# 6. DATOS DEL HIMNARIO

## Fuente de datos
Se trabajó offline extrayendo información desde una app Android / recursos varios.

### Fuentes usadas
- `himnario.cl/apk/himnario.db` descargado por URL
- base SQLite local exportada con Python
- `alabanzas.json` con 1388 registros
- `alabanzas_tipo.json` con asignaciones temáticas por número, a veces múltiples por himno
- `acordes_himnario.json` scrapeado desde aleguitarra / web, 241 himnos con acordes según logs

## Estructura de `alabanzas.json`
Campos observados:
- `numero`
- `tono`
- `tiempo`
- `categoria`
- `titulo`
- `texto`

Observaciones:
- `texto` usa delimitadores `||` entre estrofas y `|` entre líneas
- algunos coros vienen embebidos como `{CORO|...|}`

## Estructura de `alabanzas_tipo.json`
Campos:
- `numero`
- `tipo`

Observaciones:
- un mismo himno puede tener múltiples tipos:
  - `Predicacion`
  - `Devocional`
  - `Congregacional`
  - `Funebre`
- debe combinarse en una sola cadena de categoría, no sobrescribirse

## Estructura de `acordes_himnario.json`
Campos observados:
- `numero`
- `titulo`
- `url`
- `acordes`

## Estado actual del himnario en Supabase
- Se intentó importar globalmente a `canciones` y `partes_cancion`
- Se añadieron columnas `numero` y `categoria` a `canciones`
- Problema detectado:
  - cruzar acordes por `numero` es incorrecto porque la numeración de `acordes_himnario.json` no coincide con `alabanzas.json`
  - además el importador estaba metiendo el bloque completo de acordes en cada parte
- Importación correcta pendiente:
  1. importar letras/partes limpias
  2. después enriquecer con acordes por coincidencia confiable de título

---

# 7. FUNCIONALIDADES IMPLEMENTADAS

## Autenticación
- Login con Google funcionando
- Callback corregido
- Rutas protegidas funcionando razonablemente

## Control de culto
- Buscar canciones
- Filtrar por tono
- Agregar a lista de culto
- Reordenar lista
- Guardar culto
- Cargar culto
- Renombrar culto
- Duplicar culto
- Estado visual de “editando culto guardado”
- Menús móviles `⋮` en lista y cultos guardados
- Diseño móvil mejorado con paneles plegables

## Proyección
- Proyectar canción
- Siguiente/anterior
- Proyectar Biblia
- Proyectar imagen
- Proyectar estados:
  - negro
  - espera
  - logo
  - mensaje
- Transición visual con overlay negro funcionando bien

## Músicos
- Recepción por socket
- Mostrar acordes/letra en formato iglesia/corchetes
- Transposición
- Escala latina/americana
- Toggle ocultar/mostrar acordes

## Lista de culto
- Soporta:
  - canciones
  - Biblia
  - imágenes
  - estados especiales
- Guardado en `listas_culto` + `items_lista`
- Soporte móvil mejorado

## Himnario / importación
- Extracción de base local
- Exportación JSON
- Cruce parcial con acordes
- Importación masiva casi completa a Supabase
- Global para toda iglesia (`iglesia_id = null`) como decisión de producto

---

# 8. FUNCIONALIDADES PENDIENTES

## Alta prioridad
- Reimportar himnario correctamente:
  - letras limpias por partes
  - `numero`
  - `categoria`
  - global para toda iglesia
- Segunda fase de acordes:
  - cruzar por título normalizado, no por número
  - no repetir himno completo en cada parte

## UI / lógica
- `musicos/page.tsx` debe usar `texto_acordes` cuando exista
- `canciones/page.tsx` debe soportar edición coherente de canciones con acordes
- `control/page.tsx` debe filtrar también por:
  - número
  - categoría
  - título
  - tono
- `control/page.tsx` debe mostrar `numero + titulo` y `categoria • tono`

## Ajustes pendientes o diferidos
- mensaje largo en `/proyectar` todavía puede saturar
- feedback visual al agregar canción a lista fue discutido pero no quedó definitivo
- posible mejora futura para dividir acordes por verso/coro de verdad
- revisar checklist de producción / despliegue

---

# 9. DECISIONES TÉCNICAS IMPORTANTES

- **No crear tablas nuevas para himnario** si se puede resolver con `canciones` y `partes_cancion`.
- Las alabanzas base deben estar **disponibles para todas las iglesias**, usando `iglesia_id = null`.
- `autor` queda legado; el campo correcto a futuro es `categoria`.
- `numero` debe vivir en columna propia, no incrustado en `titulo`.
- En móvil, la UX debe priorizar uso real en culto:
  - `Lista de Culto` primero
  - controles prácticos
  - menos saturación
- `Proyectar` y `Músicos` no deben estar en el navbar general; se abren desde `Control`.
- Cambios grandes deben hacerse por fases:
  1. base limpia
  2. luego acordes
- No volver a recomendar pasos ya ejecutados sin motivo.

---

# 10. CONVENCIONES DE CÓDIGO

## Estilo general
- Mucho uso de estilos inline con `CSSProperties`
- Nombres en español para lógica de negocio
- Nombres de UI claros y funcionales

## Variables / estado comunes
- `lista`
- `partes`
- `index`
- `titulo`
- `tono`
- `busqueda`
- `filtroTono`
- `nombreCulto`
- `listaIdActual`
- `activaId`
- `indiceActivoLista`
- `mostrarAcordes`
- `usarAmericano`

## Patrones comunes
- Helpers pequeños cerca del componente
- Reemplazos quirúrgicos de bloques concretos
- Mucho uso de `useEffect` con listeners Socket.IO
- Socket creado con:
  - `io("http://" + window.location.hostname + ":4000")`
- `window.location.href = "/login"` para redirección simple
- `window.open("/proyectar", "_blank")` y `window.open("/musicos", "_blank")`

## Patrones de datos
- `tipo` en partes:
  - preferido: `Verso` / `Coro`
- `items_lista.tipo`:
  - `cancion`
  - `biblia`
  - `imagen`
  - `estado`
- `estado.modo`:
  - `negro`
  - `espera`
  - `mensaje`
  - `logo`

---

# SESIÓN ACTUAL

