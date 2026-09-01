import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Selah Live — Proyección para iglesias",
  description:
    "Proyecta letras, himnos y la Biblia en tu culto. Y tus músicos ven la letra con acordes en vivo, desde su celular. Gratis para tu iglesia.",
}

// ── Paleta ────────────────────────────────────────────────────────────────────
// Oscuro de "pantalla de proyección" + ámbar cálido de luz de santuario.
const C = {
  noche: "#070c17",
  profundo: "#0d1626",
  panel: "#121e33",
  borde: "rgba(255,255,255,0.09)",
  texto: "#eaf0fb",
  suave: "rgba(234,240,251,0.62)",
  tenue: "rgba(234,240,251,0.40)",
  luz: "#f5b93f",   // acento cálido
  azul: "#4a86ff",
}

const contenedor: React.CSSProperties = {
  maxWidth: 1140, margin: "0 auto", padding: "0 24px",
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ size = 34 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: `linear-gradient(140deg, ${C.azul}, #6366f1)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: size * 0.13, position: "relative",
    }}>
      <div style={{ width: size * 0.15, height: size * 0.46, borderRadius: 99, background: "#fff" }} />
      <div style={{ width: size * 0.15, height: size * 0.46, borderRadius: 99, background: "#fff" }} />
      <div style={{
        position: "absolute", top: size * 0.11, right: size * 0.11,
        width: size * 0.24, height: size * 0.24, borderRadius: "50%", background: C.luz,
      }} />
    </div>
  )
}

// ── Mockup: pantalla proyectada ───────────────────────────────────────────────
function PantallaProyectada() {
  return (
    <div style={{
      borderRadius: 14, overflow: "hidden", border: `1px solid ${C.borde}`,
      background: "linear-gradient(180deg, #0a1224 0%, #050a14 100%)",
      boxShadow: "0 30px 80px rgba(0,0,0,.55)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "9px 13px", background: "rgba(255,255,255,0.04)",
        borderBottom: `1px solid ${C.borde}`,
      }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: "#ff5f57" }} />
        <span style={{ width: 9, height: 9, borderRadius: 99, background: "#febc2e" }} />
        <span style={{ width: 9, height: 9, borderRadius: 99, background: "#28c840" }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: C.tenue }}>Proyector</span>
      </div>
      <div style={{
        background: "radial-gradient(circle at 50% 22%, rgba(74,134,255,.18), transparent 55%), #05090f",
        padding: "44px 26px 34px", textAlign: "center", minHeight: 250,
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", color: C.tenue, marginBottom: 20, textTransform: "uppercase" }}>
          Cuán grande es Él · Verso 2
        </div>
        <div style={{
          fontSize: "clamp(20px, 3.1vw, 33px)", fontWeight: 800, lineHeight: 1.32,
          color: "#fff", textWrap: "balance",
        }}>
          Señor, mi Dios, al contemplar los cielos<br />
          el firmamento y las estrellas mil
        </div>
        <div style={{ marginTop: 22, display: "flex", justifyContent: "center", gap: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={{
              width: i === 1 ? 22 : 7, height: 7, borderRadius: 99,
              background: i === 1 ? C.luz : "rgba(255,255,255,.22)",
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Mockup: celular del músico ────────────────────────────────────────────────
function CelularMusico() {
  const linea = (acordes: string, letra: string) => (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.luz, letterSpacing: ".06em", fontFamily: "ui-monospace, monospace" }}>
        {acordes}
      </div>
      <div style={{ fontSize: 13.5, color: C.texto, lineHeight: 1.35 }}>{letra}</div>
    </div>
  )
  return (
    <div style={{
      width: 232, borderRadius: 30, padding: 9,
      background: "linear-gradient(160deg,#243149,#131c2e)",
      border: `1px solid ${C.borde}`, boxShadow: "0 26px 60px rgba(0,0,0,.55)",
    }}>
      <div style={{ background: "#080e1a", borderRadius: 23, padding: "16px 15px 20px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 14, fontSize: 10, color: C.tenue,
        }}>
          <span>Vista Músicos</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#4ade80", fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "#4ade80" }} />
            EN VIVO
          </span>
        </div>
        {linea("Sol            Re", "Señor, mi Dios, al contemplar")}
        {linea("Mim         Do", "los cielos, el firmamento")}
        {linea("Sol      Re      Sol", "y las estrellas mil")}
        <div style={{
          marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.borde}`,
          display: "flex", justifyContent: "space-between", fontSize: 10, color: C.tenue,
        }}>
          <span>Tono: Sol</span>
          <span>♯ Transponer</span>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Bienvenido() {
  const features = [
    { i: "🎵", t: "Canciones y himnario", d: "Tu repertorio con acordes y tonos, más un himnario completo listo para usar." },
    { i: "🖥️", t: "Proyección impecable", d: "Letras en segunda pantalla, con fondos, tipografía y tamaño a tu gusto." },
    { i: "📖", t: "Biblia integrada", d: "Proyecta cualquier pasaje al instante, sin salir de la aplicación." },
    { i: "📋", t: "Cultos preparados", d: "Arma la lista del domingo: canciones, versículos, imágenes y videos, en orden." },
    { i: "🎸", t: "Vista Músicos", d: "Cada músico sigue la letra con acordes en su celular, en tiempo real." },
    { i: "📴", t: "Funciona sin internet", d: "Si se cae la conexión, el culto sigue: tus canciones quedan guardadas." },
  ]

  const pasos = [
    { n: "1", t: "Instala en el computador", d: "Descarga Selah Live para Windows. Se instala en un par de minutos." },
    { n: "2", t: "Carga tu repertorio", d: "Importa desde PowerPoint o usa el himnario que viene incluido." },
    { n: "3", t: "Proyecta el domingo", d: "Controla desde el PC. Tus músicos se conectan con su celular." },
  ]

  return (
    <main style={{
      background: C.noche, color: C.texto, minHeight: "100vh",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* ── Barra ── */}
      <header style={{ borderBottom: `1px solid ${C.borde}`, position: "sticky", top: 0, zIndex: 20, background: "rgba(7,12,23,.88)", backdropFilter: "blur(12px)" }}>
        <div style={{ ...contenedor, display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo />
            <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-.02em" }}>
              Selah <span style={{ color: C.azul, fontWeight: 300 }}>LIVE</span>
            </span>
          </div>
          <a href="/login" style={{
            fontSize: 13.5, fontWeight: 700, color: C.texto, textDecoration: "none",
            padding: "8px 16px", borderRadius: 9, border: `1px solid ${C.borde}`,
          }}>Entrar</a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(700px 380px at 72% -8%, rgba(245,185,63,.16), transparent 62%),
                       radial-gradient(760px 420px at 12% 8%, rgba(74,134,255,.16), transparent 60%)`,
        }} />
        <div style={{ ...contenedor, position: "relative", padding: "76px 24px 84px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 52, alignItems: "center" }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 22,
                padding: "6px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: 700,
                background: "rgba(245,185,63,.11)", border: "1px solid rgba(245,185,63,.28)", color: C.luz,
              }}>
                ✨ Gratis para tu iglesia
              </div>

              <h1 style={{
                fontSize: "clamp(35px, 5.6vw, 60px)", fontWeight: 900, lineHeight: 1.04,
                letterSpacing: "-.035em", margin: "0 0 22px", textWrap: "balance",
              }}>
                El culto fluye<br />
                <span style={{ color: C.luz }}>sin interrupciones</span>
              </h1>

              <p style={{ fontSize: 18, lineHeight: 1.62, color: C.suave, margin: "0 0 34px", maxWidth: 480 }}>
                Proyecta letras, himnos y la Biblia con un clic. Y por primera vez,
                <strong style={{ color: C.texto, fontWeight: 700 }}> tus músicos ven la letra con acordes en vivo desde su celular</strong>,
                siguiendo exactamente lo que proyectas.
              </p>

              <div style={{ display: "flex", gap: 13, flexWrap: "wrap", marginBottom: 18 }}>
                <a href="https://github.com/Edes-killer/Cancionero/releases/latest" style={{
                  padding: "15px 28px", borderRadius: 12, background: C.luz, color: "#241a04",
                  fontWeight: 800, fontSize: 15.5, textDecoration: "none",
                  boxShadow: "0 12px 34px rgba(245,185,63,.24)",
                }}>⬇ Descargar para Windows</a>
                <a href="/login" style={{
                  padding: "15px 28px", borderRadius: 12, background: "transparent", color: C.texto,
                  fontWeight: 700, fontSize: 15.5, textDecoration: "none", border: `1px solid ${C.borde}`,
                }}>Probar en el navegador</a>
              </div>
              <p style={{ fontSize: 13, color: C.tenue, margin: 0 }}>
                Sin tarjeta de crédito · Sin límite de canciones · Actualizaciones automáticas
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "center", position: "relative", minHeight: 330 }}>
              <div style={{ width: "100%", maxWidth: 430 }}><PantallaProyectada /></div>
              <div style={{ position: "absolute", right: -6, bottom: -42, transform: "scale(.82)", transformOrigin: "bottom right" }}>
                <CelularMusico />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Diferenciador ── */}
      <section style={{ background: C.profundo, borderTop: `1px solid ${C.borde}`, borderBottom: `1px solid ${C.borde}` }}>
        <div style={{ ...contenedor, padding: "72px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".16em", color: C.luz, marginBottom: 16 }}>
            LO QUE NOS HACE DISTINTOS
          </div>
          <h2 style={{ fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 900, letterSpacing: "-.025em", margin: "0 0 20px", textWrap: "balance" }}>
            Se acabaron las carpetas con hojas sueltas
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: C.suave, maxWidth: 660, margin: "0 auto" }}>
            Mientras proyectas, cada músico ve en su celular la misma canción con sus acordes,
            y puede transponer al tono que le acomode. Si alguien no está en la misma red,
            igual sigue el culto por internet.
          </p>
        </div>
      </section>

      {/* ── Funciones ── */}
      <section style={{ ...contenedor, padding: "78px 24px" }}>
        <h2 style={{ fontSize: "clamp(25px, 3.3vw, 36px)", fontWeight: 900, letterSpacing: "-.025em", margin: "0 0 12px", textAlign: "center" }}>
          Todo lo que el domingo necesita
        </h2>
        <p style={{ textAlign: "center", color: C.suave, fontSize: 16.5, margin: "0 0 46px" }}>
          Pensado con una iglesia real, para iglesias reales.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(285px, 1fr))", gap: 18 }}>
          {features.map(f => (
            <div key={f.t} style={{
              background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 15, padding: "26px 24px",
            }}>
              <div style={{ fontSize: 27, marginBottom: 13 }}>{f.i}</div>
              <div style={{ fontWeight: 800, fontSize: 16.5, marginBottom: 8 }}>{f.t}</div>
              <div style={{ color: C.suave, fontSize: 14.5, lineHeight: 1.6 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section style={{ background: C.profundo, borderTop: `1px solid ${C.borde}` }}>
        <div style={{ ...contenedor, padding: "72px 24px" }}>
          <h2 style={{ fontSize: "clamp(25px, 3.3vw, 36px)", fontWeight: 900, letterSpacing: "-.025em", margin: "0 0 46px", textAlign: "center" }}>
            Partir toma menos de lo que crees
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))", gap: 28 }}>
            {pasos.map(p => (
              <div key={p.n}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, marginBottom: 16,
                  background: "rgba(245,185,63,.12)", border: "1px solid rgba(245,185,63,.3)",
                  color: C.luz, fontWeight: 900, fontSize: 18,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{p.n}</div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>{p.t}</div>
                <div style={{ color: C.suave, fontSize: 15, lineHeight: 1.62 }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Precio ── */}
      <section style={{ ...contenedor, padding: "78px 24px" }}>
        <h2 style={{ fontSize: "clamp(25px, 3.3vw, 36px)", fontWeight: 900, letterSpacing: "-.025em", margin: "0 0 12px", textAlign: "center" }}>
          Gratis, de verdad
        </h2>
        <p style={{ textAlign: "center", color: C.suave, fontSize: 16.5, margin: "0 0 44px" }}>
          Sin versión de prueba ni funciones bloqueadas en lo esencial.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(285px, 1fr))", gap: 18, maxWidth: 1080, margin: "0 auto", alignItems: "stretch" }}>
          {/* Gratis */}
          <div style={{
            background: C.panel, border: `1.5px solid ${C.luz}`, borderRadius: 17, padding: "30px 26px",
            position: "relative", display: "flex", flexDirection: "column",
          }}>
            <div style={{
              position: "absolute", top: -11, left: 26, padding: "3px 12px", borderRadius: 99,
              background: C.luz, color: "#241a04", fontSize: 11.5, fontWeight: 800,
            }}>DISPONIBLE AHORA</div>
            <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Gratis</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-.03em", marginBottom: 4 }}>
              $0
            </div>
            <div style={{ fontSize: 13, color: C.tenue, marginBottom: 18 }}>Para siempre. Todo lo del domingo.</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[
                "Himnario completo incluido",
                "200 canciones propias",
                "Proyección, Biblia y cultos",
                "Vista Músicos en tiempo real",
                "Hasta 15 usuarios",
                "1 video + 10 imágenes en la nube",
                "Multimedia local ilimitada (PC)",
                "Funciona sin internet",
              ].map(x => (
                <li key={x} style={{ display: "flex", gap: 10, fontSize: 14, color: C.suave, lineHeight: 1.4 }}>
                  <span style={{ color: C.luz, fontWeight: 900 }}>✓</span>{x}
                </li>
              ))}
            </ul>
            <a href="https://github.com/Edes-killer/Cancionero/releases/latest" style={{
              display: "block", textAlign: "center", marginTop: 24, padding: "13px",
              borderRadius: 11, background: C.luz, color: "#241a04", fontWeight: 800,
              fontSize: 15, textDecoration: "none",
            }}>Descargar gratis</a>
          </div>

          {/* Pro */}
          <div style={{
            background: C.panel, border: `1px solid rgba(74,134,255,.4)`, borderRadius: 17, padding: "30px 26px",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>Pro</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-.03em", marginBottom: 4 }}>
              $4.900<span style={{ fontSize: 15, fontWeight: 600, color: C.tenue }}> /mes</span>
            </div>
            <div style={{ fontSize: 13, color: C.tenue, marginBottom: 18 }}>Para la iglesia que creció.</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[
                "Todo lo del plan Gratis, sin límites",
                "Canciones y cultos ilimitados",
                "Usuarios ilimitados",
                "2 GB de multimedia en la nube",
                "Historial y estadísticas completos",
                "Respaldo automático",
                "Soporte prioritario",
              ].map(x => (
                <li key={x} style={{ display: "flex", gap: 10, fontSize: 14, color: C.suave, lineHeight: 1.4 }}>
                  <span style={{ color: C.azul, fontWeight: 900 }}>✓</span>{x}
                </li>
              ))}
            </ul>
            <div style={{
              textAlign: "center", marginTop: 24, padding: "13px", borderRadius: 11,
              background: "rgba(74,134,255,.14)", border: "1px solid rgba(74,134,255,.3)",
              color: C.azul, fontWeight: 800, fontSize: 14.5,
            }}>Escríbenos para activarlo</div>
          </div>

          {/* Premium */}
          <div style={{
            background: "rgba(255,255,255,.02)", border: `1px solid ${C.borde}`, borderRadius: 17, padding: "30px 26px",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6, display: "flex", alignItems: "center", gap: 9 }}>
              Premium
              <span style={{
                fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                background: "rgba(245,185,63,.13)", color: C.luz, border: "1px solid rgba(245,185,63,.3)",
              }}>PRÓXIMAMENTE</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-.03em", marginBottom: 4, color: C.suave }}>
              $9.900<span style={{ fontSize: 15, fontWeight: 600, color: C.tenue }}> /mes</span>
            </div>
            <div style={{ fontSize: 13, color: C.tenue, marginBottom: 18 }}>Para la iglesia que transmite.</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[
                "Todo lo del plan Pro",
                "🎥 Transmisión nativa multicámara, sin OBS",
                "Overlays en vivo con tu logo y banners",
                "Multi-sede en una sola cuenta",
                "10 GB de multimedia en la nube",
                "Soporte dedicado",
              ].map(x => (
                <li key={x} style={{ display: "flex", gap: 10, fontSize: 14, color: C.suave, lineHeight: 1.4 }}>
                  <span style={{ color: C.luz, fontWeight: 900 }}>✓</span>{x}
                </li>
              ))}
            </ul>
            <div style={{
              textAlign: "center", marginTop: 24, padding: "13px", borderRadius: 11,
              border: `1px solid ${C.borde}`, color: C.tenue, fontWeight: 700, fontSize: 14.5,
            }}>En desarrollo</div>
          </div>
        </div>
      </section>

      {/* ── Cierre ── */}
      <section style={{
        borderTop: `1px solid ${C.borde}`,
        background: `radial-gradient(620px 300px at 50% 0%, rgba(245,185,63,.11), transparent 65%), ${C.profundo}`,
      }}>
        <div style={{ ...contenedor, padding: "76px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 900, letterSpacing: "-.03em", margin: "0 0 16px", textWrap: "balance" }}>
            Que la técnica no distraiga la adoración
          </h2>
          <p style={{ fontSize: 17, color: C.suave, maxWidth: 540, margin: "0 auto 32px", lineHeight: 1.6 }}>
            Instálalo esta semana y pruébalo el domingo. Si te sirve, cuéntale a otra iglesia.
          </p>
          <a href="https://github.com/Edes-killer/Cancionero/releases/latest" style={{
            display: "inline-block", padding: "16px 36px", borderRadius: 12,
            background: C.luz, color: "#241a04", fontWeight: 800, fontSize: 16,
            textDecoration: "none", boxShadow: "0 12px 34px rgba(245,185,63,.24)",
          }}>⬇ Descargar Selah Live</a>
        </div>
      </section>

      {/* ── Pie ── */}
      <footer style={{ borderTop: `1px solid ${C.borde}`, background: C.noche }}>
        <div style={{
          ...contenedor, padding: "30px 24px", display: "flex", flexWrap: "wrap",
          gap: 16, alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={26} />
            <span style={{ fontSize: 13.5, color: C.tenue }}>
              Selah Live · Hecho en Chile para la iglesia
            </span>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13.5 }}>
            <a href="/login" style={{ color: C.suave, textDecoration: "none" }}>Entrar</a>
            <a href="https://github.com/Edes-killer/Cancionero/releases/latest" style={{ color: C.suave, textDecoration: "none" }}>Descargar</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
