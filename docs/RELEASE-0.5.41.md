# Selah Live 0.5.41 — corrección de acceso Pro

Esta versión corrige la separación comercial detectada al probar la v0.5.40.

## Planes de transmisión

- **Gratis:** proyección, Control, canciones, Biblia y preparación de cultos con sus cupos.
- **Pro:** transmisión nativa y grabación con una cámara hacia una plataforma por vez.
- **Premium:** todo Pro, más segunda cámara, cámara móvil, salida simultánea a varias plataformas e integración con OBS.

La regla se aplica desde una sola fuente (`lib/planes.ts`) y se refleja en Inicio,
navegación, consola de transmisión y página comercial. Una configuración Premium
guardada previamente no deja activas funciones avanzadas cuando la iglesia usa Pro.

## Validación

- Pruebas automáticas: 168/168 aprobadas.
- Compilación Next.js y TypeScript: aprobada.
- ESLint completo: aprobado sin advertencias.

