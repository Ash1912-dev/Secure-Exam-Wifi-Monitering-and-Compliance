import os
from datetime import datetime, timedelta
from uuid import uuid4

from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from models import BluetoothLog, Heartbeat, ScanLog, Session, SessionLocal, Student, Violation


api_bp = Blueprint("api", __name__)

# Configuration
ALLOWED_SSID = os.getenv("SEWCMS_ALLOWED_SSID", "")
HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("SEWCMS_HEARTBEAT_TIMEOUT", "600"))  # 10 minutes
GRACE_PERIOD_SECONDS = int(os.getenv("SEWCMS_GRACE_PERIOD", "45"))  # 45 sec grace period
HOTSPOT_RSSI_THRESHOLD = int(os.getenv("SEWCMS_HOTSPOT_RSSI", "-55"))
RISK_THRESHOLD_MEDIUM = int(os.getenv("SEWCMS_RISK_MEDIUM", "30"))
RISK_THRESHOLD_HIGH = int(os.getenv("SEWCMS_RISK_HIGH", "75"))

# Violation risk values
DISCONNECT_RISK = 20
NETWORK_SWITCH_RISK = 40
HOTSPOT_RISK = 30

BLE_RSSI_THRESHOLD = int(os.getenv("SEWCMS_BLE_RSSI", "-50"))

# Global exam state
exam_state = {
    "is_active": False,
    "started_at": None,
    "stopped_at": None,
    "esp32_connected_ssid": None,
    "primary_ssid": ALLOWED_SSID,
    "primary_password": "",
}


def get_allowed_ssid():
    """Returns the dynamically set SSID from ESP32, or the environment default."""
    return exam_state.get("esp32_connected_ssid") or exam_state.get("primary_ssid") or ALLOWED_SSID


def utcnow() -> datetime:
    return datetime.utcnow()


def get_db():
    return SessionLocal()


def classify_risk_level(risk_score: int) -> str:
    """Classify risk score into Low, Medium, or High."""
    if risk_score >= RISK_THRESHOLD_HIGH:
        return "High"
    elif risk_score >= RISK_THRESHOLD_MEDIUM:
        return "Medium"
    return "Low"


def update_student_risk_status(student: Student):
    """Update student's risk level and flagged status."""
    risk_level = classify_risk_level(student.risk_score)
    student.risk_level = risk_level
    
    # Auto-flag if risk is high
    if risk_level == "High":
        student.flagged = True


def serialize_student(student: Student, last_active: datetime | None):
    return {
        "id": student.id,
        "name": student.name,
        "roll": student.roll,
        "status": student.status,
        "risk_score": student.risk_score,
        "risk_level": student.risk_level,
        "current_ssid": student.current_ssid,
        "flagged": student.flagged,
        "last_seen": last_active.isoformat() if last_active else None,
    }


def serialize_violation(v: Violation):
    return {
        "id": v.id,
        "student_id": v.student_id,
        "name": v.student.name if v.student else "UNKNOWN",
        "roll": v.student.roll if v.student else "UNKNOWN",
        "type": v.violation_type,
        "details": v.details,
        "risk_delta": v.risk_delta,
        "timestamp": v.created_at.isoformat(),
    }


def get_last_heartbeat(db, session_id: int):
    return (
        db.query(Heartbeat)
        .filter(Heartbeat.session_id == session_id)
        .order_by(desc(Heartbeat.created_at))
        .first()
    )


def has_recent_violation(db, student_id: int | None, violation_type: str, window_seconds: int = 30):
    """Check if student has recent violation of this type within time window."""
    if student_id is None:
        return False

    window_start = utcnow() - timedelta(seconds=window_seconds)
    recent = (
        db.query(Violation)
        .filter(
            Violation.student_id == student_id,
            Violation.violation_type == violation_type,
            Violation.created_at >= window_start,
        )
        .first()
    )
    return recent is not None


def add_violation(db, student: Student | None, violation_type: str, details: str, risk_delta: int):
    """Add a new violation and update student risk score."""
    violation = Violation(
        student_id=student.id if student else None,
        violation_type=violation_type,
        details=details,
        risk_delta=risk_delta,
        created_at=utcnow(),
    )
    db.add(violation)

    if student:
        student.risk_score += risk_delta
        student.status = "Violated"
        update_student_risk_status(student)
        db.add(student)


def collect_nearby_hotspots(db, lookback_seconds: int = 30):
    """Collect summary of strong unknown SSIDs detected."""
    allowed_ssid = get_allowed_ssid()
    window_start = utcnow() - timedelta(seconds=lookback_seconds)
    recent_logs = (
        db.query(ScanLog)
        .filter(
            ScanLog.created_at >= window_start,
            ScanLog.ssid != allowed_ssid,
            ScanLog.rssi >= HOTSPOT_RSSI_THRESHOLD,
        )
        .order_by(desc(ScanLog.created_at))
        .all()
    )

    hotspots = {}
    for log in recent_logs:
        if log.ssid not in hotspots:
            hotspots[log.ssid] = {
                "ssid": log.ssid,
                "strongest_rssi": log.rssi,
                "last_seen": log.created_at.isoformat(),
                "seen_count": 1,
            }
        else:
            entry = hotspots[log.ssid]
            entry["seen_count"] += 1
            entry["strongest_rssi"] = max(entry["strongest_rssi"], log.rssi)

    return list(hotspots.values())


def collect_nearby_bluetooth_devices(db, lookback_seconds: int = 30):
    """Collect summary of bluetooth devices detected."""
    window_start = utcnow() - timedelta(seconds=lookback_seconds)
    recent_logs = (
        db.query(BluetoothLog)
        .filter(BluetoothLog.created_at >= window_start)
        .order_by(desc(BluetoothLog.created_at))
        .all()
    )

    devices = {}
    for log in recent_logs:
        if log.mac not in devices:
            devices[log.mac] = {
                "mac": log.mac,
                "name": log.name or "Unknown Device",
                "strongest_rssi": log.rssi,
                "last_seen": log.created_at.isoformat(),
                "seen_count": 1,
            }
        else:
            entry = devices[log.mac]
            entry["seen_count"] += 1
            entry["strongest_rssi"] = max(entry["strongest_rssi"], log.rssi)

    return list(devices.values())


def collect_rogue_aps(db, lookback_seconds: int = 60):
    """Detect if multiple BSSIDs exist for the allowed_ssid."""
    allowed_ssid = get_allowed_ssid()
    if not allowed_ssid or not exam_state["is_active"]:
        return []

    window_start = utcnow() - timedelta(seconds=lookback_seconds)
    recent_logs = (
        db.query(ScanLog)
        .filter(
            ScanLog.created_at >= window_start,
            ScanLog.ssid == allowed_ssid,
            ScanLog.bssid.isnot(None),
            ScanLog.bssid != ""
        )
        .all()
    )

    # Group by BSSID to find distinct access points
    bssids = {}
    for log in recent_logs:
        if log.bssid not in bssids:
            bssids[log.bssid] = {
                "bssid": log.bssid,
                "strongest_rssi": log.rssi,
                "last_seen": log.created_at.isoformat(),
            }
        else:
            bssids[log.bssid]["strongest_rssi"] = max(bssids[log.bssid]["strongest_rssi"], log.rssi)
            
    # If more than 1 BSSID is broadcasting the exam WiFi
    if len(bssids) > 1:
        # Sort by strongest RSSI (assume strongest is the official one)
        sorted_bssids = sorted(bssids.values(), key=lambda x: x["strongest_rssi"], reverse=True)
        # All except the strongest are considered Rogue APs
        return sorted_bssids[1:]
    
    return []


def evaluate_disconnects(db):
    """Check for disconnected students and apply violations with grace period."""
    if not exam_state["is_active"]:
        return

    now = utcnow()
    active_sessions = db.query(Session).filter(Session.active.is_(True)).all()

    for session in active_sessions:
        student = session.student
        if not student:
            continue

        last_hb = get_last_heartbeat(db, session.id)
        last_hb_time = last_hb.created_at if last_hb else None
        
        if not last_hb_time:
            # No heartbeat yet, skip
            continue

        time_since_hb = (now - last_hb_time).total_seconds()

        # Heartbeat is fresh — student is actively connected, skip disconnect logic
        if time_since_hb <= HEARTBEAT_TIMEOUT_SECONDS:
            continue

        # Heartbeat is stale — check if within grace period
        if session.grace_period_end and now < session.grace_period_end:
            student.status = "Temporarily Disconnected"
            db.add(student)
            continue

        # Grace period expired or not set — mark disconnected
        student.status = "Disconnected"
        db.add(student)

        if not has_recent_violation(db, student.id, "DISCONNECTED", window_seconds=120):
            add_violation(
                db,
                student,
                "DISCONNECTED",
                f"Heartbeat missing for {int(time_since_hb)} seconds (>{HEARTBEAT_TIMEOUT_SECONDS}s threshold)",
                DISCONNECT_RISK,
            )

            # Set grace period for next potential disconnect
            session.grace_period_end = now + timedelta(seconds=GRACE_PERIOD_SECONDS)
            session.disconnected_count += 1
            db.add(session)


# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@api_bp.post("/config/wifi")
def set_wifi_config():
    """Set the primary WiFi SSID and password for the exam."""
    try:
        payload = request.get_json(silent=True) or {}
        ssid = (payload.get("ssid") or "").strip()
        password = (payload.get("password") or "").strip()

        if not ssid:
            return jsonify({"error": "SSID is required"}), 400

        exam_state["primary_ssid"] = ssid
        exam_state["primary_password"] = password
        exam_state["esp32_connected_ssid"] = ssid

        return jsonify({
            "message": "WiFi configuration updated",
            "ssid": ssid,
            "password_length": len(password),
            "timestamp": utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.get("/config/wifi")
def get_wifi_config():
    """Get the current WiFi configuration."""
    return jsonify({
        "primary_ssid": exam_state.get("primary_ssid", ""),
        "primary_password": exam_state.get("primary_password", ""),
        "esp32_connected_ssid": exam_state.get("esp32_connected_ssid", ""),
        "allowed_ssid": get_allowed_ssid(),
        "timestamp": utcnow().isoformat()
    })


@api_bp.get("/config/wifi-access")
def get_wifi_access_credentials():
    """Get WiFi credentials for device provisioning.
    
    ESP32 calls this after connecting to any available network to retrieve:
    - device_ssid: WiFi for device to connect to (for backend access)
    - device_password: Password for device WiFi
    - allowed_ssid: Exam WiFi SSID to validate students against
    - Intervals for status checks and scans
    
    This allows credentials to be managed entirely from backend without
    re-flashing devices with hardcoded credentials.
    """
    return jsonify({
        "device_ssid": exam_state.get("primary_ssid", ALLOWED_SSID),
        "device_password": exam_state.get("primary_password", ""),
        "allowed_ssid": get_allowed_ssid(),
        "status_check_interval_ms": 10000,
        "scan_interval_ms": 5000,
        "http_timeout_ms": 10000,
        "http_retry_count": 3,
        "timestamp": utcnow().isoformat()
    })


# ============================================================================
# EXAM CONTROL ENDPOINTS
# ============================================================================

@api_bp.post("/exam/start")
def start_exam():
    """Start exam and initialize all students."""
    db = get_db()
    try:
        exam_state["is_active"] = True
        exam_state["started_at"] = utcnow()
        exam_state["stopped_at"] = None
        exam_state["esp32_connected_ssid"] = exam_state.get("primary_ssid", ALLOWED_SSID)

        # Clear violations from previous exam
        db.query(Violation).delete()

        students = db.query(Student).all()
        for student in students:
            student.status = "Active"
            student.risk_score = 0
            student.risk_level = "Low"
            student.flagged = False
            student.current_ssid = get_allowed_ssid()
            student.last_seen = utcnow()
            db.add(student)

        db.commit()
        return jsonify({
            "message": "Exam started",
            "allowed_ssid": get_allowed_ssid(),
            "started_at": exam_state["started_at"].isoformat(),
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


@api_bp.post("/exam/stop")
def stop_exam():
    """Stop exam and close all active sessions."""
    db = get_db()
    try:
        exam_state["is_active"] = False
        exam_state["stopped_at"] = utcnow()

        active_sessions = db.query(Session).filter(Session.active.is_(True)).all()
        for session in active_sessions:
            session.active = False
            session.ended_at = utcnow()
            db.add(session)

        db.commit()
        return jsonify({
            "message": "Exam stopped",
            "stopped_at": exam_state["stopped_at"].isoformat(),
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


# ============================================================================
# STUDENT MANAGEMENT ENDPOINTS
# ============================================================================

@api_bp.post("/student/login")
def login_student():
    """Authenticate student and create session."""
    db = get_db()
    try:
        if not exam_state["is_active"]:
            return jsonify({"error": "Exam is not active. Student login not allowed."}), 403

        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or "").strip()
        roll = (payload.get("roll") or "").strip()

        if not name or not roll:
            return jsonify({"error": "Both name and roll are required"}), 400

        allowed_ssid = get_allowed_ssid()
        
        # Check for existing student
        student = db.query(Student).filter(Student.roll == roll).first()
        if not student:
            student = Student(
                name=name, 
                roll=roll, 
                status="Active", 
                current_ssid=allowed_ssid,
                risk_level="Low",
                last_seen=utcnow()
            )
            db.add(student)
            db.flush()
        else:
            student.name = name
            student.status = "Active"
            student.current_ssid = allowed_ssid
            student.last_seen = utcnow()
            db.add(student)

        # End existing sessions
        existing_sessions = db.query(Session).filter(
            Session.student_id == student.id, 
            Session.active.is_(True)
        ).all()
        for existing in existing_sessions:
            existing.active = False
            existing.ended_at = utcnow()
            db.add(existing)

        # Create new session with grace period
        token = str(uuid4())
        new_session = Session(
            token=token, 
            student_id=student.id, 
            active=True, 
            created_at=utcnow(),
            grace_period_end=utcnow() + timedelta(seconds=GRACE_PERIOD_SECONDS)
        )
        db.add(new_session)
        db.commit()

        return jsonify({
            "token": token,
            "student": serialize_student(student, utcnow()),
            "allowed_ssid": allowed_ssid,
            "allowed_password": exam_state.get("primary_password", ""),
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


@api_bp.delete("/student/<int:student_id>")
def delete_student(student_id: int):
    """Delete a specific student and their associated data."""
    db = get_db()
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return jsonify({"error": "Student not found"}), 404

        student_name = student.name
        db.delete(student)
        db.commit()

        return jsonify({
            "message": f"Student {student_name} deleted successfully",
            "deleted_id": student_id,
            "timestamp": utcnow().isoformat()
        })
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@api_bp.post("/students/delete-all")
def delete_all_students():
    """Delete all students and reset the system."""
    db = get_db()
    try:
        count = db.query(Student).delete()
        db.query(Session).delete()
        db.query(Violation).delete()
        db.query(Heartbeat).delete()
        db.query(ScanLog).delete()
        db.query(BluetoothLog).delete()
        db.commit()

        return jsonify({
            "message": "All students deleted and system reset",
            "deleted_count": count,
            "timestamp": utcnow().isoformat()
        })
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


# ============================================================================
# HEARTBEAT & STATUS ENDPOINTS
# ============================================================================

@api_bp.post("/heartbeat")
def heartbeat():
    """Process heartbeat from student device."""
    db = get_db()
    try:
        payload = request.get_json(silent=True) or {}
        token = payload.get("token")
        allowed_ssid = get_allowed_ssid()
        ssid = (payload.get("ssid") or allowed_ssid).strip()

        if not token:
            return jsonify({"error": "token is required"}), 400

        session = db.query(Session).filter(
            Session.token == token, 
            Session.active.is_(True)
        ).first()
        if not session:
            return jsonify({"error": "Invalid or expired session token"}), 401

        student = session.student
        if not student:
            return jsonify({"error": "Student not found for session"}), 404

        # Record heartbeat
        now = utcnow()
        hb = Heartbeat(session_id=session.id, ssid=ssid, created_at=now)
        db.add(hb)
        
        # Update student
        student.current_ssid = ssid
        student.status = "Active"
        student.last_seen = now
        
        # Clear grace period on successful heartbeat
        if session.grace_period_end and now < session.grace_period_end:
            session.grace_period_end = now + timedelta(seconds=GRACE_PERIOD_SECONDS)
        
        session.last_heartbeat = now
        db.add(student)
        db.add(session)

        response_status = "Connected"
        
        # Check for network switch (only if allowed SSID is configured)
        if allowed_ssid and ssid != allowed_ssid and not has_recent_violation(db, student.id, "NETWORK_SWITCH"):
            add_violation(
                db,
                student,
                "NETWORK_SWITCH",
                f"Student connected to unauthorized SSID '{ssid}'",
                NETWORK_SWITCH_RISK,
            )
            response_status = "Violation"

        db.commit()

        return jsonify({
            "status": response_status,
            "risk_score": student.risk_score,
            "risk_level": student.risk_level,
            "flagged": student.flagged,
            "allowed_ssid": allowed_ssid,
            "reported_ssid": ssid,
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


@api_bp.get("/status")
def status():
    """Get current exam status and connected students."""
    db = get_db()
    try:
        evaluate_disconnects(db)
        db.commit()

        students = db.query(Student).order_by(Student.roll.asc()).all()
        active_sessions = {
            session.student_id: session
            for session in db.query(Session).filter(Session.active.is_(True)).all()
        }

        rows = []
        for student in students:
            session = active_sessions.get(student.id)
            last_hb = get_last_heartbeat(db, session.id) if session else None
            rows.append(serialize_student(student, last_hb.created_at if last_hb else student.last_seen))

        # Summary statistics
        all_flagged = [s for s in students if s.flagged]
        high_risk = [s for s in students if s.risk_level == "High"]
        disconnected = [s for s in students if s.status == "Disconnected"]

        nearby_hotspots = collect_nearby_hotspots(db)
        nearby_bluetooth = collect_nearby_bluetooth_devices(db)
        rogue_aps = collect_rogue_aps(db)

        return jsonify({
            "exam_active": exam_state["is_active"],
            "allowed_ssid": get_allowed_ssid(),
            "allowed_password": exam_state.get("primary_password", ""),
            "students": rows,
            "count": len(rows),
            "statistics": {
                "total_active": sum(1 for s in students if s.status == "Active"),
                "total_disconnected": len(disconnected),
                "total_violated": sum(1 for s in students if s.status == "Violated"),
                "total_flagged": len(all_flagged),
                "high_risk_students": len(high_risk),
            },
            "nearby_hotspots": nearby_hotspots,
            "nearby_bluetooth": nearby_bluetooth,
            "rogue_aps": rogue_aps,
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


# ============================================================================
# SCANNING ENDPOINTS
# ============================================================================

@api_bp.post("/scan")
def scan_networks():
    """Process WiFi scan results from ESP32."""
    db = get_db()
    try:
        if not exam_state["is_active"]:
            return jsonify({"error": "Exam is not active. Scans not allowed."}), 403

        payload = request.get_json(silent=True)

        scans = []
        bluetooth_scans = []
        token = None
        connected_ssid = None

        if isinstance(payload, list):
            scans = payload
        elif isinstance(payload, dict):
            scans = payload.get("wifi_scans", payload.get("scans", []))
            bluetooth_scans = payload.get("bluetooth_scans", [])
            token = payload.get("token")
            connected_ssid = payload.get("connected_ssid")
            connected_password = payload.get("connected_password")

        if not isinstance(scans, list):
            return jsonify({"error": "Input must be a list of {ssid, rssi}"}), 400

        # Update ESP32 connected SSID and Password if provided
        if connected_ssid and connected_ssid.strip() and connected_ssid != "unknown":
            exam_state["esp32_connected_ssid"] = connected_ssid.strip()
            exam_state["primary_ssid"] = connected_ssid.strip()
        
        if connected_password and connected_password.strip():
            exam_state["primary_password"] = connected_password.strip()

        session = None
        student = None
        if token:
            session = db.query(Session).filter(
                Session.token == token, 
                Session.active.is_(True)
            ).first()
            if session:
                student = session.student

        allowed_ssid = get_allowed_ssid()
        hotspot_count = 0
        for item in scans:
            ssid = str(item.get("ssid", "")).strip()
            bssid = str(item.get("bssid", "")).strip()
            rssi = float(item.get("rssi", -100))
            if not ssid:
                continue

            scan_log = ScanLog(
                session_id=session.id if session else None,
                student_id=student.id if student else None,
                ssid=ssid,
                bssid=bssid,
                rssi=rssi,
                created_at=utcnow(),
            )
            db.add(scan_log)

            # Hotspot detection
            if ssid != allowed_ssid and rssi >= HOTSPOT_RSSI_THRESHOLD:
                hotspot_count += 1
                if student and not has_recent_violation(db, student.id, "HOTSPOT", window_seconds=60):
                    add_violation(
                        db,
                        student,
                        "HOTSPOT",
                        f"Strong unknown SSID detected: {ssid} ({rssi} dBm)",
                        HOTSPOT_RISK,
                    )

        bl_count = 0
        for item in bluetooth_scans:
            mac = str(item.get("mac", "")).strip()
            rssi = float(item.get("rssi", -100))
            name = str(item.get("name", "")).strip()
            if not mac:
                continue

            bt_log = BluetoothLog(
                session_id=session.id if session else None,
                mac=mac,
                name=name,
                rssi=rssi,
                created_at=utcnow(),
            )
            db.add(bt_log)
            bl_count += 1

        db.commit()
        return jsonify({
            "message": "Scan logs stored",
            "hotspot_events": hotspot_count,
            "bluetooth_devices_logged": bl_count,
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


@api_bp.get("/scan/live")
def get_live_scans():
    """Get recent WiFi scan data (last 60 seconds)."""
    db = get_db()
    try:
        allowed_ssid = get_allowed_ssid()
        window_start = utcnow() - timedelta(seconds=60)
        
        all_scans = (
            db.query(ScanLog)
            .filter(ScanLog.created_at >= window_start)
            .order_by(desc(ScanLog.created_at))
            .all()
        )

        # Organize by SSID
        by_ssid = {}
        for scan in all_scans:
            if scan.ssid not in by_ssid:
                by_ssid[scan.ssid] = {
                    "ssid": scan.ssid,
                    "is_allowed": scan.ssid == allowed_ssid,
                    "strongest_rssi": scan.rssi,
                    "latest_time": scan.created_at.isoformat(),
                    "count": 1
                }
            else:
                entry = by_ssid[scan.ssid]
                entry["strongest_rssi"] = max(entry["strongest_rssi"], scan.rssi)
                entry["latest_time"] = max(entry["latest_time"], scan.created_at.isoformat())
                entry["count"] += 1

        return jsonify({
            "scans": list(by_ssid.values()),
            "total_networks_seen": len(by_ssid),
            "allowed_ssid": allowed_ssid,
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


# ============================================================================
# REPORTING ENDPOINTS
# ============================================================================

@api_bp.get("/report/final")
def get_exam_report():
    """Generate comprehensive final exam report."""
    db = get_db()
    try:
        students = db.query(Student).order_by(Student.risk_score.desc()).all()
        violations = db.query(Violation).order_by(desc(Violation.created_at)).all()

        student_report = []
        for student in students:
            student_violations = db.query(Violation).filter(
                Violation.student_id == student.id
            ).order_by(desc(Violation.created_at)).all()

            violation_types = {}
            for v in student_violations:
                violation_types[v.violation_type] = violation_types.get(v.violation_type, 0) + 1

            student_report.append({
                "name": student.name,
                "roll": student.roll,
                "status": student.status,
                "risk_score": student.risk_score,
                "risk_level": student.risk_level,
                "flagged": student.flagged,
                "total_violations": len(student_violations),
                "violation_breakdown": violation_types,
                "violations": [{
                    "type": v.violation_type,
                    "details": v.details,
                    "risk_delta": v.risk_delta,
                    "timestamp": v.created_at.isoformat()
                } for v in student_violations]
            })

        violation_summary = {}
        for v in violations:
            violation_summary[v.violation_type] = violation_summary.get(v.violation_type, 0) + 1

        total_risk = sum(s.risk_score for s in students)
        avg_risk = total_risk // len(students) if students else 0

        # Risk distribution
        risk_dist = {
            "low": sum(1 for s in students if s.risk_level == "Low"),
            "medium": sum(1 for s in students if s.risk_level == "Medium"),
            "high": sum(1 for s in students if s.risk_level == "High")
        }

        return jsonify({
            "exam_duration": {
                "started_at": exam_state.get("started_at").isoformat() if exam_state.get("started_at") else None,
                "stopped_at": exam_state.get("stopped_at").isoformat() if exam_state.get("stopped_at") else None,
                "duration_seconds": int((exam_state.get("stopped_at") or utcnow() - exam_state.get("started_at", utcnow())).total_seconds()) if exam_state.get("started_at") else 0
            },
            "summary": {
                "total_students": len(students),
                "total_violations": len(violations),
                "total_risk_points": total_risk,
                "average_risk": avg_risk,
                "risk_distribution": risk_dist,
                "flagged_students": sum(1 for s in students if s.flagged),
                "violation_type_breakdown": violation_summary
            },
            "students": student_report,
            "timestamp": utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


# ============================================================================
# MONITORING ENDPOINTS
# ============================================================================

@api_bp.get("/violations")
def violations():
    """Get recent violations."""
    db = get_db()
    try:
        evaluate_disconnects(db)
        db.commit()

        logs = db.query(Violation).order_by(desc(Violation.created_at)).limit(200).all()
        
        # Classify violations by type
        by_type = {}
        for v in logs:
            if v.violation_type not in by_type:
                by_type[v.violation_type] = []
            by_type[v.violation_type].append(serialize_violation(v))

        return jsonify({
            "violations": [serialize_violation(v) for v in logs],
            "by_type": by_type,
            "count": len(logs),
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


@api_bp.get("/students")
def get_students():
    """Get all students with extended status."""
    db = get_db()
    try:
        evaluate_disconnects(db)
        db.commit()

        students = db.query(Student).order_by(Student.roll.asc()).all()
        active_sessions = {
            session.student_id: session
            for session in db.query(Session).filter(Session.active.is_(True)).all()
        }

        rows = []
        for student in students:
            session = active_sessions.get(student.id)
            last_hb = get_last_heartbeat(db, session.id) if session else None
            
            # Count violations by type
            violations_by_type = {}
            for v in student.violations:
                violations_by_type[v.violation_type] = violations_by_type.get(v.violation_type, 0) + 1
            
            rows.append({
                **serialize_student(student, last_hb.created_at if last_hb else student.last_seen),
                "session_active": session is not None,
                "violations_by_type": violations_by_type,
                "total_violations": len(student.violations)
            })

        return jsonify({
            "students": rows,
            "count": len(rows),
            "timestamp": utcnow().isoformat()
        })
    finally:
        db.close()


# ============================================================================
# SYSTEM ENDPOINTS
# ============================================================================

@api_bp.post("/system/reset")
def reset_system():
    """Reset entire system for new exam."""
    db = get_db()
    try:
        # Clear all data
        db.query(Student).delete()
        db.query(Session).delete()
        db.query(Violation).delete()
        db.query(Heartbeat).delete()
        db.query(ScanLog).delete()

        # Reset exam state
        exam_state["is_active"] = False
        exam_state["started_at"] = None
        exam_state["stopped_at"] = None

        db.commit()

        return jsonify({
            "message": "System reset for new exam",
            "status": "ready",
            "timestamp": utcnow().isoformat()
        })
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@api_bp.get("/config")
def get_config():
    """Get system configuration and constants."""
    return jsonify({
        "exam_active": exam_state["is_active"],
        "grace_period_seconds": GRACE_PERIOD_SECONDS,
        "heartbeat_timeout_seconds": HEARTBEAT_TIMEOUT_SECONDS,
        "risk_thresholds": {
            "medium": RISK_THRESHOLD_MEDIUM,
            "high": RISK_THRESHOLD_HIGH
        },
        "violation_risks": {
            "disconnect": DISCONNECT_RISK,
            "network_switch": NETWORK_SWITCH_RISK,
            "hotspot": HOTSPOT_RISK
        },
        "allowed_ssid": get_allowed_ssid(),
        "timestamp": utcnow().isoformat()
    })


@api_bp.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "SEWCMS backend",
        "exam_active": exam_state["is_active"],
        "timestamp": utcnow().isoformat()
    })
