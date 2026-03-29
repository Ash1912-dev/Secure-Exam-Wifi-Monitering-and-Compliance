# Secure Exam Wi-Fi Compliance & Monitoring System (SEWCMS)

Production-style college project for monitoring whether students remain on authorized exam Wi-Fi.

## 1. Folder Structure

```text
backend/
  app.py
  models.py
  requirements.txt
  .env.example
  routes/
    __init__.py
    api.py
frontend/
  student/
    index.html
    package.json
    vite.config.js
    .env.example
    src/
      main.jsx
      App.jsx
      api.js
      styles.css
  admin/
    index.html
    package.json
    vite.config.js
    .env.example
    src/
      main.jsx
      App.jsx
      api.js
      styles.css
esp32/
  firmware.ino
```

## 2. Backend APIs

- POST /exam/start
- POST /exam/stop
- POST /student/login
- POST /heartbeat
- POST /scan
- GET /status
- GET /violations
- GET /health

### Violation Rules

- No heartbeat >10 sec -> DISCONNECTED (+20)
- Heartbeat SSID != allowed SSID -> NETWORK_SWITCH (+40)
- Strong unknown SSID (RSSI >= threshold) in /scan -> HOTSPOT (+30)

## 3. Run in VS Code

### Backend (Flask + SQLite)

1. Open terminal in backend folder.
2. Install dependencies.
3. Run Flask app.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend starts on http://localhost:5000

### Student Frontend

```powershell
cd frontend/student
npm install
npm run dev
```

Student UI starts on http://localhost:5173

### Admin Frontend

```powershell
cd frontend/admin
npm install
npm run dev
```

Admin UI starts on http://localhost:5174

## 4. ESP32 Firmware

Open esp32/firmware.ino in Arduino IDE or PlatformIO and update:

- WIFI_SSID
- WIFI_PASSWORD
- BACKEND_SCAN_URL
- DEVICE_TOKEN (optional, can be generated from /student/login)

Then upload to ESP32. The device behavior is:

- Blinks LED (GPIO2) while connecting
- Keeps LED ON when connected
- Turns LED OFF during Wi-Fi scan
- Scans every 5 seconds
- Sends scan JSON to /scan with retry logic

## 5. Example Payloads

### POST /student/login

```json
{
  "name": "Alice",
  "roll": "22CS101"
}
```

### POST /heartbeat

```json
{
  "token": "session-token",
  "ssid": "EXAM_WIFI"
}
```

### POST /scan

```json
{
  "token": "session-token-or-optional",
  "scans": [
    { "ssid": "EXAM_WIFI", "rssi": -42 },
    { "ssid": "PhoneHotspot", "rssi": -48 }
  ]
}
```
