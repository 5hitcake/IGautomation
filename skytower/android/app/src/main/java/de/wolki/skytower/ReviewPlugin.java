package de.wolki.skytower;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Googles Bewertungsfenster direkt im Spiel (In-App Review).
 * Google entscheidet selbst, ob und wie oft es wirklich erscheint;
 * in Test-Versionen außerhalb des Play Stores erscheint es nicht.
 */
@CapacitorPlugin(name = "InAppReview")
public class ReviewPlugin extends Plugin {
    @PluginMethod
    public void requestReview(PluginCall call) {
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager.requestReviewFlow().addOnCompleteListener(request -> {
            if (!request.isSuccessful() || getActivity() == null) {
                call.resolve();
                return;
            }
            manager.launchReviewFlow(getActivity(), request.getResult()).addOnCompleteListener(done -> call.resolve());
        });
    }
}
