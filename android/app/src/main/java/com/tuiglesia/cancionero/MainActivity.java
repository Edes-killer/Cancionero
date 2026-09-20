package com.tuiglesia.cancionero;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // La clase existe únicamente en src/debug; release no incorpora CameraX.
        try {
            registerPlugin(Class.forName("com.tuiglesia.cancionero.CamaraNativaLabPlugin")
                .asSubclass(com.getcapacitor.Plugin.class));
        } catch (ClassNotFoundException ignored) { /* Build de producción. */ }
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        }
    }
}
