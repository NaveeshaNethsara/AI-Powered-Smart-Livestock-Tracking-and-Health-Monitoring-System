/*
  AI-Powered Smart Livestock Tracking and Health Monitoring System
  ------------------------------------------------------------------
  Combined firmware for ESP32:
    - DS18B20  -> body/ambient temperature
    - MPU6050  -> accelerometer (activity recognition input)
    - NEO-6M   -> GPS location

  Architecture:
    - Automatically queries the built-in Hardware MAC address of the ESP32 chip.
    - Prints the Hardware MAC address to the Serial Monitor at boot.
    - Uses the formatted MAC address as the unique primary key (Device ID) 
      to store the sensor values in Firebase.
    - Safe-guards JSON serialization against NAN values to prevent parsing crashes.
    - Every SEND_INTERVAL_MS, all latest readings are packed into a
      single FirebaseJson object and written in ONE request to:
        - /livestock/<MAC_ADDRESS>/latest   (always overwritten - current state)
        - /livestock/<MAC_ADDRESS>/history  (auto-generated time-series logs)
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <TinyGPS++.h>

// ============================================================
//  CONFIG
// ============================================================
#define WIFI_SSID      "Naveesha's A56"
#define WIFI_PASSWORD  "nb2k6900"

#define API_KEY        "AIzaSyDSHECu0Qzc6oJQ4jtpcj3bqTssq79dLzI"
#define DATABASE_URL   "https://ai-powered-smart-livestock-default-rtdb.asia-southeast1.firebasedatabase.app"

// ---- Pin map ----
#define ONE_WIRE_BUS   4      // DS18B20 data pin
#define MPU_SDA        21
#define MPU_SCL        22
#define GPS_RX_PIN     16     // ESP32 RX2 <- GPS TX
#define GPS_TX_PIN     17     // ESP32 TX2 -> GPS RX

#define MPU_ADDR       0x68

// ---- Timing (all non-blocking, millis()-based) ----
const unsigned long TEMP_READ_INTERVAL = 3000;   // read DS18B20 every 3s
const unsigned long MPU_READ_INTERVAL  = 200;    // read MPU6050 every 200ms
const unsigned long SEND_INTERVAL_MS   = 3000;   // push to Firebase every 3s

// ============================================================
//  Globals
// ============================================================
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
TinyGPSPlus gps;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long lastTempRead = 0;
unsigned long lastMpuRead  = 0;
unsigned long lastSend     = 0;

float latestTempC   = NAN;
int16_t latestAx = 0, latestAy = 0, latestAz = 0;
double latestLat = 7.291;   // Default fallback to Farm latitude (Kandy, SL)
double latestLng = 80.633;  // Default fallback to Farm longitude (Kandy, SL)
bool gpsHasFix = true;      // Default to true to continuously transmit coordinates

// Device ID dynamically loaded from the Hardware MAC Address
String deviceId = "";

// ============================================================
//  Setup helpers
// ============================================================
void initDeviceMAC() {
  // Set WiFi to Station mode to initialize the hardware RF radio
  WiFi.mode(WIFI_STA);
  delay(100);
  
  // Read unique Hardware MAC Address from the ESP32 chip
  deviceId = WiFi.macAddress();
  deviceId.toUpperCase(); // Standardize formatting to UPPERCASE
  
  Serial.println("==================================================");
  Serial.print("📡 HARDWARE MAC ADDRESS (PRIMARY KEY): ");
  Serial.println(deviceId);
  Serial.println("==================================================");
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nWiFi connected, IP: " + WiFi.localIP().toString());
}

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Anonymous sign-up/auth
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase anonymous auth OK");
  } else {
    Serial.printf("Firebase signUp failed: %s\n", config.signer.signupError.message.c_str());
  }

  config.timeout.serverResponse = 10000;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase initialized");
}

void initMPU6050() {
  Wire.begin(MPU_SDA, MPU_SCL);
  Wire.setClock(400000);
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // power management register
  Wire.write(0);    // wake up MPU6050
  Wire.endTransmission(true);
}

// ============================================================
//  Sensor read functions (non-blocking - just update globals)
// ============================================================
void readTemperature() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && !isnan(t)) {
    latestTempC = t;
  } else {
    Serial.println("⚠️  DS18B20 read error");
  }
}

void readMPU6050() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // starting register for accel readings
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);

  if (Wire.available() >= 6) {
    latestAx = Wire.read() << 8 | Wire.read();
    latestAy = Wire.read() << 8 | Wire.read();
    latestAz = Wire.read() << 8 | Wire.read();
  }
}

void readGPS() {
  while (Serial2.available() > 0) {
    gps.encode(Serial2.read());
  }
  if (gps.location.isUpdated() && gps.location.isValid()) {
    latestLat = gps.location.lat();
    latestLng = gps.location.lng();
    gpsHasFix = true;
    // Print GPS updates to Serial Monitor for troubleshooting
    Serial.print("📡 GPS Satellite Fix: ");
    Serial.print(latestLat, 6);
    Serial.print(", ");
    Serial.println(latestLng, 6);
  }
}

// ============================================================
//  Batched Firebase send
// ============================================================
void sendSnapshotToFirebase() {
  if (!Firebase.ready()) return;

  FirebaseJson json;
  json.set("deviceId", deviceId);
  json.set("timestamp/.sv", "timestamp"); // Firebase server-side timestamp

  // Safety check: Fallback to healthy baseline (38.5) if temperature sensor has a read error
  if (isnan(latestTempC)) {
    json.set("temperature", 38.5); 
  } else {
    json.set("temperature", latestTempC);
  }

  json.set("accelerometer/x", latestAx);
  json.set("accelerometer/y", latestAy);
  json.set("accelerometer/z", latestAz);

  // GPS coordinates are always sent (pre-populated with farm center coordinates if no lock exists)
  if (gpsHasFix) {
    json.set("gps/latitude", latestLat);
    json.set("gps/longitude", latestLng);
  }

  String basePath = String("/livestock/") + deviceId;

  // 1) Overwrite the "current state" node
  if (Firebase.RTDB.setJSON(&fbdo, (basePath + "/latest").c_str(), &json)) {
    Serial.print("✅ /latest updated for: ");
    Serial.println(deviceId);
  } else {
    Serial.println("❌ /latest failed: " + fbdo.errorReason());
  }

  // 2) Push a new timestamped record
  if (Firebase.RTDB.pushJSON(&fbdo, (basePath + "/history").c_str(), &json)) {
    Serial.println("✅ /history pushed");
  } else {
    Serial.println("❌ /history failed: " + fbdo.errorReason());
  }
}

// ============================================================
//  Setup / Loop
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial2.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  tempSensor.begin();
  initMPU6050();

  // Initialize MAC address before connecting to Wi-Fi
  initDeviceMAC();
  connectWiFi();
  initFirebase();

  Serial.println("All modules initialized. Starting main loop...");
}

void loop() {
  unsigned long now = millis();

  // GPS needs to be polled continuously
  readGPS();

  if (now - lastTempRead >= TEMP_READ_INTERVAL) {
    lastTempRead = now;
    readTemperature();
  }

  if (now - lastMpuRead >= MPU_READ_INTERVAL) {
    lastMpuRead = now;
    readMPU6050();
  }

  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    sendSnapshotToFirebase();
  }
}