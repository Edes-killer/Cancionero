const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://dkufqtrfvduonsubmwka.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_publishable__mXNWhVZ9ZUWHjs1YWkpjw_CLMV2TLu';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const noMatchList = []
const mapeoManual = require("./mapeo_manual.json")
// 📁 JSON acordes
const acordesData = JSON.parse(
  fs.readFileSync("C:/adb/acordes_himnario.json", "utf8")
)

// ---------------- UTILIDADES ----------------

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function esLineaAcordes(linea) {
  const tokens = (linea || "")
    .replace(/([A-G][#b]?)/gi, " $1")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return false

  return tokens.every(t =>
    /^([A-G]|Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(m|maj|min|sus|dim|aug)?\d*(\/([A-G]|Do|Re|Mi|Fa|Sol|La|Si)(#|b)?)?$/i.test(t)
  )
}

// 🔥 FUNCIÓN CLAVE (como músicos)
function extraerBloquePorLetra(textoAcordes, textoLetra) {
  const lineas = textoAcordes.split("\n")
  const objetivo = normalizar(textoLetra)

  for (let i = 0; i < lineas.length; i++) {
    let acumulado = ""
    let j = i

    while (j < lineas.length) {
      const linea = lineas[j]

      if (!esLineaAcordes(linea)) {
        acumulado += " " + normalizar(linea)
      }

      // 🔍 usamos solo parte del texto para tolerancia
      if (acumulado.includes(objetivo.slice(0, 40))) {
        let inicio = i

        // incluir acordes arriba
        if (inicio > 0 && esLineaAcordes(lineas[inicio - 1])) {
          inicio--
        }

        let fin = j + 1

        // limpiar acordes sueltos abajo
        while (
          fin > inicio &&
          esLineaAcordes(lineas[fin - 1])
        ) {
          fin--
        }

        return lineas.slice(inicio, fin).join("\n").trim()
      }

      j++
    }
  }

  return null
}

function encontrarCancionPorContenido(item, canciones) {
  const normalizar = (t) =>
    (t || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase()

  const textoAcordes = normalizar(item.acordes)

  for (const c of canciones) {
    const primeraParte = c.partes?.[0]?.texto_letra
    if (!primeraParte) continue

    const muestra = normalizar(primeraParte).slice(0, 40)

    if (textoAcordes.includes(muestra)) {
      return c
    }
  }

  return null
}

function dividirEnBloques(texto) {
  const lineas = texto.split("\n")
  const bloques = []

  let actual = []

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (esLineaAcordes(linea)) {
      // nuevo bloque
      if (actual.length > 0) {
        bloques.push(actual.join("\n").trim())
        actual = []
      }
    }

    actual.push(linea)
  }

  if (actual.length > 0) {
    bloques.push(actual.join("\n").trim())
  }

  return bloques
}

// ---------------- MAIN ----------------

async function main() {
  console.log("🔥 reconstruyendo acordes (modo correcto)...")

  // traer canciones
  const { data: cancionesConPartes } = await supabase
  .from("canciones")
  .select(`
    *,
    partes_cancion (*)
  `)

  // mapa por título
 const mapa = new Map()

for (const c of cancionesConPartes) {
  mapa.set(normalizar(c.titulo), c)
}

  let ok = 0
  let sinMatch = 0
  let sinBloque = 0

  for (const item of acordesData) {
    const clave = normalizar(item.titulo)
    
  
let cancion = null

// 🔥 PRIORIDAD 1: mapeo manual
const tituloMapeado = mapeoManual[normalizar(item.titulo)]

if (tituloMapeado) {
  const claveMapeada = normalizar(tituloMapeado)

for (const [k, v] of mapa.entries()) {
  if (k.includes(claveMapeada) || claveMapeada.includes(k)) {
    cancion = v
    break
  }
}
}

console.log("MAPEO TEST:", normalizar(item.titulo))
// fallback título
if (!cancion) {
  console.log("❌ SIN MATCH REAL:", item.titulo)

  noMatchList.push({
    titulo_json: item.titulo,
    muestra: item.acordes.slice(0, 200)
  })

  sinMatch++
  continue
}

// fallback contenido

// 🔥 ESTA LÍNEA FALTABA (CRÍTICA)

    const partes = cancion.partes_cancion || []

if (partes.length === 0) {
  console.log("⚠️ sin partes:", cancion.titulo)
  continue
}

    for (const p of partes) {
      let bloque = extraerBloquePorLetra(
        item.acordes,
        p.texto_letra
      )

      if (!bloque) {
        // 🔥 fallback inteligente
        const bloques = dividirEnBloques(item.acordes)

        if (bloques[p.orden - 1]) {
          bloque = bloques[p.orden - 1]
        }
      }

      await supabase
        .from("partes_cancion")
        .update({
          texto_acordes: bloque,
          tiene_acordes: true
        })
        .eq("id", p.id)
    }

    ok++
  }

  console.log("\n🎉 TERMINADO")
  console.log("✅ OK:", ok)
  console.log("⚠️ sin match:", sinMatch)
  console.log("⚠️ sin bloque:", sinBloque)
  fs.writeFileSync(
  "no_match.json",
  JSON.stringify(noMatchList, null, 2)
)
console.log("noMatchList length:", noMatchList.length)
console.log("📁 archivo no_match.json generado")
}


main()



