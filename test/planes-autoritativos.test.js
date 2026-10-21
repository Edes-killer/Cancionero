const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { permiteTransmision, permiteCamaraMovil } = require("../lib/planes.ts")

const migracion = fs.readFileSync("supabase/migrations/20261021_planes_autoritativos.sql", "utf8")

test("el plan no puede elevarse desde una sesión autenticada", () => {
  assert.match(migracion, /create or replace function public\.proteger_plan_iglesia/i)
  assert.match(migracion, /new\.plan is distinct from old\.plan and auth\.uid\(\) is not null/i)
  assert.match(migracion, /before update of plan on public\.iglesias/i)
})

test("los cupos de canciones y usuarios se validan con bloqueo en Postgres", () => {
  assert.match(migracion, /create or replace function public\.aplicar_limite_canciones/i)
  assert.match(migracion, /for update;/i)
  assert.match(migracion, /v_total >= 200/i)
  assert.match(migracion, /before insert or update of iglesia_id, eliminado_en on public\.canciones/i)
  assert.match(migracion, /create or replace function public\.check_limite_usuarios/i)
  assert.match(migracion, /v_total >= 15/i)
})

test("la nube aplica plan y formato aunque se llame directamente a Supabase", () => {
  assert.match(migracion, /plan_permite_configuracion_nube/i)
  assert.match(migracion, /i\.plan in \('pro', 'premium'\)/i)
  assert.match(migracion, /puede_guardar_media_segun_plan/i)
  assert.match(migracion, /pg_advisory_xact_lock/i)
  assert.match(migracion, /Límite de 10 imágenes/i)
  assert.match(migracion, /Límite de 1 video/i)
})

test("Pro transmite y Premium conserva cámara móvil y OBS", () => {
  const planes = fs.readFileSync("lib/planes.ts", "utf8")
  const gate = fs.readFileSync("components/RequierePlan.tsx", "utf8")
  const enVivo = fs.readFileSync("app/en-vivo/page.tsx", "utf8")
  const camara = fs.readFileSync("app/camara/page.tsx", "utf8")
  const obs = fs.readFileSync("app/transmision/page.tsx", "utf8")
  assert.match(planes, /permiteTransmision[\s\S]*plan === "pro" \|\| plan === "premium"/)
  assert.match(planes, /permiteCamaraMovil[\s\S]*plan === "premium"/)
  assert.match(gate, /capacidad === "transmision" \? permiteTransmision\(plan\) : permiteCamaraMovil\(plan\)/)
  assert.match(enVivo, /<RequierePlan funcion="Transmisión en vivo"><EnVivoPremium/)
  assert.match(camara, /capacidad="premium"><CamaraMovil/)
  assert.match(obs, /capacidad="premium"><TransmisionPremium/)
  assert.match(enVivo, /Premium:<\/strong> segunda cámara/)
  assert.match(enVivo, /\.slice\(0, esPremium \? undefined : 1\)/)
})

test("la matriz comercial distingue Gratis, Pro y Premium", () => {
  assert.equal(permiteTransmision("gratis"), false)
  assert.equal(permiteTransmision("pro"), true)
  assert.equal(permiteTransmision("premium"), true)
  assert.equal(permiteTransmision("plan-inventado"), false)
  assert.equal(permiteCamaraMovil("gratis"), false)
  assert.equal(permiteCamaraMovil("pro"), false)
  assert.equal(permiteCamaraMovil("premium"), true)
})
