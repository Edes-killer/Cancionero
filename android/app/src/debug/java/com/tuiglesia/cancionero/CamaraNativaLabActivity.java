package com.tuiglesia.cancionero;

import android.Manifest;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Size;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.Preview;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Preview y medición nativas únicamente. No graba, no abre micrófono, no transmite. */
public class CamaraNativaLabActivity extends AppCompatActivity {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService analizador = Executors.newSingleThreadExecutor();
    private final ArrayList<String> eventos = new ArrayList<>();
    private PreviewView visor;
    private TextView estado;
    private Button cambiar;
    private ProcessCameraProvider proveedor;
    private Camera camara;
    private Preview preview;
    private ImageAnalysis analysis;
    private boolean frontal;
    private volatile int generacion;
    private long inicioApertura;
    private boolean primerCuadro;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        frontal = saved != null && saved.getBoolean("frontal");
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL); raiz.setBackgroundColor(Color.rgb(8, 17, 30));
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(16 + bars.left, bars.top + 12, 16 + bars.right, bars.bottom + 12);
            return insets;
        });
        TextView titulo = new TextView(this);
        titulo.setText("Laboratorio CameraX · no transmite\nToca la imagen para enfocar. No se graba audio ni video.");
        titulo.setTextColor(Color.WHITE); titulo.setTextSize(16); raiz.addView(titulo);
        visor = new PreviewView(this); visor.setScaleType(PreviewView.ScaleType.FIT_CENTER);
        raiz.addView(visor, new LinearLayout.LayoutParams(-1, 0, 1));
        estado = new TextView(this); estado.setTextColor(Color.WHITE); estado.setTextSize(14); raiz.addView(estado);
        cambiar = new Button(this); cambiar.setText("Cambiar frontal / trasera"); cambiar.setEnabled(false);
        cambiar.setOnClickListener(v -> { frontal = !frontal; vincular(); }); raiz.addView(cambiar);
        Button salir = new Button(this); salir.setText("Guardar informe y volver"); salir.setOnClickListener(v -> finish()); raiz.addView(salir);
        setContentView(raiz);
        registrar("Inicio · " + Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE);
        visor.setOnTouchListener((v, event) -> {
            if (event.getAction() != MotionEvent.ACTION_UP || camara == null || !primerCuadro) return true;
            v.performClick();
            FocusMeteringAction accion = new FocusMeteringAction.Builder(visor.getMeteringPointFactory().createPoint(event.getX(), event.getY()))
                .setAutoCancelDuration(3, TimeUnit.SECONDS).build();
            try {
            ListenableFuture<androidx.camera.core.FocusMeteringResult> foco = camara.getCameraControl().startFocusAndMetering(accion);
            foco.addListener(() -> {
                if (isDestroyed() || isFinishing()) return;
                try { registrar("Enfoque · " + (foco.get().isFocusSuccessful() ? "confirmado" : "sin confirmación (puede ser foco fijo)")); }
                catch (Exception e) { registrar("Enfoque cancelado o no disponible · " + e.getClass().getSimpleName()); }
            }, ContextCompat.getMainExecutor(this));
            } catch (Exception e) { mostrar("No se pudo iniciar enfoque · " + e.getClass().getSimpleName()); }
            return true;
        });
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) preparar();
        else requestPermissions(new String[]{Manifest.permission.CAMERA}, 71);
    }

    @Override public void onRequestPermissionsResult(int codigo, @NonNull String[] permisos, @NonNull int[] resultados) {
        super.onRequestPermissionsResult(codigo, permisos, resultados);
        if (codigo == 71 && resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED) preparar();
        else mostrar("Permiso de cámara denegado. Vuelve a Selah y habilítalo en Ajustes de Android.");
    }

    private void preparar() {
        ListenableFuture<ProcessCameraProvider> futuro = ProcessCameraProvider.getInstance(this);
        futuro.addListener(() -> {
            if (isFinishing() || isDestroyed()) return;
            try { proveedor = futuro.get(); vincular(); }
            catch (Exception e) { mostrar("No se inició CameraX · " + e.getClass().getSimpleName()); }
        }, ContextCompat.getMainExecutor(this));
    }

    private void vincular() {
        if (proveedor == null || isFinishing() || isDestroyed()) return;
        final int turno = ++generacion;
        cambiar.setEnabled(false); primerCuadro = false;
        inicioApertura = SystemClock.elapsedRealtime();
        if (camara != null) camara.getCameraInfo().getCameraState().removeObservers(this);
        proveedor.unbindAll(); camara = null;
        String lado = frontal ? "Frontal" : "Trasera";
        mostrar("Abriendo " + lado + "…");
        try {
            CameraSelector selector = frontal ? CameraSelector.DEFAULT_FRONT_CAMERA : CameraSelector.DEFAULT_BACK_CAMERA;
            if (!proveedor.hasCamera(selector)) { mostrar(lado + " no disponible en CameraX"); cambiar.setEnabled(true); return; }
            ResolutionSelector resolucion = new ResolutionSelector.Builder().setResolutionStrategy(
                new ResolutionStrategy(new Size(1920, 1080), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER)).build();
            preview = new Preview.Builder().setResolutionSelector(resolucion).build();
            preview.setSurfaceProvider(visor.getSurfaceProvider());
            analysis = new ImageAnalysis.Builder().setResolutionSelector(resolucion)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
            final ContadorCuadros contador = new ContadorCuadros();
            final boolean[] inicial = {true}; final long[] ultimaPublicacion = {0};
            analysis.setAnalyzer(analizador, imagen -> {
                try {
                    if (turno != generacion) return;
                    long t = imagen.getImageInfo().getTimestamp();
                    int ancho = imagen.getWidth(), alto = imagen.getHeight();
                    if (inicial[0]) {
                        inicial[0] = false;
                        main.post(() -> {
                            if (turno != generacion || isDestroyed()) return;
                            primerCuadro = true; cambiar.setEnabled(true);
                            mostrar(lado + " · primer cuadro en " + (SystemClock.elapsedRealtime() - inicioApertura) + " ms · análisis " + ancho + "×" + alto);
                        });
                    }
                    Double fps = contador.agregar(t);
                    if (fps != null) {
                        boolean guardar = t - ultimaPublicacion[0] >= 5_000_000_000L;
                        if (guardar) ultimaPublicacion[0] = t;
                        main.post(() -> {
                            if (turno != generacion || isDestroyed()) return;
                            String texto = String.format(Locale.ROOT, "%s · análisis %d×%d · %.1f FPS entregados\nSon cuadros nativos analizados, no FPS de red ni de emisión.", lado, ancho, alto, fps);
                            estado.setText(texto);
                            if (guardar) registrar(texto);
                        });
                    }
                } finally { imagen.close(); }
            });
            camara = proveedor.bindToLifecycle(this, selector, preview, analysis);
            camara.getCameraInfo().getCameraState().observe(this, s -> {
                if (turno != generacion || s.getError() == null) return;
                mostrar(lado + " · error CameraX " + s.getError().getCode() + ". Guarda el informe para diagnosticar.");
                cambiar.setEnabled(true);
            });
            main.postDelayed(() -> {
                if (turno == generacion && !primerCuadro && !isDestroyed()) {
                    mostrar(lado + " · sin cuadros después de 10 segundos. Prueba el otro sensor o vuelve a Selah.");
                    cambiar.setEnabled(true);
                }
            }, 10000);
        } catch (Exception e) {
            mostrar(lado + " · fallo al configurar: " + e.getClass().getSimpleName()); cambiar.setEnabled(true);
        }
    }

    private void mostrar(String texto) { estado.setText(texto); registrar(texto); }
    private void registrar(String texto) {
        eventos.add(System.currentTimeMillis() + " · " + texto);
        if (eventos.size() > 200) eventos.remove(0);
        getSharedPreferences("camara-nativa-lab", 0).edit().putString("informe", String.join("\n", eventos)).apply();
    }
    @Override public void onConfigurationChanged(@NonNull Configuration config) {
        super.onConfigurationChanged(config);
        int rotacion = getWindowManager().getDefaultDisplay().getRotation();
        if (preview != null) preview.setTargetRotation(rotacion);
        if (analysis != null) analysis.setTargetRotation(rotacion);
    }
    @Override protected void onSaveInstanceState(@NonNull Bundle out) { out.putBoolean("frontal", frontal); super.onSaveInstanceState(out); }
    @Override protected void onPause() { registrar("Pausa del laboratorio: CameraX sigue el ciclo de vida de Android"); super.onPause(); }
    @Override protected void onDestroy() {
        ++generacion; main.removeCallbacksAndMessages(null);
        if (proveedor != null) proveedor.unbindAll();
        analizador.shutdown();
        super.onDestroy();
    }
}
