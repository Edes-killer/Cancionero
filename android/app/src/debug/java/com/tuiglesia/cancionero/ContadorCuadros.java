package com.tuiglesia.cancionero;

/** FPS de cuadros entregados al analizador; nunca representa FPS de emisión. */
final class ContadorCuadros {
    private long inicio = -1;
    private long anterior = -1;
    private int cuadros;
    Double agregar(long timestampNs) {
        if (timestampNs < 0) return null;
        if (inicio < 0 || timestampNs <= anterior || timestampNs - anterior > 3_000_000_000L) {
            inicio = anterior = timestampNs;
            cuadros = 0;
            return null;
        }
        anterior = timestampNs;
        cuadros++;
        long intervalo = timestampNs - inicio;
        if (intervalo < 1_000_000_000L) return null;
        double fps = cuadros * 1e9 / intervalo;
        inicio = timestampNs;
        cuadros = 0;
        return fps;
    }
}
