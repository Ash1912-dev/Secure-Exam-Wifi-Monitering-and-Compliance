#ifdef ARDUINO
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

/**
 * SEWCMS ESP32 Firmware v2.1
 * ============================================================================
 * Secure Exam WiFi Compliance & Monitoring System
 * 
 * ARCHITECTURE:
 * - ESP32 connects to internet-accessible WiFi (WIFI_SSID, WIFI_PASSWORD)
 * - Backend determines exam WiFi (allowed_ssid) and exam status
 * - Device fetches exam config from backend /status endpoint
 * - Device scans all visible networks and sends results to backend
 * - Backend determines if device is on correct exam network
 * 
 * KEY FEATURES:
 * - NO hardcoded exam SSID - controlled entirely by backend
 * - SSID validation with change detection
 * - Mismatch warnings (device NOT on exam network)
 * - Conditional scanning (only when exam is active)
 * - Robust error handling with exponential backoff
 * - Detailed logging and SSID comparison
 * 
 * FLOW:
 * 1. Connect to WiFi (WIFI_SSID)
 * 2. Fetch /status (exam_active, allowed_ssid)
 * 3. Compare current SSID vs allowed SSID (log mismatch)
 * 4. If exam_active: scan and send results (with connected SSID)
 * 5. If exam_inactive: skip scan, wait for next check
 * 6. Backend analyzes: is device on correct network?
 * 
 * VIOLATION HANDLING:
 * Device sends: {"connected_ssid": "Current_Network", ...}
 * Backend compares against allowed_ssid
 * If mismatch → violation (+40 risk)
 * 
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// ── WiFi Configuration ──────────────────────────────────────────────────────
// Network credentials are now managed dynamically via WiFiManager!
// When the ESP32 boots, if it cannot find its saved network, it will broadcast
// an open Access Point named "SEWCMS_Setup".
// Connect to this AP with your phone to configure the device's internet access.

const char* BACKEND_BASE_URL = "http://192.168.1.7:5000";
const char* BACKEND_CONFIG_URL = "http://192.168.1.7:5000/config/wifi-access";
const char* BACKEND_STATUS_URL = "http://192.168.1.7:5000/status";
const char* BACKEND_SCAN_URL = "http://192.168.1.7:5000/scan";

// Device token — generated dynamically from ESP32 MAC address at boot
String DEVICE_TOKEN = "";


const unsigned long SCAN_INTERVAL_MS = 3000;  // Scan every 3 seconds
const unsigned long STATUS_CHECK_INTERVAL_MS = 10000;  // Check exam status every 10 seconds
const int MAX_NETWORKS = 30;
const int HTTP_RETRY_COUNT = 3;
const int HTTP_TIMEOUT_MS = 10000;

// ============================================================================
// STATE VARIABLES
// ============================================================================

// ── Hardware Pins ───────────────────────────────────────────────────────────
const int GREEN_LED_PIN = 4;
const int RED_LED_PIN = 5;
const int BUZZER_PIN = 18;
const int BUTTON_PIN = 19; // Button for network reset

unsigned long lastScanMs = 0;
unsigned long lastStatusCheckMs = 0;
unsigned long lastCredentialFetchMs = 0;
bool examActive = false;

bool credentialsFetched = false;        // Track if credentials fetched from backend

String connectedSSID = "";              // Current WiFi SSID connected to
String deviceSSID = "";                 // Device WiFi SSID (from backend)
String devicePassword = "";             // Device WiFi password (from backend)
String allowedSSID = "";                // Exam SSID from backend
String previousAllowedSSID = "";        // Track SSID changes
bool ssidMismatchDetected = false;      // Track if current SSID != allowed SSID
bool studentViolationDetected = false;  // Track if any student is flagged as disconnected by backend
unsigned long lastBuzzerToggleMs = 0;
bool buzzerState = false;


// ============================================================================
// HARDWARE STATUS
// ============================================================================

void updateHardwareStatus() {
  /**
   * Physical status indicator logic.
   * - Exam inactive: all off
   * - Mismatch/Disconnect detected: red ON + buzzer BLINK (300ms)
   * - Exam active + no mismatch: green ON
   */
   if (WiFi.status() != WL_CONNECTED) {
      ssidMismatchDetected = true; // Instantly mark disconnected as mismatch
   }

  // Bypass exam active check if a student is disconnected (still want alarm)
  if (!examActive && !studentViolationDetected) {
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
    return;
  }

  if (ssidMismatchDetected || studentViolationDetected || WiFi.status() != WL_CONNECTED) {
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, HIGH);
    
    // Non-blocking buzzer blink every 300ms
    if (millis() - lastBuzzerToggleMs >= 300) {
      lastBuzzerToggleMs = millis();
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    }
  } else {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
  }
}



// ============================================================================
// WIFI CONNECTIVITY
// ============================================================================

bool connectToWifi() {
  /**
   * Connect to the internet using WiFiManager.
   * If credentials are not saved or the saved network is unavailable,
   * it spins up an Access Point named "SEWCMS_Setup" for captive portal configuration.
   */
  WiFiManager wifiManager;

  Serial.println("[SEWCMS] Initializing WiFiManager...");
  Serial.println("[INFO] Trying saved credentials. If failed, it will broadcast 'SEWCMS_Setup'");

  // Set timeout for captive portal so device doesn't hang forever
  // wifiManager.setConfigPortalTimeout(180); // 3 minutes
  // Connect to saved WiFi or start captive portal if none is found
  bool connected = wifiManager.autoConnect("SEWCMS_Setup");

  if (!connected) {
    Serial.println("\n[ERROR] Failed to connect and hit timeout. Restarting...");
    delay(3000);
    ESP.restart();
    delay(5000);
    return false;
  }

  connectedSSID = WiFi.SSID();

  Serial.println("\n[SUCCESS] WiFi connected.");
  Serial.print("[INFO] SSID: ");
  Serial.println(connectedSSID);
  Serial.print("[INFO] IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

bool checkWifiConnected() {
  /**
   * Check if WiFi connection is still active
   * Attempt to reconnect if lost
   */
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARNING] Wi-Fi connection lost, attempting to reconnect...");
    return connectToWifi();
  }
  return true;
}

bool fetchDeviceCredentials() {
  /**
   * Fetch device WiFi credentials from backend
   * Backend returns:
   * - device_ssid: WiFi for device to use for monitoring
   * - device_password: Password for that WiFi
   * - allowed_ssid: Exam WiFi to validate students against
   * - Intervals for status checks and scans
   * 
   * This runs on first boot and periodically to get updated credentials
   * Allows admin to change WiFi without re-flashing device
   */
  if (!checkWifiConnected()) {
    Serial.println("[ERROR] WiFi not connected, cannot fetch credentials");
    return false;
  }

  HTTPClient http;
  bool credentialsReceived = false;

  for (int attempt = 1; attempt <= HTTP_RETRY_COUNT; attempt++) {
    try {
      Serial.print("[INFO] Fetching device credentials (attempt ");
      Serial.print(attempt);
      Serial.print("/");
      Serial.print(HTTP_RETRY_COUNT);
      Serial.println(")");

      http.begin(BACKEND_CONFIG_URL);
      http.setTimeout(HTTP_TIMEOUT_MS);
      http.addHeader("Content-Type", "application/json");

      int httpCode = http.GET();
      String response = http.getString();

      if (httpCode == 200) {
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, response);

        if (!error) {
          String newDeviceSSID = doc["device_ssid"].as<String>();
          String newDevicePassword = doc["device_password"].as<String>();
          String newAllowedSSID = doc["allowed_ssid"].as<String>();

          if (newDeviceSSID.length() > 0) {
            deviceSSID = newDeviceSSID;
            devicePassword = newDevicePassword;
            allowedSSID = newAllowedSSID;
            credentialsFetched = true;
            credentialsReceived = true;

            Serial.print("[SUCCESS] Device credentials fetched");
            Serial.print("[INFO] Device WiFi SSID: ");
            Serial.println(deviceSSID);
            Serial.print("[INFO] Exam SSID: ");
            Serial.println(allowedSSID);
          } else {
            Serial.println("[ERROR] Received empty device_ssid");
          }
        } else {
          Serial.print("[ERROR] JSON parsing failed: ");
          Serial.println(error.c_str());
        }
      } else {
        Serial.print("[WARNING] HTTP response code: ");
        Serial.println(httpCode);
      }

      http.end();
      if (credentialsReceived) return true;
      
      if (attempt < HTTP_RETRY_COUNT) {
        delay(500 * attempt);  // Exponential backoff
      }
    } catch (...) {
      Serial.println("[ERROR] Exception during credential fetch");
      http.end();
      if (attempt < HTTP_RETRY_COUNT) {
        delay(500 * attempt);
      }
    }
  }

  if (!credentialsReceived) {
    Serial.println("[ERROR] Failed to fetch credentials after all retries");
  }

  return credentialsReceived;
}

bool fetchExamStatus() {
  /**
   * Check if exam is currently active on backend
   * Fetch allowed SSID for exam
   * Compare with current connected SSID
   * Must succeed before scanning can proceed
   * Implements retry logic with exponential backoff
   */
  if (!checkWifiConnected()) {
    Serial.println("[ERROR] WiFi not connected, cannot check exam status");
    return false;
  }

  HTTPClient http;
  bool statusReceived = false;

  for (int attempt = 1; attempt <= HTTP_RETRY_COUNT; attempt++) {
    try {
      Serial.print("[INFO] Fetching exam status (attempt ");
      Serial.print(attempt);
      Serial.print("/");
      Serial.print(HTTP_RETRY_COUNT);
      Serial.println(")");

      http.begin(BACKEND_STATUS_URL);
      http.setTimeout(HTTP_TIMEOUT_MS);
      http.addHeader("Content-Type", "application/json");

      int httpCode = http.GET();
      String response = http.getString();

      if (httpCode == 200) {
        // Parse JSON response
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, response);

        if (!error) {
          examActive = doc["exam_active"].as<bool>();
          String newAllowedSSID = doc["allowed_ssid"].as<String>();
          
          // Extract student disconnects to trigger hardware alarm
          int total_disconnected = 0;
          if (doc.containsKey("statistics")) {
            total_disconnected = doc["statistics"]["total_disconnected"].as<int>();
          }
          studentViolationDetected = (total_disconnected > 0);
          
          if (studentViolationDetected) {
            Serial.print("[ALERT] Backend reported ");
            Serial.print(total_disconnected);
            Serial.println(" disconnected student(s)!");
          }
          
          // Detect SSID change from backend
          if (newAllowedSSID != previousAllowedSSID && previousAllowedSSID.length() > 0) {
            Serial.println();
            Serial.println("[WARNING] ⚠️  EXAM SSID CHANGED!");
            Serial.print("[WARNING] Previous allowed SSID: ");
            Serial.println(previousAllowedSSID);
            Serial.print("[WARNING] New allowed SSID: ");
            Serial.println(newAllowedSSID);
            Serial.println();
          }
          
          previousAllowedSSID = allowedSSID;  // Store old SSID
          allowedSSID = newAllowedSSID;        // Update to new SSID
          
          statusReceived = true;

          Serial.print("[SUCCESS] Exam status: ");
          Serial.println(examActive ? "ACTIVE" : "INACTIVE");
          Serial.print("[INFO] Allowed SSID: ");
          Serial.println(allowedSSID);
          
          // Validate current connection
          validateSSIDConnection();
          updateHardwareStatus();

          http.end();
          return true;
        } else {
          Serial.print("[ERROR] JSON parsing failed: ");
          Serial.println(error.c_str());
        }
      } else {
        Serial.print("[WARNING] HTTP response code: ");
        Serial.println(httpCode);
      }

      http.end();
      
      if (attempt < HTTP_RETRY_COUNT) {
        delay(500 * attempt);  // Exponential backoff
      }
    } catch (...) {
      Serial.println("[ERROR] Exception during status fetch");
      http.end();
      if (attempt < HTTP_RETRY_COUNT) {
        delay(500 * attempt);
      }
    }
  }

  if (!statusReceived) {
    Serial.println("[ERROR] Failed to fetch exam status after all retries");
    examActive = false;  // Fail-safe: assume exam not active
  }

  return statusReceived;
}


// ============================================================================
// SSID VALIDATION
// ============================================================================

void validateSSIDConnection() {
  /**
   * Compare current connected SSID with backend-allowed SSID
   * Logs match/mismatch but does NOT force reconnection
   * Backend violation logic will handle unauthorized networks
   */
  if (connectedSSID.length() == 0 || allowedSSID.length() == 0) {
    return;
  }

  if (connectedSSID == allowedSSID) {
    Serial.println("[✓] SSID Match: Connected device is on exam network");
    Serial.print("    Current SSID: ");
    Serial.println(connectedSSID);
    ssidMismatchDetected = false;
  } else {
    Serial.println("[✗] SSID Mismatch: Device NOT on exam network!");
    Serial.print("    Connected to: ");
    Serial.println(connectedSSID);
    Serial.print("    Expected:     ");
    Serial.println(allowedSSID);
    Serial.println("    [Note] Backend will flag this as violation");
    ssidMismatchDetected = true;
  }

  updateHardwareStatus();
}


// ============================================================================
// WIFI SCANNING
// ============================================================================

String buildScanPayload(int networkCount, BLEScanResults* foundBtDevices) {
  /**
   * Build JSON payload with ESP32 scan results
   * Includes:
   * - token: Device identifier
   * - connected_ssid: CURRENT WiFi device is connected to
   * - scans: List of visible WiFi networks with RSSI
   * - bluetooth_scans: List of visible BLE devices with MAC and RSSI
   * 
   * NOTE: Backend will compare connected_ssid with allowed_ssid
   */
  StaticJsonDocument<3072> doc;
  
  doc["token"] = DEVICE_TOKEN;
  doc["connected_ssid"] = connectedSSID.length() > 0 ? connectedSSID : "unknown";
  doc["connected_password"] = WiFi.psk();
  
  JsonArray scans = doc.createNestedArray("scans");
  
  int limit = networkCount < MAX_NETWORKS ? networkCount : MAX_NETWORKS;
  for (int i = 0; i < limit; i++) {
    JsonObject scan = scans.createNestedObject();
    scan["ssid"] = WiFi.SSID(i);
    scan["bssid"] = WiFi.BSSIDstr(i);
    scan["rssi"] = WiFi.RSSI(i);
  }

  JsonArray bt_scans = doc.createNestedArray("bluetooth_scans");
  if (foundBtDevices != nullptr) {
    int btCount = foundBtDevices->getCount();
    int btLimit = btCount < MAX_NETWORKS ? btCount : MAX_NETWORKS;
    for (int i = 0; i < btLimit; i++) {
      BLEAdvertisedDevice dev = foundBtDevices->getDevice(i);
      JsonObject bt_scan = bt_scans.createNestedObject();
      bt_scan["mac"] = dev.getAddress().toString().c_str();
      bt_scan["rssi"] = dev.getRSSI();
      bt_scan["name"] = dev.haveName() ? dev.getName().c_str() : "";
    }
  }

  String payload;
  serializeJson(doc, payload);
  return payload;
}

bool sendScanPayload(const String& payload) {
  /**
   * Send WiFi scan data to backend
   * Implements retry logic for reliability
   */
  HTTPClient http;
  
  for (int attempt = 1; attempt <= HTTP_RETRY_COUNT; attempt++) {
    try {
      Serial.print("[INFO] Sending scan payload (attempt ");
      Serial.print(attempt);
      Serial.println(")");

      http.begin(BACKEND_SCAN_URL);
      http.setTimeout(HTTP_TIMEOUT_MS);
      http.addHeader("Content-Type", "application/json");

      int httpCode = http.POST(payload);
      String response = http.getString();

      if (httpCode >= 200 && httpCode < 300) {
        Serial.print("[SUCCESS] Scan upload successful: ");
        Serial.println(response);
        http.end();
        return true;
      } else {
        Serial.print("[WARNING] HTTP code: ");
        Serial.println(httpCode);
      }

      http.end();
      
      if (attempt < HTTP_RETRY_COUNT) {
        delay(500 * attempt);  // Exponential backoff
      }
    } catch (...) {
      Serial.println("[ERROR] Exception during scan upload");
      http.end();
      if (attempt < HTTP_RETRY_COUNT) {
        delay(500 * attempt);
      }
    }
  }

  Serial.println("[ERROR] Failed to upload scan after all retries");
  return false;
}

void scanAndSend() {
  /**
   * Perform WiFi scan and send results to backend
   * Only executes if:
   * 1. WiFi is connected
   * 2. Exam is active on backend
   * 3. Enough time has passed since last scan
   * 
   * Reports current SSID to backend for violation detection
   */

  // Check if exam is still active (periodic status check)
  if (millis() - lastStatusCheckMs >= STATUS_CHECK_INTERVAL_MS) {
    lastStatusCheckMs = millis();
    if (!fetchExamStatus()) {
      Serial.println("[WARNING] Could not verify exam status");
      return;
    }
  }

  // Only scan if exam is active
  if (!examActive) {
    Serial.println("[INFO] Exam not active, skipping scan");
    Serial.print("[INFO] Next check in ");
    Serial.print(STATUS_CHECK_INTERVAL_MS / 1000);
    Serial.println(" seconds");

    return;
  }

  // Verify WiFi still connected
  if (!checkWifiConnected()) {
    Serial.println("[ERROR] Wi-Fi lost before scan");
    return;
  }

  // Log current SSID status before scanning
  connectedSSID = WiFi.SSID(); // Refresh actively connected SSID
  validateSSIDConnection(); 
  updateHardwareStatus();

  Serial.println();
  Serial.println("[SCAN] ========================================");
  Serial.print("[SCAN] Device connected to: ");
  Serial.println(connectedSSID);
  Serial.print("[SCAN] Exam allows:         ");
  Serial.println(allowedSSID);
  
  if (connectedSSID == allowedSSID) {
    Serial.println("[SCAN] ✓ On exam network");
  } else {
    Serial.println("[SCAN] ✗ NOT on exam network (violation will be recorded)");
  }
  Serial.println("[SCAN] ========================================");
  Serial.println();

  // Perform scan

  Serial.println("[INFO] Starting WiFi & BLE scan...");
  
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  // Start BLE scan for 2 seconds (blocks until complete)
  BLEScanResults* foundBtDevices = pBLEScan->start(2, false);
  
  int networkCount = WiFi.scanNetworks();
  
  if (networkCount < 0) {
    Serial.println("[ERROR] WiFi scan failed");

    WiFi.scanDelete();
    pBLEScan->clearResults();
    return;
  }

  Serial.print("[INFO] Found ");
  Serial.print(networkCount);
  Serial.print(" WiFi networks, ");
  if (foundBtDevices) {
    Serial.print(foundBtDevices->getCount());
  } else {
    Serial.print("0");
  }
  Serial.println(" BLE devices");

  // Build and send payload (includes current connected SSID)
  String payload = buildScanPayload(networkCount, foundBtDevices);
  bool sendSuccess = sendScanPayload(payload);

  WiFi.scanDelete();
  pBLEScan->clearResults();

}


// ============================================================================
// SETUP & LOOP
// ============================================================================

String generateDeviceToken() {
  /**
   * Generate a unique device token from the ESP32's hardware MAC address.
   * Format: "esp32-AABBCCDDEEFF" — deterministic and unique per board.
   * No hardcoded UUIDs needed; each device is automatically identified.
   */
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char token[32];
  snprintf(token, sizeof(token), "esp32-%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(token);
}

void setup() {

  // Initialize serial communication
  Serial.begin(115200);
  delay(800);

  // Initialize Hardware Pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Ensure LEDs and buzzer are OFF initially
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Generate unique device token from MAC address
  WiFi.mode(WIFI_STA);  // Need STA mode to read MAC
  DEVICE_TOKEN = generateDeviceToken();

  // Initialize BLE Scanner
  BLEDevice::init("SEWCMS_Scanner");

  Serial.println("\n\n");
  Serial.println("================================");
  Serial.println("  SEWCMS ESP32 Firmware v2.3");
  Serial.println("  Secure Exam WiFi Monitoring");
  Serial.println("  (Dynamic Device Identity)");
  Serial.println("================================");
  Serial.print("[INFO] Device Token: ");
  Serial.println(DEVICE_TOKEN);
  Serial.println();

  // Step 1: Connect to bootstrap WiFi (for backend access)
  if (!connectToWifi()) {
    Serial.println("[ERROR] Failed to connect to WiFi. Entering retry mode.");
    return;
  }

  // Step 2: Fetch device credentials from backend
  Serial.println("[INFO] Fetching device credentials from backend...");
  if (!fetchDeviceCredentials()) {
    Serial.println("[WARNING] Could not fetch device credentials");
  }

  // Step 3: Fetch initial exam status
  Serial.println("[INFO] Fetching initial exam status from backend...");
  if (!fetchExamStatus()) {
    Serial.println("[WARNING] Could not fetch initial exam status");
  }

  // Step 4: Validate current SSID connection
  Serial.println();
  validateSSIDConnection();
  Serial.println();

  Serial.println("[INFO] Setup complete. Entering scan loop.");
  Serial.println("[INFO] Will scan every 5 seconds (when exam is active)");
  Serial.println();
}

void loop() {
  // Button-triggered network reset
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("[ACTION] Resetting WiFi settings...");
    delay(300); // Debounce
    WiFi.disconnect(true);
    WiFiManager wm;
    wm.resetSettings();
    ESP.restart();
  }

  updateHardwareStatus();

  // Handle WiFi connection state
  if (WiFi.status() != WL_CONNECTED) {
    ssidMismatchDetected = true;
    updateHardwareStatus(); // Trigger immediate visual feedback before blocking reconnect
    Serial.println("[WARNING] WiFi disconnected, attempting to reconnect...");
    connectToWifi();
    return;
  }

  // Re-fetch credentials periodically (every 5 minutes)
  if (millis() - lastCredentialFetchMs >= 300000) {  // 300000ms = 5 minutes
    lastCredentialFetchMs = millis();
    Serial.println("[INFO] Time to re-fetch device credentials...");
    if (fetchDeviceCredentials()) {
      Serial.println("[SUCCESS] Device credentials updated");
    }
  }

  // Check if it's time to scan
  if (millis() - lastScanMs >= SCAN_INTERVAL_MS) {
    lastScanMs = millis();
    scanAndSend();
  }

  // Small delay to avoid watchdog issues
  delay(100);
}

#else
// Desktop fallback for VS Code IntelliSense when Arduino framework is not active.
int main() {
  return 0;
}
#endif
