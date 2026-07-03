const { createClient } = require("@supabase/supabase-js")
const fs = require("fs")

// ── REEMPLAZA ESTAS CREDENCIALES ──────────────────────────────────────────────
const SUPABASE_URL = "https://dkufqtrfvduonsubmwka.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable__mXNWhVZ9ZUWHjs1YWkpjw_CLMV2TLu"
// ─────────────────────────────────────────────────────────────────────────────

const SOLO_PREVIEW = false  // false = aplica en Supabase

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Extrae acordes y sus posiciones dentro del texto limpio de una línea
// "[Do]Dios es [Re]bueno" → [{acorde:"Do", pos:0}, {acorde:"Re", pos:8}]
// "longitudLimpia" = cuántos chars tiene la línea SIN los [acordes]
function extraerAcordes(linea) {
  const acordes = []
  let posLimpia = 0
  let i = 0
  while (i < linea.length) {
    if (linea[i] === "[") {
      const fin = linea.indexOf("]", i)
      if (fin !== -1) {
        acordes.push({ acorde: linea.slice(i + 1, fin), pos: posLimpia })
        i = fin + 1
        continue
      }
    }
    posLimpia++
    i++
  }
  const longitudLimpia = posLimpia
  return { acordes, longitudLimpia }
}

// Inserta acordes en una línea nueva a posiciones proporcionales
function insertarAcordes(lineaNueva, acordes, longitudLimpiaVieja) {
  if (!acordes.length) return lineaNueva

  const lonNueva = lineaNueva.length
  const lonOrig = longitudLimpiaVieja || lonNueva

  // Calcular posiciones proporcionales y ordenar de mayor a menor (insertar al revés)
  const posicionados = acordes
    .map(({ acorde, pos }) => ({
      acorde,
      posNueva: lonOrig > 0 ? Math.round((pos / lonOrig) * lonNueva) : pos
    }))
    .map(({ acorde, posNueva }) => ({
      acorde,
      posNueva: Math.min(posNueva, lonNueva)
    }))
    .sort((a, b) => b.posNueva - a.posNueva) // mayor a menor para insertar al revés

  let resultado = lineaNueva
  for (const { acorde, posNueva } of posicionados) {
    resultado = resultado.slice(0, posNueva) + `[${acorde}]` + resultado.slice(posNueva)
  }
  return resultado
}

// ── FUNCIÓN PRINCIPAL: texto es la base, acordes vienen de texto_acordes ──────
// Respeta las líneas de `textoNuevo` (la letra correcta)
// Para cada línea, busca acordes en la línea CORRESPONDIENTE de `textoViejo`
function reconstruir(textoViejo, textoNuevo) {
  const lineasViejas = (textoViejo || "").split(/\r?\n/)
  const lineasNuevas = (textoNuevo || "").split(/\r?\n/)

  const lineasResultado = lineasNuevas.map((lineaNueva, i) => {
    const lineaVieja = lineasViejas[i] || ""
    const { acordes, longitudLimpia } = extraerAcordes(lineaVieja)

    if (!acordes.length) {
      // Sin acordes en esa línea → letra nueva tal cual
      return lineaNueva
    }

    // Insertar acordes de la línea vieja en la letra nueva
    return insertarAcordes(lineaNueva, acordes, longitudLimpia)
  })

  return lineasResultado.join("\n")
}

function limpiar(t) { return (t || "").trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n") }
function sonDiferentes(a, b) { return limpiar(a) !== limpiar(b) }

async function main() {
  console.log("🔍 Buscando partes con diferencias...\n")

  const { data: partes, error } = await supabase
    .from("partes_cancion")
    .select("id, cancion_id, tipo, texto, texto_acordes, orden")
    .not("texto_acordes", "is", null)
    .neq("texto_acordes", "")

  if (error) { console.error("❌", error.message); process.exit(1) }

  const partesDif = partes.filter(p => sonDiferentes(p.texto, p.texto_acordes))
  console.log(`📋 ${partesDif.length} partes con diferencias\n`)
  if (!partesDif.length) { console.log("✅ Todo sincronizado"); return }

  // Títulos
  const ids = [...new Set(partesDif.map(p => p.cancion_id))]
  const { data: canciones } = await supabase
    .from("canciones").select("id, titulo, numero").in("id", ids)
  const titulos = new Map(canciones.map(c => [c.id, c.numero ? `${c.numero}. ${c.titulo}` : c.titulo]))

  const updates = []
  const logLineas = ["CORRECCIÓN DE ACORDES — " + new Date().toLocaleString("es-ES"), ""]

  partesDif.forEach(parte => {
    const titulo = titulos.get(parte.cancion_id) || parte.cancion_id
    const resultado = reconstruir(parte.texto_acordes, parte.texto)

    logLineas.push(`══ ${titulo} [${parte.tipo || "Parte"}] ══`)
    logLineas.push("ANTES (texto_acordes):")
    logLineas.push(parte.texto_acordes || "")
    logLineas.push("")
    logLineas.push("NUEVO (acordes de antes + letra correcta de texto):")
    logLineas.push(resultado)
    logLineas.push("")

    updates.push({ id: parte.id, texto_acordes: resultado })
  })

  const logFile = `correccion_${new Date().toISOString().slice(0, 10)}.log`
  fs.writeFileSync(logFile, logLineas.join("\n"), "utf-8")
  console.log(`📄 Preview guardado en: ${logFile}`)
  console.log(`   Revísalo antes de aplicar\n`)

  if (SOLO_PREVIEW) {
    console.log("⚠️  MODO PREVIEW — sin cambios en Supabase")
    console.log("   Cambia SOLO_PREVIEW = false para aplicar")
    return
  }

  // Aplicar
  console.log(`🔄 Actualizando ${updates.length} partes...`)
  let ok = 0, fail = 0
  for (const upd of updates) {
    const { error: e } = await supabase
      .from("partes_cancion")
      .update({ texto_acordes: upd.texto_acordes })
      .eq("id", upd.id)
    if (e) { console.error(`  ❌ ${upd.id}:`, e.message); fail++ }
    else { ok++; process.stdout.write(`\r  ✅ ${ok}/${updates.length}`) }
  }
  console.log(`\n\n🎉 ${ok} actualizadas, ${fail} errores`)
}

main().catch(e => { console.error("❌", e.message); process.exit(1) })