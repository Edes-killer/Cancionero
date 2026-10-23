const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
const transmision = fs.readFileSync(path.join(raiz, "app/en-vivo/page.tsx"), "utf8")
const editor = fs.readFileSync(path.join(raiz, "components/ObjetoEditable.tsx"), "utf8")
const control = fs.readFileSync(path.join(raiz, "app/control/page.tsx"), "utf8")
const biblia = fs.readFileSync(path.join(raiz, "lib/biblia.ts"), "utf8")
const bibliaServidor = fs.readFileSync(path.join(raiz, "lib/biblia-server.js"), "utf8")
const proyector = fs.readFileSync(path.join(raiz, "app/proyectar/page.tsx"), "utf8")

test("el texto de transmisión tiene una caja de alto configurable y persistente", () => {
  assert.match(transmision, /const \[letraAlto, setLetraAlto\] = useState\(330\)/)
  assert.match(transmision, /h=\{letraAlto\} redimensionLibre/)
  assert.match(transmision, /JSON\.stringify\(\{ pos: letraPos, tam: letraTam, alto: letraAlto \}\)/)
  assert.match(transmision, /dibujarLetraCaja\([^\n]+cont\.letraAlto/)
})

test("las cuatro esquinas pueden ajustar ancho y alto de forma independiente", () => {
  assert.match(editor, /redimensionLibre\?: boolean/)
  assert.match(editor, /const py = \(e\.clientY - r\.top\)/)
  assert.match(editor, /onChange\(\{ x: xLibre, y: yLibre \}, anchoLibre, altoLibre\)/)
})

test("las páginas bíblicas usan un tamaño seguro para proyección y transmisión", () => {
  assert.match(control, /partirEnPaginasCliente = \(texto: string, maxChars = 360\)/)
  assert.match(biblia, /partirEnPaginas\(texto: string, maxChars = 360\)/)
  assert.match(bibliaServidor, /partirEnPaginas\(texto, max=360\)/)
})

test("ningún texto bíblico inesperadamente largo desborda el lienzo", () => {
  assert.match(transmision, /const maxLineas = Math\.max/)
  assert.match(transmision, /const recortado = lineas\.length > maxLineas/)
  assert.match(proyector, /flex:1,minHeight:0[^\n]+overflow:"hidden"/)
  assert.match(proyector, /maxHeight:"100%",overflow:"hidden"/)
})
