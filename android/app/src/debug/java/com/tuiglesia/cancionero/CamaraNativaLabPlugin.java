package com.tuiglesia.cancionero;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CamaraNativaLab")
public class CamaraNativaLabPlugin extends Plugin {
    private boolean abierto;
    @PluginMethod
    public void abrir(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (abierto) { call.reject("El laboratorio ya está abierto"); return; }
            abierto = true;
            try {
                startActivityForResult(call, new Intent(getContext(), CamaraNativaLabActivity.class), "terminado");
            } catch (Exception e) {
                abierto = false;
                call.reject("No se pudo abrir el laboratorio", e);
            }
        });
    }
    @ActivityCallback
    private void terminado(PluginCall call, ActivityResult result) {
        abierto = false;
        if (call != null) call.resolve(informe());
    }
    @PluginMethod
    public void ultimoInforme(PluginCall call) { call.resolve(informe()); }
    private JSObject informe() {
        JSObject valor = new JSObject();
        valor.put("informe", getContext().getSharedPreferences("camara-nativa-lab", 0).getString("informe", ""));
        return valor;
    }
}
