const {test}=require('node:test')
const assert=require('node:assert/strict')
const {medirPulsos}=require('../scripts/medir-pulsos-av.cjs')
test('pulsos simultáneos verifican desfase de señal',()=>{
  const r=medirPulsos('black_end:2\nblack_end:7\nsilence_end: 2.03\nsilence_end: 7.04')
  assert.equal(r.ok,true);assert.deepEqual(r.desfasesMs,[30,40])
})
test('no aprobar con audio ausente, pulso faltante o desfase grande',()=>{
  assert.equal(medirPulsos('').ok,false)
  assert.equal(medirPulsos('black_end:2\nblack_end:7\nsilence_end: 2').ok,false)
  assert.equal(medirPulsos('black_end:2\nblack_end:7\nsilence_end: 3\nsilence_end: 8').ok,false)
})

test('ignora cierre al EOF y exige todos los pulsos programados',()=>{
  const log='black_end:2\nblack_end:7\nsilence_end: 2.03\nsilence_end: 7.04\nsilence_end: 10'
  assert.equal(medirPulsos(log,.2,10).ok,true)
  assert.equal(medirPulsos(log,.2,20).ok,false)
})
