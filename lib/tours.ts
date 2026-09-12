import { PasoTour } from "@/components/OnboardingTour"

export const TOUR_CONTROL: PasoTour[] = [
  {
    icono: "🎛️",
    titulo: "Control de Culto",
    desc: "El panel central de Selah Live. Desde aquí proyectas canciones en el segundo monitor, navegas entre partes y coordinas todo el servicio en tiempo real.",
    tip: "Abre el proyector primero haciendo clic en '🖥️ Proyector' en el menú superior."
  },
  {
    icono: "🖥️",
    titulo: "Abrir el Proyector",
    desc: "Presiona '🖥️ Proyector' en la barra superior para abrir la pantalla de proyección en el segundo monitor.",
    tip: "En Electron el proyector se abre en la segunda pantalla automáticamente.",
    selector: "[data-tour='btn-proyectar-nav']",
    posicion: "bottom",
    antes: () => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  },
  {
    icono: "🔍",
    titulo: "Buscar y proyectar",
    desc: "Escribe el número o título de la canción. Luego presiona ▶ junto a la canción para proyectarla en el segundo monitor.",
    tip: "Las 1000 canciones del Himnario Cristiano Evangélico ya están cargadas.",
    atajo: "Ctrl+F",
    selector: "[data-tour='lista-canciones']",
    posicion: "right",
    antes: () => {
      const el = document.querySelector("[data-tour='lista-canciones']") as HTMLElement
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  },
  {
    icono: "⬅️",
    titulo: "Navegar entre partes",
    desc: "Las flechas ⬅️ ➡️ avanzan entre Verso 1, Coro, Verso 2, Puente. Una vez proyectada una canción los botones se vuelven grandes para facilitar el control.",
    tip: "También puedes usar el teclado ← → sin tocar el mouse.",
    atajo: "← →",
    selector: "[data-tour='controles-nav']",
    posicion: "bottom"
  },
  {
    icono: "🎵",
    titulo: "Botón 'Ir al Coro'",
    desc: "Al proyectar una canción que tiene coro, aparece el botón '🎵 Coro' en la barra de controles. Presiona para saltar directo — '↩ Verso' te devuelve al siguiente verso.",
    tip: "Proyecta primero una canción con coro (ej: Himno 1) y verás este botón aparecer.",
    selector: "[data-tour='controles-nav']",
    posicion: "bottom"
  },
  {
    icono: "⏱️",
    titulo: "Auto-avance inteligente",
    desc: "La primera vez que proyectas una canción y navegas hasta el final, el sistema guarda los tiempos. La próxima vez aparece '▶ Auto' para avanzar solo sin tocar nada.",
    tip: "Proyecta una canción → navega parte por parte hasta terminar → la próxima vez verás ▶ Auto."
  },
  {
    icono: "📋",
    titulo: "Lista del Culto",
    desc: "Agrega canciones, versículos e imágenes en orden para el servicio. Puedes guardarla y cargarla el próximo domingo.",
    tip: "Los músicos en sus celulares ven en tiempo real qué canción está activa.",
    selector: "[data-tour='lista-culto']",
    posicion: "left",
    antes: () => {
      const el = document.querySelector("[data-tour='lista-culto']") as HTMLElement
      if (el) {
        let p = el.parentElement
        while (p) {
          const ov = window.getComputedStyle(p).overflowY
          if (ov === "scroll" || ov === "auto") {
            const pr = p.getBoundingClientRect()
            const er = el.getBoundingClientRect()
            p.scrollTop += er.top - pr.top - pr.height / 2 + er.height / 2
            return
          }
          p = p.parentElement
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  },
  {
    icono: "📖",
    titulo: "Proyectar Biblia",
    desc: "Escribe una cita bíblica como 'Juan 3:16' o 'Salmo 23' y proyéctala. Aparece con la referencia en la cabecera y el nombre de la iglesia al pie.",
    tip: "Funciona con rangos: 'Romanos 8:28-30' proyecta los 3 versículos con paginación.",
    selector: "[data-tour='input-biblia']",
    posicion: "top",
    antes: () => {
      const panel = document.querySelector("[data-tour='input-biblia']") as HTMLElement
      if (!panel) return
      if (panel.getBoundingClientRect().height < 80) {
        const header = panel.firstElementChild as HTMLElement
        header?.click()
      }
      panel.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  },
  {
    icono: "🎨",
    titulo: "Fondos y apariencia",
    desc: "En el panel derecho puedes elegir el fondo del proyector — gradientes prediseñados, imagen personalizada o color sólido. El cambio es en tiempo real.",
    tip: "El logo de tu iglesia aparece como marca de agua en la esquina inferior derecha.",
    selector: "[data-tour='panel-fondo']",
    posicion: "left",
    antes: () => {
      // 1. Abrir panel Herramientas si está cerrado
      const btnHerramientas = document.querySelector("[data-tour='btn-herramientas']") as HTMLElement
      if (btnHerramientas) {
        const panel = btnHerramientas.nextElementSibling as HTMLElement
        const estaAbierto = panel && parseInt(window.getComputedStyle(panel).maxHeight) > 0
        if (!estaAbierto) btnHerramientas.click()
      }
      // 2. Scroll al panel de fondos (esperar que se abra)
      setTimeout(() => {
        const el = document.querySelector("[data-tour='panel-fondo']") as HTMLElement
        if (!el) return
        let p = el.parentElement
        while (p) {
          const ov = window.getComputedStyle(p).overflowY
          if (ov === "scroll" || ov === "auto") {
            const pr = p.getBoundingClientRect()
            const er = el.getBoundingClientRect()
            p.scrollTop += er.top - pr.top - pr.height / 2 + er.height / 2
            return
          }
          p = p.parentElement
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 350)
    }
  },
  {
    icono: "🗂️",
    titulo: "Galería visual",
    desc: "Abre la biblioteca de imágenes, animaciones y carpetas para agregarlas a la lista del culto o proyectarlas cuando las necesites.",
    tip: "La biblioteca queda en caché y luego se actualiza en segundo plano para abrir más rápido.",
    selector: "#panel-galeria",
    posicion: "left",
    antes: () => {
      const btn = document.querySelector("[data-tour='galeria-toggle'][aria-expanded='false']") as HTMLElement | null
      btn?.click()
    }
  },
  {
    icono: "✅",
    titulo: "¡Ya sabes lo esencial!",
    desc: "Con esto puedes dirigir un culto completo. Explora a tu ritmo — cada sección tiene más opciones.",
    tip: "💡 Puedes repetir este tutorial desde ⚙️ Configuración → Tutoriales."
  },
]

// La APK no abre una ventana de proyeccion: actua como control remoto del PC.
// Mantener un recorrido separado evita mostrar acciones y vocabulario propios
// de escritorio que no existen en el celular.
export const TOUR_CONTROL_MOBILE: PasoTour[] = [
  {
    icono: "📱",
    titulo: "Control desde tu celular",
    desc: "Desde aquí manejas lo que verá la congregación en la pantalla conectada al computador de la iglesia.",
    tip: "Antes del culto comprueba que el indicador superior diga LISTO."
  },
  {
    icono: "🔍",
    titulo: "Buscar una canción",
    desc: "Escribe el número, el título o una frase. Toca ▶ en el resultado para enviarla a la pantalla.",
    tip: "Las canciones del himnario y las de tu iglesia aparecen en el mismo buscador.",
    selector: "[data-tour='lista-canciones']",
    posicion: "bottom",
    antes: () => {
      document.getElementById("panel-canciones")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  },
  {
    icono: "⬅️",
    titulo: "Cambiar de parte",
    desc: "Usa las flechas grandes para ir al verso, coro o parte anterior y siguiente de lo que está al aire.",
    tip: "La barra superior recuerda siempre la canción y la parte que estás proyectando.",
    selector: "[data-tour='controles-nav']",
    posicion: "bottom"
  },
  {
    icono: "•••",
    titulo: "Más controles",
    desc: "Toca este botón para mostrar Coro, Auto, Apagar y los controles secundarios solo cuando los necesites.",
    tip: "Puedes cerrarlos nuevamente para mantener despejada la pantalla.",
    selector: "[data-tour='controles-extra-mobile']",
    posicion: "bottom"
  },
  {
    icono: "📋",
    titulo: "Lista del Culto",
    desc: "Aquí ordenas canciones, versículos, imágenes y otros elementos tal como se usarán durante el culto.",
    tip: "Toca Buscar para volver rápidamente al repertorio y seguir agregando contenido.",
    selector: "[data-tour='lista-culto']",
    posicion: "top",
    antes: () => {
      const irALista = document.querySelector("[aria-label='Ir a la lista del culto']") as HTMLElement | null
      irALista?.click()
      setTimeout(() => document.getElementById("scroll-lista")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80)
    }
  },
  {
    icono: "📖",
    titulo: "Proyectar la Biblia",
    desc: "Abre Biblia, escribe una cita como Juan 3:16 y envíala a la pantalla. Los textos largos se dividen en páginas.",
    tip: "También acepta rangos como Romanos 8:28-30.",
    selector: "[data-tour='input-biblia']",
    posicion: "top",
    antes: () => {
      const panel = document.querySelector("[data-tour='input-biblia']") as HTMLElement | null
      if (!panel) return
      if (panel.getBoundingClientRect().height < 80) (panel.firstElementChild as HTMLElement | null)?.click()
      panel.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  },
  {
    icono: "🗂️",
    titulo: "Galería rápida",
    desc: "Desde Galería puedes buscar imágenes y animaciones, abrir carpetas y agregarlas directamente a la lista del culto.",
    tip: "Es útil para mostrar una imagen de emergencia sin salir del Control.",
    selector: "#panel-galeria",
    posicion: "top",
    antes: () => {
      const btn = document.querySelector("[data-tour='galeria-toggle'][aria-expanded='false']") as HTMLElement | null
      btn?.click()
    }
  },
  {
    icono: "✅",
    titulo: "¡Tu control está listo!",
    desc: "Ya puedes buscar contenido, organizar la lista y controlar la proyección desde el celular.",
    tip: "Puedes repetir este recorrido desde Configuración → Tutoriales."
  }
]

// Genera los pasos según plataforma
export const getTourCanciones = (isMobile = false): PasoTour[] => [
  {
    icono: "🎵",
    titulo: "Cancionero de tu iglesia",
    desc: "Aquí viven todas las canciones — himnos del HCE ya cargados, más las canciones propias de tu iglesia.",
    tip: "Los cambios que hagas aquí afectan a todos los usuarios de tu iglesia."
  },
  {
    icono: "🔍",
    titulo: "Búsqueda inteligente",
    desc: "Busca por número (ej: '312'), título o fragmento de letra. Sin tildes funciona igual.",
    tip: "Usa el número del HCE para encontrar himnos rápido durante el culto.",
    atajo: "Ctrl+F",
    selector: "[data-tour='buscador-canciones']",
    posicion: "bottom"
  },
  {
    icono: "🎸",
    titulo: "Filtros rápidos",
    desc: "Filtra canciones con acordes, sin tono asignado, o por categoría. Puedes combinar varios filtros.",
    tip: "Las canciones sin tono se muestran en el Dashboard para completarlas.",
    selector: "[data-tour='filtros-rapidos']",
    posicion: "bottom"
  },
  {
    icono: "➕",
    titulo: "Agregar nueva canción",
    desc: "Crea una canción con título, tono, categoría y letra dividida en partes: Verso, Coro, Puente.",
    tip: "Divide bien las partes para que el control pueda navegar entre ellas.",
    selector: "[data-tour='btn-nueva-cancion']",
    posicion: "bottom"
  },
  ...(!isMobile ? [{
    icono: "📊",
    titulo: "Importar desde PowerPoint",
    desc: "¿Tienes presentaciones en PowerPoint? Impórtalas directamente con reconocimiento automático.",
    tip: "Puedes importar varias PPT a la vez. Revisa antes de confirmar.",
    selector: "[data-tour='btn-importar-ppt']",
    posicion: "bottom" as const
  }] : []),
  {
    icono: "🎸",
    titulo: "Agregar acordes al editar",
    desc: "Presiona ✏️ en cualquier canción para editarla. Escribe los acordes entre corchetes antes de la sílaba que cambia.",
    tip: "Ejemplo: [Sol]Ben[Re]di[Mi]to el Se[Do]ñor — los músicos los ven en tiempo real.",
    atajo: "[ acorde ]",
    selector: "[data-tour='btn-nueva-cancion']",
    posicion: "bottom"
  },
  {
    icono: "✅",
    titulo: "¡Listo para agregar canciones!",
    desc: "Empieza completando las canciones que faltan acordes o importando tus presentaciones PPT.",
    tip: "💡 Puedes repetir este tutorial desde ⚙️ Configuración → Tutoriales."
  },
]

export const TOUR_CANCIONES: PasoTour[] = getTourCanciones(false)

export const TOUR_TRANSMISION: PasoTour[] = [
  {
    icono: "🎥",
    titulo: "Tu estudio de transmisión",
    desc: "Aquí preparas cámaras, audio, escenas y gráficos antes de salir al aire. El recorrido solo te muestra las herramientas: no encenderá una transmisión ni cambiará tus ajustes.",
    tip: "Haz una grabación corta de prueba antes de cada culto para comprobar imagen y sonido."
  },
  {
    icono: "📺",
    titulo: "Salida final",
    desc: "Este cuadro es exactamente lo que verá el público. Todo lo que quede fuera del borde no aparece en la transmisión.",
    tip: "Puedes arrastrar y redimensionar el logo, la letra y otros objetos directamente aquí.",
    selector: "[data-tour='tx-salida']",
    posicion: "right"
  },
  {
    icono: "🎙️",
    titulo: "Cámaras y audio",
    desc: "Elige la cámara principal, una segunda cámara opcional y la entrada de audio. Si conectas un celular, también aparecerá como cámara y micrófono seleccionable.",
    tip: "Mira el medidor de audio: debe moverse con claridad sin llegar constantemente a rojo.",
    selector: "[data-tour='tx-camaras']",
    posicion: "left"
  },
  {
    icono: "🎬",
    titulo: "Escenas",
    desc: "Cambia entre Cámara, Cámara + letra, Proyección y Espera. La escena marcada como EN PREVIA será la que saldrá al iniciar la emisión.",
    tip: "La pantalla de Espera mantiene el micrófono silenciado y puede pasar automáticamente a Cámara al terminar el contador.",
    selector: "[data-tour='tx-escenas']",
    posicion: "left"
  },
  {
    icono: "🖥️",
    titulo: "Fuentes adicionales",
    desc: "Comparte una pantalla o conecta el celular como cámara. Puedes combinar una fuente principal con una cámara en recuadro.",
    tip: "Para la cámara del celular, ambos equipos deben estar conectados a la misma red.",
    selector: "[data-tour='tx-fuentes']",
    posicion: "left"
  },
  {
    icono: "💬",
    titulo: "Mensaje en vivo",
    desc: "Escribe un aviso breve y muéstralo arriba o abajo sobre cualquier escena, sin modificar la letra proyectada.",
    tip: "Úsalo para bienvenida, datos de contacto u otros avisos puntuales.",
    selector: "[data-tour='tx-mensaje']",
    posicion: "left"
  },
  {
    icono: "🎨",
    titulo: "Apariencia",
    desc: "Personaliza diseño, colores, logo, posiciones y gráficos para que la transmisión tenga la identidad de tu iglesia. Los cambios se guardan automáticamente.",
    tip: "Guarda un armado cuando tengas una distribución que quieras recuperar después.",
    selector: "[data-tour='tx-apariencia']",
    posicion: "left"
  },
  {
    icono: "🔴",
    titulo: "Transmitir o grabar",
    desc: "Configura tus destinos y usa Revisar salida antes de emitir. También puedes grabar el programa final en el computador sin transmitirlo.",
    tip: "La revisión previa detecta problemas de cámara, audio, escena y destinos antes de salir al aire.",
    selector: "[data-tour='tx-salir-vivo']",
    posicion: "left"
  },
  {
    icono: "📡",
    titulo: "Emisión directa",
    desc: "Comparte el culto dentro de la red local mediante un enlace, QR y código, sin pasar por Facebook, YouTube ni TikTok.",
    tip: "Es ideal para otra sala o equipos conectados al mismo WiFi; para público por internet usa una plataforma de transmisión.",
    selector: "[data-tour='tx-emision-directa']",
    posicion: "left"
  },
  {
    icono: "✅",
    titulo: "Transmisión preparada",
    desc: "Ya conoces el flujo completo: configura, revisa la salida, haz una prueba y recién entonces comienza la transmisión.",
    tip: "Puedes repetir esta guía desde el botón ❔ Guía o desde Configuración → Tutoriales."
  }
]

export const TOUR_MUSICOS: PasoTour[] = [
  {
    icono: "🎸",
    titulo: "Vista para músicos",
    desc: "Aquí cada músico consulta el repertorio, ve acordes y prepara el tono sin intervenir en lo que aparece en el proyector.",
    tip: "Durante el culto puedes volver a la canción que está al aire desde el botón En vivo."
  },
  {
    icono: "📚",
    titulo: "Repertorio con acordes",
    desc: "Busca canciones por título o número. Las que tienen acordes aparecen marcadas y puedes activar el filtro para ver solamente esas.",
    tip: "Toca una canción para abrir su letra, tono y acordes completos.",
    selector: "[data-tour='musicos-repertorio']",
    posicion: "right"
  },
  {
    icono: "🧰",
    titulo: "Herramientas musicales",
    desc: "Afinar usa el micrófono para reconocer notas; Improvisar propone escalas; Ensayo reúne el metrónomo y la nota de partida.",
    tip: "El tour no abre el micrófono ni reproduce sonidos. Tú decides cuándo activar cada herramienta.",
    selector: "[data-tour='musicos-herramientas']",
    posicion: "bottom"
  },
  {
    icono: "🎵",
    titulo: "Transposición y acordes",
    desc: "Cuando sigues una canción en vivo, los controles inferiores suben o bajan el tono para tu instrumento y permiten mostrar u ocultar los acordes.",
    tip: "La transposición es personal: no cambia el tono para los demás músicos ni la proyección.",
    selector: "[data-tour='musicos-controles']",
    posicion: "top"
  },
  {
    icono: "✅",
    titulo: "Listo para tocar",
    desc: "Ya puedes consultar el repertorio, seguir el culto y usar las herramientas de práctica desde el mismo lugar.",
    tip: "Puedes repetir este recorrido desde Configuración → Tutoriales."
  }
]

export const TOUR_CAMARA_MOVIL: PasoTour[] = [
  {
    icono: "📱",
    titulo: "Tu celular como cámara",
    desc: "Selah envía la imagen y, si lo eliges en el computador, el audio del celular directamente a la consola de Transmisión.",
    tip: "El celular y el computador deben estar en la misma red local."
  },
  {
    icono: "●",
    titulo: "Revisa el estado",
    desc: "La franja superior indica si la cámara está lista, conectando o transmitiendo al computador.",
    tip: "Si aparece Sin conexión, confirma que Selah esté abierto en el PC y que la dirección del servidor sea correcta.",
    selector: "[data-tour='camara-estado']",
    posicion: "bottom"
  },
  {
    icono: "🔢",
    titulo: "Escribe el código",
    desc: "En el computador abre Transmisión → Fuentes → Conectar celular. Luego escribe aquí el código que aparece en pantalla.",
    tip: "El código queda recordado para facilitar una reconexión posterior.",
    selector: "[data-tour='camara-codigo']",
    posicion: "top"
  },
  {
    icono: "🔄",
    titulo: "Elige la cámara",
    desc: "Voltear cambia realmente entre la cámara trasera y la frontal del teléfono; no es solo un efecto espejo.",
    tip: "Haz el cambio antes del culto para comprobar qué cámara ofrece mejor imagen.",
    selector: "[data-tour='camara-voltear']",
    posicion: "top"
  },
  {
    icono: "▶️",
    titulo: "Conecta y mantén abierta la cámara",
    desc: "Presiona Conectar al PC y espera el estado Transmitiendo al PC. Selah intentará recuperar la conexión si cambias de app o la red se interrumpe brevemente.",
    tip: "Mantén el teléfono conectado a corriente y desactiva el ahorro de batería para cultos largos.",
    selector: "[data-tour='camara-controles']",
    posicion: "top"
  },
  {
    icono: "✅",
    titulo: "Cámara preparada",
    desc: "Cuando el estado esté en verde, vuelve al computador y elige Celular como Cámara 1, Cámara 2 o entrada de audio.",
    tip: "Puedes repetir esta guía desde Configuración → Tutoriales."
  }
]

export const TOUR_CONFIGURACION: PasoTour[] = [
  {
    icono: "⚙️",
    titulo: "Configuración de Selah",
    desc: "Aquí administras la identidad de tu iglesia y las preferencias de este equipo. Selah distingue claramente qué cambios se comparten y cuáles quedan guardados localmente.",
    tip: "La guía solo explica las secciones; no modificará ni guardará ajustes."
  },
  {
    icono: "🧭",
    titulo: "Índice rápido",
    desc: "Usa esta barra para saltar directamente a Identidad, Proyección, Celulares, Personas, Apariencia o Ayuda sin recorrer toda la página.",
    tip: "Cada botón indica si sus ajustes afectan a toda la iglesia o solo a este dispositivo.",
    selector: "[data-tour='config-indice']",
    posicion: "bottom"
  },
  {
    icono: "🏛️",
    titulo: "Identidad de la iglesia",
    desc: "Configura el nombre, localidad y logo que se utilizarán en el inicio, la proyección y las pantallas de transmisión.",
    tip: "Estos datos se sincronizan para los usuarios de la misma iglesia.",
    selector: "#ajuste-identidad",
    posicion: "bottom"
  },
  {
    icono: "🖥️",
    titulo: "Proyección y conexión",
    desc: "Indica dónde funciona el computador del proyector, verifica la conexión y ejecuta un diagnóstico completo si el celular no logra comunicarse.",
    tip: "En redes con repetidores puede haber varias IP; el diagnóstico ayuda a identificar la correcta.",
    selector: "#ajuste-proyeccion",
    posicion: "top"
  },
  {
    icono: "👥",
    titulo: "Personas y permisos",
    desc: "Genera invitaciones por rol y administra quién pertenece a la iglesia. Músico, líder y administrador tienen permisos diferentes.",
    tip: "Entrega permisos de administrador solamente a personas de confianza.",
    selector: "#ajuste-personas",
    posicion: "top"
  },
  {
    icono: "🎓",
    titulo: "Ayuda y registros",
    desc: "Desde Tutoriales puedes repetir cualquier recorrido y decidir si mostrar explicaciones sobre los botones. Más abajo encontrarás los registros para diagnóstico y soporte.",
    tip: "Cuando algo falle, copia o descarga el registro antes de reiniciar la aplicación.",
    selector: "#ajuste-ayuda",
    posicion: "top"
  },
  {
    icono: "✅",
    titulo: "Configuración entendida",
    desc: "Ya sabes dónde preparar la iglesia, conectar equipos, gestionar personas y encontrar ayuda cuando ocurra un problema.",
    tip: "Puedes iniciar nuevamente este mismo tour desde Tutoriales sin recargar la APK."
  }
]

export const TOUR_INICIO: PasoTour[] = [
  {
    icono: "🏠",
    titulo: "Inicio de Selah",
    desc: "Esta pantalla reúne las acciones principales y muestra el estado actual de tu iglesia. Desde aquí puedes entrar rápidamente al trabajo que necesitas realizar.",
    tip: "Las opciones cambian según tu rol y según estés usando el computador o el celular."
  },
  {
    icono: "⛪",
    titulo: "Iglesia activa",
    desc: "Aquí ves el nombre y logo de la iglesia con la que estás trabajando. Si perteneces a más de una, puedes cambiar la iglesia activa.",
    tip: "Canciones, listas, galería y permisos siempre pertenecen a la iglesia seleccionada.",
    selector: "[data-tour='inicio-iglesia']",
    posicion: "bottom"
  },
  {
    icono: "🎛️",
    titulo: "Control de Culto",
    desc: "Es la entrada principal para buscar canciones, preparar la lista y manejar en vivo todo lo que aparece en el proyector.",
    tip: "Antes del culto entra aquí y comprueba que el estado de conexión esté listo.",
    selector: "[data-tour='inicio-control']",
    posicion: "bottom"
  },
  {
    icono: "🧰",
    titulo: "Módulos de trabajo",
    desc: "Accede al cancionero, proyector, vista de músicos, historial, transmisión, cámara móvil y configuración. Solo verás las opciones permitidas para tu equipo y rol.",
    tip: "Cada módulo importante tiene su propio recorrido guiado.",
    selector: "[data-tour='inicio-modulos']",
    posicion: "top"
  },
  {
    icono: "🔗",
    titulo: "Estado de conexión",
    desc: "Este indicador confirma si el celular puede comunicarse con el computador que controla el proyector.",
    tip: "Si aparece Sin conexión, abre Selah en el PC y usa Configuración → Proyección para diagnosticar la red.",
    selector: "[data-tour='inicio-conexion']",
    posicion: "top"
  },
  {
    icono: "✅",
    titulo: "Todo a mano",
    desc: "Ya conoces el punto de partida de Selah. Entra al Control para preparar o dirigir el próximo culto.",
    tip: "Puedes repetir este recorrido desde Configuración → Tutoriales."
  }
]
