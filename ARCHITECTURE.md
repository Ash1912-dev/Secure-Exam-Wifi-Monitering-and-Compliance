# SEWCMS Architecture & Data Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    STUDENT DEVICES (ESP32)                 │
│  - WiFi Scanning                                            │
│  - Heartbeat Sending                                        │
│  - Network Monitoring                                       │
└────────────────────────┬────────────────────────────────────┘
                         │ WiFi + HTTP
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    BACKEND (Flask)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API ENDPOINTS (routes/api.py)                       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  WiFi Management                                     │   │
│  │  • POST /wifi/config - Set WiFi SSID/password        │   │
│  │  • GET /wifi/config - Get WiFi config               │   │
│  │                                                      │   │
│  │  Exam Control                                        │   │
│  │  • POST /exam/start - Start exam                    │   │
│  │  • POST /exam/stop - Stop exam                      │   │
│  │                                                      │   │
│  │  Student Operations                                 │   │
│  │  • POST /student/login - Login student              │   │
│  │  • DELETE /student/<id> - Delete student            │   │
│  │  • POST /students/delete-all - Delete all           │   │
│  │                                                      │   │
│  │  Monitoring                                          │   │
│  │  • POST /heartbeat - Receive heartbeat              │   │
│  │  • POST /scan - Receive WiFi scans                  │   │
│  │  • GET /status - Get student status                 │   │
│  │  • GET /violations - Get violation logs             │   │
│  │                                                      │   │
│  │  Reports & Reset                                    │   │
│  │  • GET /exam/report - Generate report               │   │
│  │  • POST /system/reset - Reset system                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DATABASE (SQLite)                                   │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Tables:                                             │   │
│  │  • students - Student data & risk scores             │   │
│  │  • sessions - Active/inactive student sessions       │   │
│  │  • violations - Violation log entries                │   │
│  │  • heartbeats - Connection heartbeats               │   │
│  │  • scan_logs - WiFi network scans                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  EXAM STATE (In-Memory)                              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  • is_active - Exam running?                         │   │
│  │  • started_at - Exam start time                      │   │
│  │  • stopped_at - Exam stop time                       │   │
│  │  • primary_ssid - Exam WiFi name                     │   │
│  │  • primary_password - Exam WiFi password             │   │
│  │  • esp32_connected_ssid - Current ESP32 WiFi         │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP REST
                         │
┌────────────────────────▼────────────────────────────────────┐
│            ADMIN DASHBOARD (React.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  COMPONENTS (frontend/admin/src/)                    │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  App Component (Main)                                │   │
│  │  ├─ WifiConfigSection                               │   │
│  │  │  └── State: ssid, password, loading               │   │
│  │  ├─ SystemStatusPanel                               │   │
│  │  │  └── Displays: active, disconnected, violated    │   │
│  │  ├─ Student Management Section                       │   │
│  │  │  └── Table with delete buttons                    │   │
│  │  ├─ Violation Logs Section                           │   │
│  │  │  └── Filters: by student, by type                │   │
│  │  ├─ Violation Chart                                  │   │
│  │  │  └── Bar chart of violation counts                │   │
│  │  ├─ Nearby Hotspots Section                          │   │
│  │  │  └── List of detected WiFi networks               │   │
│  │  └─ Report Panel (Conditional)                       │   │
│  │     └── Shows after exam stops                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  STYLING (frontend/admin/src/styles.css)             │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  • Grid layouts (2-column, main)                     │   │
│  │  • Color-coded status cards                          │   │
│  │  • Form styling (inputs, selects)                    │   │
│  │  • Table styling                                      │   │
│  │  • Badge styling                                      │   │
│  │  • Mobile responsive (768px breakpoint)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API CLIENT (frontend/admin/src/api.js)              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Functions:                                          │   │
│  │  • setWifiConfig() - Save WiFi settings              │   │
│  │  • getWifiConfig() - Load WiFi settings              │   │
│  │  • deleteStudent() - Delete individual               │   │
│  │  • deleteAllStudents() - Delete all                  │   │
│  │  • getExamReport() - Get report                      │   │
│  │  • resetSystem() - Reset for new exam                │   │
│  │  • (+ existing: examStart, examStop, etc.)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### WiFi Configuration Flow

```
Admin Dashboard
      │
      ├─► Enter SSID & Password
      │
      └─► Click "Save WiFi Config"
            │
            ▼
        API Request
     POST /wifi/config
     {ssid, password}
            │
            ▼
        Backend
     exam_state updated
     Response: success
            │
            ▼
        Frontend
     Show "Saved successfully"
     Update display
            │
            ▼
        Next request to /status
     Returns updated SSID
            │
            ▼
        Dashboard Header
     "Primary Exam WiFi: [SSID]"
```

### Exam Start/Stop Flow

```
START EXAM                          STOP EXAM
    │                                   │
    ▼                                   ▼
POST /exam/start              POST /exam/stop
    │                              │
    ├─ Set is_active=true          ├─ Set is_active=false
    ├─ Reset all violations        ├─ Mark sessions inactive
    ├─ Clear risk scores           ├─ Set stop timestamp
    └─ Set start timestamp         └─ Prepare for report
    │                              │
    ▼                              ▼
Students can login            GET /exam/report
ESP32 can scan               │
Violations tracked           ├─ Aggregate student data
                            ├─ Calculate violations
                            ├─ Compile metrics
                            └─ Return JSON
                            │
                            ▼
                        Report displayed
                        Download options
                        System reset option
```

### Violation Detection Flow

```
Student Device (ESP32)
    │
    ├─ Scan WiFi networks → POST /scan
    │  └─ If unauthorized SSID + strong signal
    │     └─ HOTSPOT violation (+30 risk)
    │
    ├─ Send heartbeat → POST /heartbeat
    │  └─ If different SSID
    │     └─ NETWORK_SWITCH violation (+40 risk)
    │
    └─ No heartbeat for 10+ seconds
       └─ Backend detects → DISCONNECTED violation (+20 risk)

All violations:
    │
    ├─ Logged to database
    ├─ Risk points accumulated
    ├─ Passed to admin dashboard
    └─ Displayed in real-time logs
       with filters & highlighting
```

### Student Management Flow

```
View Students
    │
    ├─ GET /status
    │  └─ All students loaded
    │
    ├─ Search/Filter (Client-side)
    │  └─ useMemo optimization
    │
    ├─ Display Student Table
    │  ├─ Delete button per row
    │  └─ Delete All button
    │
    └─ On Delete Click
       │
       ├─ Show confirmation dialog
       │
       └─ DELETE /student/<id>
          or POST /students/delete-all
          │
          ├─ Delete from database
          ├─ Cascade delete:
          │  ├─ Sessions
          │  ├─ Violations
          │  ├─ Heartbeats
          │  └─ Scan logs
          │
          └─ GET /status (refresh)
             └─ Update table (student gone)
```

### Report Generation Flow

```
Admin clicks "Stop Exam"
    │
    ▼
POST /exam/stop
    │
    ▼
GET /exam/report
    │
    │ Backend processing:
    │ ├─ Query all students (sorted by risk)
    │ ├─ For each student:
    │ │  ├─ Get all violations
    │ │  ├─ Count violations
    │ │  ├─ Breakdown by type
    │ │  └─ Calculate risk delta sum
    │ ├─ Generate summary
    │ │  ├─ Total students
    │ │  ├─ Total violations
    │ │  ├─ Total risk points
    │ │  └─ Average risk
    │ └─ Return JSON
    │
    ▼
Frontend receives report
    │
    ├─ Display Report Panel
    │  ├─ Summary metrics
    │  ├─ Violation breakdown
    │  └─ Student scores
    │
    ├─ Download Options
    │  ├─ JSON format
    │  │  └─ Full report data
    │  └─ CSV format
    │     └─ Tabular student data
    │
    └─ System Reset Button
       └─ POST /system/reset
          └─ Clear all data
```

### Real-Time Polling Flow

```
Component Mount
    │
    └─► Initial refresh()
         │
         └─► GET /status + GET /violations
             │
             ▼
         Display data
         
    And Start interval:
    Every 5 seconds
         │
         ├─► GET /status
         │   └─ Student list
         │   └─ Hotspots
         │   └─ Exam status
         │
         ├─► GET /violations
         │   └─ Violation logs
         │
         └─► Update React state
             └─ Re-render with new data
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                     STUDENTS TABLE                          │
├─────────────────────────────────────────────────────────────┤
│ id (PK)          INTEGER PRIMARY KEY                        │
│ name             VARCHAR(120)                               │
│ roll             VARCHAR(50) UNIQUE INDEX                   │
│ status           VARCHAR(30) [Active|Disconnected|Violated] │
│ risk_score       INTEGER (cumulative)                       │
│ current_ssid     VARCHAR(120)                               │
│ created_at       DATETIME                                   │
│ updated_at       DATETIME                                   │
└─────────────────────────────────────────────────────────────┘
           │
           ├─────────────────┬──────────────────┐
           │                 │                  │
           ▼                 ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  SESSIONS    │  │ VIOLATIONS   │  │  SCAN LOGS   │
    ├──────────────┤  ├──────────────┤  ├──────────────┤
    │ id (PK)      │  │ id (PK)      │  │ id (PK)      │
    │ token        │  │ student_id   │  │ student_id   │
    │ student_id   │  │ type         │  │ ssid         │
    │ active       │  │ details      │  │ rssi         │
    │ created_at   │  │ risk_delta   │  │ created_at   │
    │ ended_at     │  │ created_at   │  └──────────────┘
    └──────────────┘  └──────────────┘
           │                            
           └────────┬────────────────────┐
                    │                    │
                    ▼                    ▼
            ┌──────────────┐      ┌──────────────┐
            │  HEARTBEATS  │      │ VIOLATIONS   │
            ├──────────────┤      │ (continued)  │
            │ id (PK)      │      ├──────────────┤
            │ session_id   │      │ student_id   │
            │ ssid         │      │ (FK)         │
            │ created_at   │      │ type INDEX   │
            └──────────────┘      │ created_at   │
                                  │ INDEX        │
                                  └──────────────┘
```

Indexes for Performance:
- `student.roll` - UNIQUE (lookup by roll number)
- `session.token` - UNIQUE (session validation)
- `violation.student_id` - INDEX (filtering)
- `violation.created_at DESC` - INDEX (sorting)
- `heartbeat.created_at DESC` - INDEX (last activity)

---

## State Management

### Exam State (Backend - In-Memory)
```javascript
exam_state = {
    is_active: Boolean,              // Exam running?
    started_at: DateTime|None,       // When exam started
    stopped_at: DateTime|None,       // When exam stopped
    esp32_connected_ssid: String,    // Current ESP32 WiFi
    primary_ssid: String,            // Configured WiFi SSID
    primary_password: String,        // Configured WiFi password
}
```

### Component State (Frontend - React)
```javascript
// Exam & Display
[examActive, setExamActive]
[allowedSsid, setAllowedSsid]
[lastSync, setLastSync]

// Data
[students, setStudents]
[violations, setViolations]
[nearbyHotspots, setNearbyHotspots]

// UI State
[loading, setLoading]
[error, setError]
[searchTerm, setSearchTerm]
[sortBy, setSortBy]
[violationFilterStudent, setViolationFilterStudent]
[violationFilterType, setViolationFilterType]

// Report
[showReport, setShowReport]
[report, setReport]

// WiFi Config (Local)
[ssid, setSsid]
[password, setPassword]
```

---

## Error Handling Flow

```
API Request
    │
    ▼
Response received
    │
    ├─ Success (200-299)
    │  └─ Parse JSON
    │     └─ Update state
    │     └─ Clear error
    │
    └─ Error (400+)
       └─ Extract error.message
       └─ Set error state
       └─ Display error banner
       └─ Auto-dismiss after 3sec
```

---

## Access Control

```
                    EXAM INACTIVE
                          │
    ┌─────────────────────┼──────────────────────┐
    │                     │                      │
    ▼                     ▼                      ▼
POST /student/login   POST /scan           ALLOWED
    │                     │
    ├─ Check exam_active  ├─ Check exam_active
    │  is_active: False   │  is_active: False
    │     │                  │
    │     └─► Error 403      └─► Error 403
    │        "Exam not       "Exam not
    │         active"         active"
    │
    └─► Skip this request

                    EXAM ACTIVE
                          │
    ┌─────────────────────┼──────────────────────┐
    │                     │                      │
    ▼                     ▼                      ▼
POST /student/login   POST /scan           ALLOWED
    │                     │
    ├─ Check exam_active  ├─ Check exam_active
    │  is_active: True    │  is_active: True
    │     │                  │
    │     └─► Proceed        └─► Proceed
    │        ├─ Create       ├─ Store scans
    │        │  session      ├─ Detect hotspots
    │        └─ Return       └─ Log violations
    │           token
```

---

## Scaling Considerations

```
CURRENT (Working)
├─ Up to 500 students
├─ SQLite database (local file)
├─ Real-time polling (5 sec)
└─ Single admin dashboard

RECOMMENDED FOR SCALING
├─ PostgreSQL database
├─ WebSocket instead of polling
├─ Multiple admin panels (horizontal scaling)
├─ Caching layer (Redis)
├─ Database read replicas
└─ Metrics collection (Prometheus)
```

---

## Security Flow

```
Admin Login                Student Session
    │                             │
    └─────────────────────MISSING──────────
                                  │
Admin Panel                      ▼
    │                        Student Device
    ├─ No auth check    ├─ WiFi SSID check
    │ (UNSAFE)          ├─ Heartbeat check
    │ (NEEDS FIXING)    ├─ Network switch check
    └─                  └─ Hotspot detection
```

---

## Next Steps for Enhancement

1. **Add Admin Authentication**
   - Login page with credentials
   - JWT token validation
   - Session management

2. **Use WebSocket for Real-Time Updates**
   - Replace 5-second polling
   - Instant notifications
   - Reduce server load

3. **Add Data Encryption**
   - WiFi password hashing
   - Encrypted communications
   - HTTPS requirement

4. **Database Migration to PostgreSQL**
   - Support more concurrent users
   - Better transaction handling
   - Backup/recovery options

5. **Add Audit Logging**
   - Track all admin actions
   - Log violations in detail
   - Compliance reporting

---

**Architecture Document Complete** ✅
