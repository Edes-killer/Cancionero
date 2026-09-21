# Confirmación remota de cámara y grabación

Cambio posterior a la publicación 0.5.34; necesita recompilar escritorio y APK.

- Cada dos segundos el PC informa cuadros decodificados y estado de escritura del archivo.
- Sin cuadros nuevos durante seis segundos: video interrumpido.
- Sin confirmación durante ocho segundos: estado desconocido, nunca conservar verde.
- La grabación se considera activa solo con bytes escritos recientemente, no por pulsar
  Grabar. No certifica integridad final del MP4 ni publicación en Facebook.
- Los avisos pertenecen a la salida general del PC: una cámara conectada puede no estar
  seleccionada en la escena. Solo se aceptan confirmaciones del host de la sala.
- Advertencias al cambiar de estado se registran en Configuración con límite de frecuencia.

Prueba física pendiente: conectar teléfono sin grabar (debe advertir), iniciar grabación,
dejar teléfono inmóvil (debe seguir recibiendo cuadros), alejarse entre pisos o apagar WiFi
solo del teléfono (debe perder confirmación), regresar y confirmar recuperación. Detener
grabación sin desconectar cámara y comprobar aviso. Repetir con dos teléfonos. PC antiguo
sin este protocolo debe indicar que no hay confirmación, nunca inventar recepción/grabación.

Validación automatizada: estados frescos/caducados, video detenido con grabación activa,
video recibido sin grabación, error/desconocido, relay real y rechazo de confirmación falsa.
