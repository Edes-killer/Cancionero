import test from "node:test"
import assert from "node:assert/strict"
import {
  firmaItemsPersistidos,
  hayConflictoCultoPersistido,
  resolverCambioCultoRemoto,
} from "../lib/conflictoCulto.ts"

test("la firma ignora ids internos pero detecta cambios proyectables", () => {
  const original = [{ id:"fila-1", orden:0, tipo:"cancion", cancion_id:"c1" }]
  const mismoContenido = [{ id:"otro-id", orden:0, tipo:"cancion", cancion_id:"c1", creado_en:"hoy" }]
  const cambiado = [{ id:"fila-1", orden:1, tipo:"cancion", cancion_id:"c1" }]
  assert.equal(firmaItemsPersistidos(original), firmaItemsPersistidos(mismoContenido))
  assert.notEqual(firmaItemsPersistidos(original), firmaItemsPersistidos(cambiado))
})

test("solo existe conflicto cuando había una base y la nube cambió", () => {
  assert.equal(hayConflictoCultoPersistido("", "nuevo"), false)
  assert.equal(hayConflictoCultoPersistido("igual", "igual"), false)
  assert.equal(hayConflictoCultoPersistido("anterior", "nuevo"), true)
})

test("un cambio remoto respeta trabajo local y una proyección activa", () => {
  const base = { accion:"guardado", mismaLista:true }
  assert.equal(resolverCambioCultoRemoto({ ...base, hayCambiosLocales:false, enProyeccion:false }), "recargar")
  assert.equal(resolverCambioCultoRemoto({ ...base, hayCambiosLocales:true, enProyeccion:false }), "avisar")
  assert.equal(resolverCambioCultoRemoto({ ...base, hayCambiosLocales:false, enProyeccion:true }), "avisar")
})

test("eliminar la lista abierta conserva borrador y otra lista solo refresca catálogo", () => {
  assert.equal(resolverCambioCultoRemoto({ accion:"eliminado", mismaLista:true, hayCambiosLocales:false, enProyeccion:false }), "conservar_borrador")
  assert.equal(resolverCambioCultoRemoto({ accion:"guardado", mismaLista:false, hayCambiosLocales:false, enProyeccion:false }), "solo_catalogo")
})
