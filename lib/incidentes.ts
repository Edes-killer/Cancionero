export type ContextoIncidente = "transmision" | "camara" | "conexion"
export type PrioridadIncidente = "advertencia" | "critico"

export interface GuiaIncidente {
  codigo: string
  titulo: string
  resumen: string
  accion: string
  conserva: string
  prioridad: PrioridadIncidente
}

export function explicarErrorDestino(codigo: string): string {
  const valor = String(codigo || "").toUpperCase()
  if (valor === "TIMEOUT") return "no respondió a tiempo"
  if (valor.includes("ENOTFOUND") || valor.includes("EAI_AGAIN")) return "no se encontró su dirección en Internet"
  if (valor.includes("ECONNREFUSED")) return "rechazó la conexión en ese puerto"
  if (valor.includes("ECONNRESET") || valor.includes("EPIPE")) return "cerró la conexión durante la prueba"
  if (valor.includes("CERT") || valor.includes("TLS")) return "no aprobó la conexión segura"
  if (valor === "URL_INVALIDA") return "la dirección está incompleta"
  if (valor === "PROTOCOLO_NO_ADMITIDO") return "debe comenzar con rtmp:// o rtmps://"
  return "no respondió correctamente"
}

const incluye = (texto: string, patron: RegExp): boolean => patron.test(texto.toLowerCase())

export function explicarIncidente(mensaje: string, contexto: ContextoIncidente): GuiaIncidente {
  const texto = String(mensaje || "")

  if (incluye(texto, /tls|rtmp|fatal alert|opening output|plataforma|destino|facebook|youtube|tiktok|clave de transmisi[oó]n/)) {
    return {
      codigo: "SALIDA-PLATAFORMA",
      titulo: "La plataforma no aceptó o cerró la señal",
      resumen: "Selah alcanzó la etapa de salida, pero el destino rechazó la conexión o la terminó.",
      accion: "Confirma que el video en vivo siga abierto, genera una clave nueva si venció y espera 30 segundos antes de reintentar.",
      conserva: "Tu diseño y fuentes siguen preparados. Una grabación local activa no depende de Facebook.",
      prioridad: "critico",
    }
  }

  if (incluye(texto, /notallowed|securityerror|permiso.*c[aá]mara|no diste permiso|permiso.*micr/)) {
    return {
      codigo: "PERMISO-MEDIOS",
      titulo: "La cámara o el micrófono no tienen permiso",
      resumen: "El sistema bloqueó el acceso antes de comenzar la captura.",
      accion: "Permite cámara y micrófono para Selah en Windows o Android y luego presiona Reintentar.",
      conserva: "No se inició ninguna transmisión ni grabación con fuentes incompletas.",
      prioridad: "critico",
    }
  }

  if (incluye(texto, /notreadable|trackstarterror|siendo usad|ocupad[oa]|no se encontr[oó] la c[aá]mara|overconstrained/)) {
    return {
      codigo: "FUENTE-OCUPADA",
      titulo: "La fuente no se pudo abrir",
      resumen: "La cámara o el micrófono puede estar ocupado, desconectado o haber cambiado de identificador.",
      accion: "Cierra videollamadas y otras ventanas de cámara, reconecta el dispositivo y vuelve a elegirlo.",
      conserva: "Selah no reemplaza silenciosamente tu fuente por otra distinta.",
      prioridad: "critico",
    }
  }

  if (incluye(texto, /sin datos|sin se[nñ]al|captura|fotograma|video.*ca[yí]|b[uú]fer elevado|buffer elevado|c[aá]mara.*desconect/)) {
    return {
      codigo: "FUENTE-INTERRUMPIDA",
      titulo: "La imagen dejó de llegar con continuidad",
      resumen: "La fuente seleccionada perdió cuadros o acumuló demasiado retraso.",
      accion: contexto === "camara"
        ? "Acerca el celular al punto de acceso, deja Selah Cámara en primer plano y reconecta si no se recupera."
        : "Mantén al aire una cámara estable o la pantalla de espera; revisa la cámara afectada antes de volver a seleccionarla.",
      conserva: "Las demás fuentes y el audio continúan separados; Selah oculta la imagen vencida para no congelarla al público.",
      prioridad: "advertencia",
    }
  }

  if (incluye(texto, /audio|micr[oó]fono|dts|timestamp|tiempo.*atr[aá]s|sincron/)) {
    return {
      codigo: "AUDIO-INESTABLE",
      titulo: "El audio necesita revisión",
      resumen: "La entrada está ausente, saturada o sus tiempos no avanzan de forma continua.",
      accion: "Revisa el medidor, usa una sola entrada principal y graba 10 segundos de calibración antes de salir al aire.",
      conserva: "La composición visual permanece disponible mientras corriges el audio.",
      prioridad: "critico",
    }
  }

  if (incluye(texto, /ffmpeg|encoder|codificador|motor|full hd|speed=/)) {
    return {
      codigo: "MOTOR-VIDEO",
      titulo: "El PC no sostuvo el motor de video",
      resumen: "La codificación no inició o quedó bajo la velocidad necesaria para tiempo real.",
      accion: "Cierra programas pesados, usa calidad Media y ejecuta nuevamente Revisar salida.",
      conserva: "Las escenas y ajustes guardados no se pierden.",
      prioridad: "critico",
    }
  }

  if (incluye(texto, /socket|se[nñ]alizaci[oó]n|no responde.*ip|servidor|misma red|conexi[oó]n local|repetidor/)) {
    return {
      codigo: "CONEXION-LOCAL",
      titulo: "El dispositivo no alcanza al PC",
      resumen: "El enlace local entre el celular y Selah de escritorio no respondió.",
      accion: "Confirma que Selah esté abierto en el PC, ambos estén en la misma red y ejecuta el diagnóstico de conexión en Ajustes.",
      conserva: "El culto guardado en la nube permanece disponible; solo están detenidos el control remoto y la cámara local.",
      prioridad: "advertencia",
    }
  }

  return {
    codigo: contexto === "transmision" ? "TX-GENERAL" : contexto === "camara" ? "CAM-GENERAL" : "RED-GENERAL",
    titulo: contexto === "transmision" ? "La operación no pudo completarse" : "Se necesita revisar la conexión",
    resumen: texto || "Selah detectó una condición inesperada y evitó continuar sin confirmación.",
    accion: "Revisa la fuente indicada, vuelve a intentar una vez y prepara el informe de soporte si se repite.",
    conserva: "Los ajustes guardados permanecen disponibles.",
    prioridad: "advertencia",
  }
}
