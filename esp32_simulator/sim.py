import requests
import random
import time

SERVER = "http://localhost:5000/scan"

# Fake nearby networks
NETWORK_POOL = [
    ("EXAM_WIFI", -40),
    ("Home_Router", -70),
    ("Aashay_iPhone", -42),
    ("Redmi_Note10", -48),
    ("Library_WiFi", -65)
]

print("Virtual ESP32 started...")

while True:

    # pick random network like real scan
    ssid, base_rssi = random.choice(NETWORK_POOL)

    # add noise to RSSI
    rssi = base_rssi + random.randint(-5, 5)

    payload = {
        "ssid": ssid,
        "rssi": rssi
    }

    try:
        res = requests.post(SERVER, json=payload)
        print("Sent:", payload, "->", res.json())
    except Exception as e:
        print("Server not running:", e)

    time.sleep(6)
