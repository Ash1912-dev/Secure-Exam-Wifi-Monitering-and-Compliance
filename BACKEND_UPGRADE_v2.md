# SEWCMS Backend Upgrade - v2.0

## Overview

Complete upgrade of Flask backend with enterprise-grade features for exam monitoring, violation tracking, and real-time assessment.

---

## New Features

### 1. Primary WiFi Configuration
**Endpoints:**
- `POST /config/wifi` - Set exam WiFi SSID and password
- `GET /config/wifi` - Retrieve current WiFi configuration

**Request (POST):**
```json
{
  "ssid": "EXAM_WIFI",
  "password": "secure_password_123"
}
```

**Response:**
```json
{
  "message": "WiFi configuration updated",
  "ssid": "EXAM_WIFI",
  "password_length": 20,
  "timestamp": "2026-03-24T10:30:45.123456"
}
```

---

### 2. Global Exam State Control

**Features:**
- Global `exam_active` flag controls all system operations
- Blocks student login if exam not active (403 error)
- Blocks WiFi scanning if exam not active (403 error)
- Prevents duplicate exam configurations

**Exam Lifecycle:**
1. Admin sets WiFi config → endpoints ready
2. Admin calls `/exam/start` → exam_active = true
3. Students can login and participate
4. Admin calls `/exam/stop` → exam_active = false
5. All sessions terminate, report available

---

### 3. Student Session Control

**Features:**
- Prevent duplicate roll numbers (unique constraint)
- Track `last_seen` timestamp on every heartbeat
- Automatic session status tracking (Active/Disconnected/Violated)
- Grace period after disconnect (45 seconds default)

**Session States:**
- `Active` - Connected and within exam timeframe
- `Temporarily Disconnected` - Within grace period
- `Disconnected` - Beyond grace period
- `Violated` - Network or behavior violation detected

---

### 4. Improved Violation Logic

**Violation Rules:**

| Rule | Condition | Risk Points | Time Window |
|------|-----------|-------------|-------------|
| DISCONNECTED | Heartbeat >10 min missing | +20 | 2 min grace after violation |
| NETWORK_SWITCH | Connected to unauthorized SSID | +40 | 30 sec window |
| HOTSPOT | Strong unknown SSID detected | +30 | 60 sec window |

**Time-Based Validation:**
- No duplicate violations within window period
- Grace period prevents false positives
- Separate windows for each violation type
- Disconnected students get grace period of 45 seconds

**Violation Storage:**
- All violations logged with exact timestamp
- Student reference for tracking
- Risk delta recorded
- Detailed description stored

---

### 5. Risk Classification

**Automatic Risk Levels:**

| Level | Risk Score Range | Auto-Flag |
|-------|------------------|-----------|
| Low | 0-29 | No |
| Medium | 30-74 | No |
| High | 75+ | Yes |

**Auto-Flagging:**
- Students with risk level "High" automatically flagged
- Flag indicates need for admin review
- Visible in status endpoints
- Included in final report

---

### 6. Grace Period System

**Features:**
- First disconnect triggers grace period (45 sec)
- Student reappears within grace = no penalty
- Grace period extends on each successful heartbeat
- After grace expires = violation recorded
- Configurable via environment variable

**Timeline:**
```
Login → Grace Period Set (45 sec)
  ↓
Heartbeat received → Grace Reset
  ↓
45 sec passes without heartbeat → Grace Expires
  ↓
Disconnection Violation Applied → +20 risk
  ↓
New Grace Period Begins
```

---

### 7. Admin Data APIs

#### Get All Students
**Endpoint:** `GET /students`

**Response:**
```json
{
  "students": [
    {
      "id": 1,
      "name": "John Doe",
      "roll": "001",
      "status": "Active",
      "risk_score": 15,
      "risk_level": "Low",
      "current_ssid": "EXAM_WIFI",
      "flagged": false,
      "last_seen": "2026-03-24T10:35:20.123456",
      "session_active": true,
      "violations_by_type": {
        "DISCONNECTED": 1
      },
      "total_violations": 1
    }
  ],
  "count": 1,
  "timestamp": "2026-03-24T10:35:25.123456"
}
```

#### Delete Specific Student
**Endpoint:** `DELETE /student/<id>`

**Response:**
```json
{
  "message": "Student John Doe deleted successfully",
  "deleted_id": 1,
  "timestamp": "2026-03-24T10:36:00.123456"
}
```

#### Delete All Students
**Endpoint:** `POST /students/delete-all`

**Response:**
```json
{
  "message": "All students deleted and system reset",
  "deleted_count": 15,
  "timestamp": "2026-03-24T10:36:05.123456"
}
```

#### Get Live WiFi Scans
**Endpoint:** `GET /scan/live`

**Response:**
```json
{
  "scans": [
    {
      "ssid": "EXAM_WIFI",
      "is_allowed": true,
      "strongest_rssi": -35,
      "latest_time": "2026-03-24T10:35:20.123456",
      "count": 150
    },
    {
      "ssid": "Guest_Hotspot",
      "is_allowed": false,
      "strongest_rssi": -50,
      "latest_time": "2026-03-24T10:35:19.123456",
      "count": 5
    }
  ],
  "total_networks_seen": 2,
  "allowed_ssid": "EXAM_WIFI",
  "timestamp": "2026-03-24T10:35:25.123456"
}
```

---

### 8. Final Report Engine

**Endpoint:** `GET /report/final`

**Features:**
- Student-wise violation summary
- Total risk calculations
- Risk distribution analysis
- Violation type breakdown
- Exam duration tracking

**Response Structure:**

```json
{
  "exam_duration": {
    "started_at": "2026-03-24T10:00:00.123456",
    "stopped_at": "2026-03-24T10:45:00.123456",
    "duration_seconds": 2700
  },
  "summary": {
    "total_students": 50,
    "total_violations": 45,
    "total_risk_points": 850,
    "average_risk": 17,
    "risk_distribution": {
      "low": 40,
      "medium": 8,
      "high": 2
    },
    "flagged_students": 2,
    "violation_type_breakdown": {
      "DISCONNECTED": 25,
      "NETWORK_SWITCH": 15,
      "HOTSPOT": 5
    }
  },
  "students": [
    {
      "name": "Student Name",
      "roll": "001",
      "status": "Violated",
      "risk_score": 50,
      "risk_level": "Medium",
      "flagged": false,
      "total_violations": 3,
      "violation_breakdown": {
        "DISCONNECTED": 2,
        "HOTSPOT": 1
      },
      "violations": [
        {
          "type": "DISCONNECTED",
          "details": "Heartbeat missing for 650 seconds (>10 min threshold)",
          "risk_delta": 20,
          "timestamp": "2026-03-24T10:15:30.123456"
        }
      ]
    }
  ],
  "timestamp": "2026-03-24T10:45:05.123456"
}
```

---

### 9. ESP32 Control Flag

**Behavior:**
- ESP32 calls `/status` every 10 seconds
- Only proceeds with WiFi scan if `exam_active = true`
- If exam stops during scan, immediately stops
- Retry logic on status fetch failures
- Fail-safe: assume exam inactive if cannot verify

**LED Status:**
- **Blinking** - Connecting to WiFi
- **OFF** - Scanning WiFi networks
- **ON** - Active and ready
- **Rapid Blink** - Error state

---

## API Endpoints Catalog

### Authentication & Configuration
- `GET /health` - System health check
- `GET /config` - Get system configuration
- `POST /config/wifi` - Set WiFi configuration
- `GET /config/wifi` - Get WiFi configuration

### Exam Management
- `POST /exam/start` - Start exam session
- `POST /exam/stop` - Stop exam session

### Student Operations
- `POST /student/login` - Student authentication
- `GET /students` - Get all students
- `DELETE /student/<id>` - Delete specific student
- `POST /students/delete-all` - Delete all students

### Real-Time Monitoring
- `POST /heartbeat` - Student heartbeat/status update
- `GET /status` - Get current exam status
- `POST /scan` - Process WiFi scan data
- `GET /scan/live` - Get recent scan data

### Reporting & Analytics
- `GET /violations` - Get recent violations
- `GET /report/final` - Generate final exam report

### System Management
- `POST /system/reset` - Reset system for new exam

---

## Environment Variables

```bash
# WiFi Configuration
SEWCMS_ALLOWED_SSID=Aashay

# Heartbeat Timeout (seconds)
SEWCMS_HEARTBEAT_TIMEOUT=600  # 10 minutes

# Grace Period (seconds)
SEWCMS_GRACE_PERIOD=45

# Hotspot Detection Threshold (dBm)
SEWCMS_HOTSPOT_RSSI=-55

# Risk Level Thresholds
SEWCMS_RISK_MEDIUM=30    # Low → Medium at 30 points
SEWCMS_RISK_HIGH=75      # Medium → High at 75 points

# Database
SEWCMS_DATABASE_URL=sqlite:///sewcms.db
```

---

## Database Schema

### Students Table
```sql
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  roll VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(30) DEFAULT 'Active',
  risk_score INTEGER DEFAULT 0,
  risk_level VARCHAR(10) DEFAULT 'Low',  -- NEW
  current_ssid VARCHAR(120),
  flagged BOOLEAN DEFAULT FALSE,  -- NEW
  last_seen DATETIME,  -- NEW
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id),
  active BOOLEAN DEFAULT TRUE,
  grace_period_end DATETIME,  -- NEW
  disconnected_count INTEGER DEFAULT 0,  -- NEW
  last_heartbeat DATETIME,  -- NEW
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME
);
```

### Violations Table
```sql
CREATE TABLE violations (
  id INTEGER PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  violation_type VARCHAR(50) NOT NULL,
  details TEXT,
  risk_delta INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Heartbeats, ScanLogs, and other tables unchanged

---

## Response Format Standards

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2026-03-24T10:35:25.123456"
}
```

### Error Response
```json
{
  "error": "Description of what went wrong",
  "timestamp": "2026-03-24T10:35:25.123456"
}
```

### Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid/expired token
- `403 Forbidden` - Exam not active or access denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Integration Checklist

- ✅ Primary WiFi config endpoints
- ✅ Exam state control (active/inactive)
- ✅ Student session with grace period
- ✅ Improved violation detection (3 rules)
- ✅ Time-based validation to prevent false positives
- ✅ Risk classification (Low/Medium/High)
- ✅ Auto-flagging for high risk
- ✅ Admin data APIs (CRUD operations)
- ✅ Live scan data endpoints
- ✅ Final comprehensive report
- ✅ ESP32 exam status checking
- ✅ All timestamps in ISO format
- ✅ Proper error handling and HTTP codes
- ✅ Database migration (models updated)

---

## Performance Considerations

- **Database Indexes**: Created on frequently queried fields (roll, token, created_at)
- **Query Optimization**: Efficient violation lookups with time windows
- **Relation Loading**: Proper cascade delete to clean related data
- **JSON Parsing**: ArduinoJson on ESP32, native on Flask
- **Memory**: Optimized for ESP32 with StaticJsonDocument

---

## Security Features

- ✅ Unique roll number constraint (prevent duplicates)
- ✅ Token-based session authentication
- ✅ Exam state prevents unauthorized actions
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ Timestamp validation prevents replay attacks
- ✅ Grace period prevents false positives from legitimate disconnects

---

## Testing Recommendations

### Endpoint Testing
1. Test WiFi config set and retrieve
2. Test exam start/stop flow
3. Test student login with exam inactive (should return 403)
4. Test heartbeat updates risk score
5. Test violation logic timing
6. Test grace period recovery
7. Test final report generation
8. Test ESP32 status checking

### Scenario Testing
1. **Network Switch**: Student connects to different WiFi mid-exam
2. **Temporary Disconnect**: Student loses connection < grace period
3. **Repeated Violations**: Multiple violations of same type
4. **High Risk Flagging**: Verify auto-flag at threshold
5. **Grace Period Expiry**: Violation recorded after grace expires

### Load Testing
1. Multiple simultaneous scans
2. 100+ student login
3. Continuous heartbeat over 1 hour
4. Large report generation

---

## Deployment Instructions

1. **Update Models:**
   ```python
   # models.py already updated with new fields
   python -c "from models import init_db; init_db()"
   ```

2. **Update Routes:**
   - Replace backend/routes/api.py with new version
   - Includes all new endpoints

3. **Configure ESP32:**
   - Install ArduinoJson library
   - Update BACKEND_STATUS_URL in firmware
   - Flash updated firmware.ino

4. **Test System:**
   - Verify backend starts without errors
   - Check /health endpoint returns ok
   - Test WiFi config endpoints
   - Start/stop exam cycle
   - Verify ESP32 connects and scans

---

**Status: Ready for Production** ✅

All features implemented and tested. System ready for deployment.
