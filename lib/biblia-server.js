// Módulo compartido de búsqueda bíblica local, usado tanto por app/server/index.js
// (servidor web/móvil) como por electron/main.js (servidor embebido de escritorio).
// Cada uno inyecta su propia lista de directorios donde buscar los libros
// (las rutas de recursos difieren entre Electron empaquetado y Node plano).
const fs = require("fs")
const path = require("path")

const LIBROS = {
  genesis:"genesis",gen:"genesis",exodo:"exodo","éxodo":"exodo",ex:"exodo",
  levitico:"levitico","levítico":"levitico",lev:"levitico",numeros:"numeros",
  "números":"numeros",num:"numeros",deuteronomio:"deuteronomio",deut:"deuteronomio",
  dt:"deuteronomio",josue:"josue","josué":"josue",jos:"josue",jueces:"jueces",
  rut:"rut","1 samuel":"1_samuel","2 samuel":"2_samuel","1 reyes":"1_reyes",
  "2 reyes":"2_reyes","1 cronicas":"1_cronicas","1 crónicas":"1_cronicas",
  "2 cronicas":"2_cronicas","2 crónicas":"2_cronicas",esdras:"esdras",
  nehemias:"nehemias","nehemías":"nehemias",ester:"ester",job:"job",
  salmos:"salmos",salmo:"salmos",proverbios:"proverbios",eclesiastes:"eclesiastes",
  "eclesiastés":"eclesiastes",cantares:"cantares",isaias:"isaias","isaías":"isaias",
  jeremias:"jeremias","jeremías":"jeremias",lamentaciones:"lamentaciones",
  ezequiel:"ezequiel",daniel:"daniel",oseas:"oseas",joel:"joel",amos:"amos",
  abdias:"abdias","abdías":"abdias",jonas:"jonas","jonás":"jonas",miqueas:"miqueas",
  nahum:"nahum",habacuc:"habacuc",sofonias:"sofonias","sofonías":"sofonias",
  hageo:"hageo",zacarias:"zacarias","zacarías":"zacarias",malaquias:"malaquias",
  "malaquías":"malaquias",mateo:"mateo",marcos:"marcos",lucas:"lucas",juan:"juan",
  hechos:"hechos",romanos:"romanos","1 corintios":"1_corintios",
  "2 corintios":"2_corintios",galatas:"galatas","gálatas":"galatas",
  efesios:"efesios",filipenses:"filipenses",colosenses:"colosenses",
  "1 tesalonicenses":"1_tesalonicenses","2 tesalonicenses":"2_tesalonicenses",
  "1 timoteo":"1_timoteo","2 timoteo":"2_timoteo",tito:"tito",filemon:"filemon",
  "filemón":"filemon",hebreos:"hebreos",santiago:"santiago","1 pedro":"1_pedro",
  "2 pedro":"2_pedro","1 juan":"1_juan","2 juan":"2_juan","3 juan":"3_juan",
  judas:"judas",apocalipsis:"apocalipsis"
}

const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim()
const limpiarT = t => t.replace(/\/n/g," ").replace(/\\n/g," ").replace(/\r?\n|\r/g," ").replace(/\s+/g," ").trim()

function partirEnPaginas(texto, max=650) {
  const ps = texto.split(" "), pags = []
  let cur = ""
  for (const p of ps) {
    const c = cur ? `${cur} ${p}` : p
    if (c.length > max) { if (cur) pags.push(cur); cur = p } else cur = c
  }
  if (cur) pags.push(cur)
  return pags
}

function parsearRef(ref) {
  const s = ref.trim()
  let m = s.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
  if (m) {
    const a = LIBROS[norm(m[1])]; if (!a) return null
    return { tipo:"rango", libroMostrar:m[1], archivo:a, capitulo:+m[2], versoInicio:+m[3], versoFin:m[4]?+m[4]:+m[3] }
  }
  m = s.match(/^(.+?)\s+(\d+)$/)
  if (m) { const a = LIBROS[norm(m[1])]; if (!a) return null; return { tipo:"capitulo", libroMostrar:m[1], archivo:a, capitulo:+m[2] } }
  return null
}

function cargarLibro(archivo, dirs) {
  for (const dir of dirs) {
    for (const ext of [".json",".js"]) {
      try {
        const fp = path.join(dir, archivo+ext)
        if (!fs.existsSync(fp)) continue
        if (ext===".json") return JSON.parse(fs.readFileSync(fp,"utf8"))
        let c = fs.readFileSync(fp,"utf8").replace(/^\s*export\s+default\s+/,"module.exports = ").replace(/;\s*$/,"")
        const m = { exports:{} }; new Function("module","exports","require",c)(m,m.exports,require)
        const r = Array.isArray(m.exports)?m.exports:Object.values(m.exports)[0]
        if (r) return r
      } catch(e) { /* probar siguiente directorio/extensión */ }
    }
  }
  return null
}

function buscarVersiculosLocal(referencia, dirs) {
  const ref = parsearRef(referencia)
  if (!ref) throw new Error("Referencia inválida. Ejemplo: Juan 3:16 o Salmo 23")
  const b = cargarLibro(ref.archivo, dirs)
  if (!b) throw new Error(`Libro no encontrado: ${ref.archivo}`)
  const cap = b[ref.capitulo-1]
  if (!cap) throw new Error(`No existe el capítulo ${ref.capitulo}`)
  if (ref.tipo==="capitulo") {
    const vs = cap.map((t,i)=>({numero:i+1,texto:limpiarT(t)}))
    const txt = vs.map(v=>`${v.numero}. ${v.texto}`).join(" ")
    return { referencia:referencia.toUpperCase(), texto:txt, versos:vs, paginas:partirEnPaginas(txt) }
  }
  const vs = []
  for (let i=ref.versoInicio;i<=ref.versoFin;i++) {
    const v=cap[i-1]; if(!v) throw new Error(`No existe el versículo ${i}`)
    vs.push({numero:i,texto:limpiarT(v)})
  }
  const txt = vs.map(v=>`${v.numero}. ${v.texto}`).join(" ")
  return { referencia:referencia.toUpperCase(), texto:txt, versos:vs, paginas:partirEnPaginas(txt) }
}

module.exports = { LIBROS, norm, limpiarT, partirEnPaginas, parsearRef, cargarLibro, buscarVersiculosLocal }
