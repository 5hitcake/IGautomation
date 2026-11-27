package de.wolki.skytower;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeepAwakePlugin.class); // Bildschirm während des Spielens wach halten
        registerPlugin(ReviewPlugin.class); // Bewertungsfenster im Spiel
        super.onCreate(savedInstanceState);
    }
}
