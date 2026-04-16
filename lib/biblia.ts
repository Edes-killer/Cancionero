type LibroBiblia = string[][]

const libros: Record<string, string> = {
  genesis: "genesis",
  gen: "genesis",

  exodo: "exodo",
  éxodo: "exodo",
  ex: "exodo",

  levitico: "levitico",
  levítico: "levitico",
  lev: "levitico",

  numeros: "numeros",
  números: "numeros",
  num: "numeros",

  deuteronomio: "deuteronomio",
  deut: "deuteronomio",
  dt: "deuteronomio",

  josue: "josue",
  josué: "josue",
  jos: "josue",

  jueces: "jueces",
  juez: "jueces",

  rut: "rut",

  "1 samuel": "1_samuel",
  "2 samuel": "2_samuel",
  "1 reyes": "1_reyes",
  "2 reyes": "2_reyes",
  "1 cronicas": "1_cronicas",
  "1 crónicas": "1_cronicas",
  "2 cronicas": "2_cronicas",
  "2 crónicas": "2_cronicas",

  esdras: "esdras",
  nehemias: "nehemias",
  nehemías: "nehemias",
  ester: "ester",
  job: "job",
  salmos: "salmos",
  salmo: "salmos",
  proverbios: "proverbios",
  eclesiastes: "eclesiastes",
  eclesiastés: "eclesiastes",
  cantares: "cantares",
  isaias: "isaias",
  isaías: "isaias",
  jeremias: "jeremias",
  jeremías: "jeremias",
  lamentaciones: "lamentaciones",
  ezequiel: "ezequiel",
  daniel: "daniel",
  oseas: "oseas",
  joel: "joel",
  amos: "amos",
  abdias: "abdias",
  abdías: "abdias",
  jonas: "jonas",
  jonás: "jonas",
  miqueas: "miqueas",
  nahum: "nahum",
  habacuc: "habacuc",
  sofonias: "sofonias",
  sofonías: "sofonias",
  hageo: "hageo",
  zacarias: "zacarias",
  zacarías: "zacarias",
  malaquias: "malaquias",
  malaquías: "malaquias",

  mateo: "mateo",
  marcos: "marcos",
  lucas: "lucas",
  juan: "juan",
  hechos: "hechos",
  romanos: "romanos",
  "1 corintios": "1_corintios",
  "2 corintios": "2_corintios",
  galatas: "galatas",
  gálatas: "galatas",
  efesios: "efesios",
  filipenses: "filipenses",
  colosenses: "colosenses",
  "1 tesalonicenses": "1_tesalonicenses",
  "2 tesalonicenses": "2_tesalonicenses",
  "1 timoteo": "1_timoteo",
  "2 timoteo": "2_timoteo",
  tito: "tito",
  filemon: "filemon",
  filemón: "filemon",
  hebreos: "hebreos",
  santiago: "santiago",
  "1 pedro": "1_pedro",
  "2 pedro": "2_pedro",
  "1 juan": "1_juan",
  "2 juan": "2_juan",
  "3 juan": "3_juan",
  judas: "judas",
  apocalipsis: "apocalipsis"
}

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function limpiarTextoBiblico(texto: string) {
  return texto
    .replace(/\/n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function partirEnPaginas(texto: string, maxChars = 650) {
  const limpio = texto
    .replace(/\/n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const palabras = limpio.split(" ")
  const paginas: string[] = []
  let actual = ""

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra

    if (candidato.length > maxChars) {
      if (actual) paginas.push(actual)
      actual = palabra
    } else {
      actual = candidato
    }
  }

  if (actual) paginas.push(actual)

  return paginas
}

export function parsearReferencia(referencia: string) {
  const limpia = referencia.trim()

  // Caso 1: Juan 3:16 o Juan 3:16-18
  let match = limpia.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
  if (match) {
    const [, libroRaw, capituloRaw, versoInicioRaw, versoFinRaw] = match
    const libroNormalizado = normalizarTexto(libroRaw)
    const archivo = libros[libroNormalizado]

    if (!archivo) return null

    return {
      tipo: "rango" as const,
      libroMostrar: libroRaw,
      archivo,
      capitulo: Number(capituloRaw),
      versoInicio: Number(versoInicioRaw),
      versoFin: versoFinRaw ? Number(versoFinRaw) : Number(versoInicioRaw)
    }
  }

  // Caso 2: Salmo 23
  match = limpia.match(/^(.+?)\s+(\d+)$/)
  if (match) {
    const [, libroRaw, capituloRaw] = match
    const libroNormalizado = normalizarTexto(libroRaw)
    const archivo = libros[libroNormalizado]

    if (!archivo) return null

    return {
      tipo: "capitulo" as const,
      libroMostrar: libroRaw,
      archivo,
      capitulo: Number(capituloRaw)
    }
  }

  return null
}

export async function buscarVersiculos(referencia: string) {
  const ref = parsearReferencia(referencia)

  if (!ref) {
    throw new Error("Referencia inválida. Ejemplo: Juan 3:16, Juan 3:16-18 o Salmo 23")
  }

  const modulo = await import(`@/data/biblia/procesados/${ref.archivo}.js`)
  const biblia: string[][] = modulo.default

  const capitulo = biblia[ref.capitulo - 1]

  if (!capitulo) {
    throw new Error(`No existe el capítulo ${ref.capitulo}`)
  }

  // ✅ capítulo completo
  if (ref.tipo === "capitulo") {
  const versos = capitulo.map((texto, i) => ({
    numero: i + 1,
    texto: limpiarTextoBiblico(texto)
  }))

  const textoFinal = versos.map(v => `${v.numero}. ${v.texto}`).join(" ")
  const paginas = partirEnPaginas(textoFinal)

  return {
    referencia: referencia.toUpperCase(),
    texto: textoFinal,
    versos,
    paginas
  }
}

  // ✅ rango o versículo individual
  const versos: { numero: number; texto: string }[] = []

  for (let i = ref.versoInicio; i <= ref.versoFin; i++) {
    const verso = capitulo[i - 1]

    if (!verso) {
      throw new Error(`No existe el versículo ${i}`)
    }

    versos.push({
    numero: i,
    texto: limpiarTextoBiblico(verso)
  })
  }

  const textoFinal = versos.map(v => `${v.numero}. ${v.texto}`).join(" ")
  const paginas = partirEnPaginas(textoFinal)

return {
  referencia: referencia.toUpperCase(),
  texto: textoFinal,
  versos,
  paginas
}
}