package com.phantomguard.app;

import android.app.Activity;
import android.content.Context;
import android.os.BatteryManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview_view);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/index.html");
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public void requestPermissions() {
            runOnUiThread(() -> Toast.makeText(
                MainActivity.this,
                "No sensitive permissions are required for this security overview.",
                Toast.LENGTH_LONG
            ).show());
        }

        @JavascriptInterface
        public String getDeviceSummary() {
            BatteryManager manager =
                (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            int battery = manager == null ? -1 :
                manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            String batteryText = battery >= 0 ? battery + "%" : "Unavailable";

            return "Model: " + android.os.Build.MODEL
                + "\\nAndroid: " + android.os.Build.VERSION.RELEASE
                + "\\nBattery: " + batteryText
                + "\\nPrivacy: device information stays on this device.";
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
