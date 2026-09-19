const { test } = require('node:test')
const assert = require('node:assert/strict')

test('exporta estudios en orden con cita y texto bíblico', async () => {
  const { exportarListaTexto, nombreArchivoLista } = await import('../lib/exportarListaTexto.ts')
  const texto = exportarListaTexto('Estudio: La fe', [
    { tipo: 'estado', titulo: 'Introducción', subtitulo: 'La fe en acción' },
    { tipo: 'biblia', referencia: 'Hebreos 11:1', texto: 'Es, pues, la fe la certeza de lo que se espera.' },
    { tipo: 'cancion', titulo: 'Grande es tu fidelidad', tono: 'Sol' },
  ])
  assert.match(texto, /1\. Introducción[\s\S]*La fe en acción/)
  assert.match(texto, /2\. 📖 Hebreos 11:1[\s\S]*Es, pues, la fe/)
  assert.match(texto, /3\. 🎵 Grande es tu fidelidad · Tono: Sol/)
  assert.ok(texto.indexOf('Introducción') < texto.indexOf('Hebreos 11:1'))
  assert.equal(nombreArchivoLista('Estudio: La fe / 2026'), 'Estudio-La-fe-2026.txt')
})

test('no vuelca URLs de galería ni datos binarios al texto', async () => {
  const { exportarListaTexto } = await import('../lib/exportarListaTexto.ts')
  const texto = exportarListaTexto('', [
    { tipo: 'imagen', titulo: 'Diapositiva', url: 'data:image/png;base64,SECRETO' },
    { tipo: 'carrusel', urls: ['https://ejemplo/uno.png'] },
  ])
  assert.match(texto, /1\. Imagen: Diapositiva/)
  assert.match(texto, /2\. Carrusel/)
  assert.doesNotMatch(texto, /SECRETO|ejemplo/)
})
