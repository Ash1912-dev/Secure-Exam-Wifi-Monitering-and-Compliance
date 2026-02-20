from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

AUTHORIZED_SSID = "EXAM_WIFI"

exam_mode = False

# Databases in memory (later we add SQLite)
students = {}       # roll -> {name, last_seen, ssid}
violations = []     # list of events
wifi_events = []    # from ESP32

HEARTBEAT_TIMEOUT = 12   # seconds

HOTSPOT_KEYWORDS = [
    "iphone", "redmi", "oneplus",
    "realme", "samsung", "oppo",
    "vivo", "galaxy", "pixel"
]

# ---------- HELPERS ----------

def now():
    return datetime.now()

def now_str():
    return now().strftime("%H:%M:%S")

def add_violation(roll, name, vtype, details=""):
    violations.append({
        "roll": roll,
        "name": name,
        "type": vtype,
        "details": details,
        "time": now_str()
    })

def is_hotspot(ssid, rssi):
    ssid = ssid.lower()
    name_match = any(k in ssid for k in HOTSPOT_KEYWORDS)
    strong = rssi > -55
    return name_match and strong

def check_disconnects():
    if not exam_mode:
        return

    for roll, s in students.items():
        if (now() - s["last_seen"]) > timedelta(seconds=HEARTBEAT_TIMEOUT):

            # avoid duplicate logs
            already = any(v["roll"] == roll and v["type"] == "DISCONNECTED" for v in violations)

            if not already:
                add_violation(
                    roll,
                    s["name"],
                    "DISCONNECTED",
                    "Heartbeat missing"
                )

# ---------- ROUTES ----------

@app.route("/status")
def status():
    check_disconnects()
    return jsonify({
        "exam_mode": exam_mode,
        "students": students,
        "violations": violations
    })

@app.route("/exam/start", methods=["POST"])
def start_exam():
    global exam_mode, violations
    exam_mode = True
    violations = []

    # reset last seen
    for s in students.values():
        s["last_seen"] = now()

    return jsonify({"message": "Exam Mode ON"})

@app.route("/exam/stop", methods=["POST"])
def stop_exam():
    global exam_mode
    exam_mode = False

    check_disconnects()

    return jsonify({
        "message": "Exam Mode OFF",
        "violations": violations
    })

@app.route("/student/login", methods=["POST"])
def login():
    data = request.json
    roll = data.get("roll")
    name = data.get("name")

    students[roll] = {
        "name": name,
        "last_seen": now(),
        "ssid": AUTHORIZED_SSID
    }

    return jsonify({"message": "login success"})

@app.route("/heartbeat", methods=["POST"])
def heartbeat():
    if not exam_mode:
        return jsonify({"status": "ignored"})

    data = request.json
    roll = data.get("roll")
    ssid = data.get("ssid")

    if roll not in students:
        return jsonify({"error": "not registered"}), 400

    students[roll]["last_seen"] = now()
    students[roll]["ssid"] = ssid

    if ssid != AUTHORIZED_SSID:
        add_violation(
            roll,
            students[roll]["name"],
            "NETWORK_SWITCHED",
            f"SSID: {ssid}"
        )

    return jsonify({"status": "ok"})

@app.route("/scan", methods=["POST"])
def scan():
    if not exam_mode:
        return jsonify({"status": "ignored"})

    data = request.json
    ssid = data.get("ssid")
    rssi = data.get("rssi", -100)

    wifi_events.append(data)

    if ssid != AUTHORIZED_SSID and is_hotspot(ssid, rssi):
        add_violation(
            "UNKNOWN",
            "Unknown",
            "HOTSPOT_DETECTED",
            f"{ssid} RSSI:{rssi}"
        )

    return jsonify({"status": "logged"})

@app.route("/violations")
def get_violations():
    check_disconnects()
    return jsonify(violations)

# ---------- RUN ----------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
