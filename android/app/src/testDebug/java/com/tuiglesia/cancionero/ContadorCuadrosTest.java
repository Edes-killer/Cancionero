package com.tuiglesia.cancionero;

import org.junit.Test;
import static org.junit.Assert.*;

public class ContadorCuadrosTest {
    @Test public void calculaTreintaFpsSinContarDosVecesElPrimerCuadro() {
        ContadorCuadros c = new ContadorCuadros();
        assertNull(c.agregar(0));
        for (int i = 1; i < 30; i++) assertNull(c.agregar(i * 33_333_334L));
        assertEquals(30.0, c.agregar(30 * 33_333_334L), 0.01);
    }
    @Test public void pausaNoSeConfundeConCaidaDeFps() {
        ContadorCuadros c = new ContadorCuadros();
        c.agregar(0); c.agregar(100_000_000L);
        assertNull(c.agregar(10_000_000_000L));
        assertEquals(1.0, c.agregar(11_000_000_000L), 0.01);
    }
    @Test public void reinicioYDuplicadosNoProducenFpsImposibles() {
        ContadorCuadros c = new ContadorCuadros();
        c.agregar(1_000_000_000L);
        assertNull(c.agregar(1_000_000_000L));
        assertNull(c.agregar(0));
        assertNull(c.agregar(-1));
        assertEquals(1.0, c.agregar(1_000_000_000L), 0.01);
    }
    @Test public void ventanasConsecutivasSonIndependientes() {
        ContadorCuadros c = new ContadorCuadros();
        c.agregar(0);
        assertEquals(1.0, c.agregar(1_000_000_000L), 0.01);
        c.agregar(1_500_000_000L);
        assertEquals(2.0, c.agregar(2_000_000_000L), 0.01);
    }
}
