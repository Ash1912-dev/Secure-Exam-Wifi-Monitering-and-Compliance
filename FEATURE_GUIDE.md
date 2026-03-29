# SEWCMS Admin Dashboard - Feature Guide

## Overview
The upgraded React Admin Dashboard for Secure Exam Wi-Fi Compliance & Monitoring System (SEWCMS) includes comprehensive real-world features for managing and monitoring secure exams.

---

## 1. PRIMARY WIFI CONFIGURATION

### Location
Top-left panel in the dashboard

### Features
- **SSID Input Field**: Enter the exam WiFi network name
- **Password Input Field**: Enter the WiFi password
- **Save Button**: Persists configuration to backend
- **Current SSID Display**: Shows "Primary Exam WiFi: [SSID]" at the top

### Usage
1. Before starting the exam, enter the SSID and password
2. Click "Save WiFi Config" button
3. These settings can only be changed when exam is NOT running
4. The SSID is displayed in the top navigation for reference

### Backend Integration
- **POST** `/wifi/config` - Save WiFi configuration
- **GET** `/wifi/config` - Retrieve current configuration
- Stored in `exam_state["primary_ssid"]` and `exam_state["primary_password"]`

---

## 2. NEARBY WIFI SCAN VIEW

### Location
Bottom-right panel labeled "Nearby WiFi Networks"

### Features
- **Auto-refresh**: Updates every 5 seconds
- **SSID Display**: Shows network names
- **RSSI (Signal Strength)**: Displays signal strength in dBm
- **Seen Count**: How many times the network was detected

### Color Coding
- Strong signals (above HOTSPOT_RSSI_THRESHOLD) highlighted in blue
- Represents potential threats students might try to connect to

### Data Source
- Collected from ESP32 WiFi scans (only when exam is active)
- Looks back 30 seconds for recent detections
- Automatically filters out the primary exam WiFi

---

## 3. STUDENT MANAGEMENT

### Location
Main center panel titled "Student Management"

### Features

#### Student Table Columns
1. **Name**: Student's full name
2. **Roll No**: Student roll number/ID
3. **Status**: Active, Disconnected, or Violated
4. **Risk Score**: Cumulative risk points
5. **Last Seen**: Timestamp of last activity
6. **Action**: Delete button

#### Controls
- **Search Input**: Filter students by name or roll number (real-time)
- **Sort Dropdown**: Sort by Name, Risk Score, or Status
- **Delete Button**: Remove individual student (with confirmation)
- **Delete All Students Button**: Bulk delete with warning confirmation

#### Search & Sort
```
Example: Search "John" → Shows only students with "John" in name
Example: Sort by "Risk" → Highest risk students listed first
```

#### Color Coding
- **Green rows**: Safe (risk < 20, not violated/disconnected)
- **Yellow rows**: Warning (risk 20-39 or disconnected)
- **Red rows**: High risk (risk ≥ 40 or violated)

### Backend Integration
- **DELETE** `/student/<student_id>` - Remove single student
- **POST** `/students/delete-all` - Remove all students
- Cascading delete removes related sessions, violations, heartbeats

---

## 4. EXAM CONTROL

### Location
Top-right buttons in header

### Features
- **Start Exam Button**
  - Enables student login
  - Enables ESP32 WiFi scanning
  - Clears previous violations
  - Resets all student risk scores
  - Sets exam time
  
- **Stop Exam Button**
  - Disables new student logins
  - Stops ESP32 scanning
  - Marks exam as completed
  - Automatically generates report
  - Shows final report panel

### Access Control
- Students cannot login unless exam is active (403 error)
- ESP32 scans are rejected if exam is not active (403 error)
- Prevents uncontrolled data collection outside exam time

### Backend Integration
- **POST** `/exam/start` - Activate exam
- **POST** `/exam/stop` - Deactivate exam
- `exam_state["is_active"]` tracks current status

---

## 5. VIOLATION LOG IMPROVEMENTS

### Location
Center-right panel titled "Violation Logs"

### Features

#### Log Entries Include
- **Type**: NETWORK_SWITCH, DISCONNECTED, HOTSPOT
- **Timestamp**: When violation occurred
- **Student Name & Roll**: Violating student info
- **Risk Points**: Points added to score
- **Details**: Description of violation

#### Filtering
- **By Student**: Dropdown showing all students with violations
- **By Type**: Filter by violation type (NETWORK_SWITCH, DISCONNECTED, HOTSPOT)
- **Combined Filtering**: Can use both filters together

#### Visual Indicators
- **High-Risk Highlighting**: Entries with risk_delta ≥ 30 have red background
- **Risk Badge**: Shows +N points in red badge
- **Color-Coded Background**: High-risk entries stand out visually

#### Violation Types
1. **NETWORK_SWITCH**: Student connected to unauthorized WiFi
2. **DISCONNECTED**: No heartbeat for >10 seconds
3. **HOTSPOT**: Strong nearby unauthorized network detected

### Backend Integration
- **GET** `/violations` - Fetch all violation logs
- Violations tracked in database with timestamps
- Risk points accumulated per student

---

## 6. LIVE SYSTEM STATUS PANEL

### Location
Top-right panel titled "Live System Status"

### Metrics Displayed

#### Status Cards (4-column grid)
1. **Active Students** (Green card)
   - Count of students currently logged in and active
   - Status: "Active"

2. **Disconnected** (Orange/Yellow card)
   - Students who lost connection
   - Status: "Disconnected"

3. **Violations** (Red card)
   - Students who triggered violations
   - Status: "Violated"

4. **Average Risk Score** (Color-coded)
   - Mean risk score across all students
   - Green if < 20, Yellow if 20-39, Red if ≥ 40

#### Real-time Updates
- Refreshes every 5 seconds
- Shows current exam state
- Helps identify exam health at a glance

### Visual Design
- Large numeric displays for easy reading
- Color-gradient backgrounds
- Clear status indicators
- Responsive layout

---

## 7. FINAL REPORT & SYSTEM RESET

### Location
Panel titled "Exam Summary Report" (appears after exam stops)

### Report Contents

#### Summary Section
- **Total Students**: Number of students in exam
- **Total Violations**: Count of all violations
- **Total Risk Points**: sum of all risk scores
- **Average Risk Score**: mean risk across students
- **Violation Type Breakdown**: Count by type (NETWORK_SWITCH, DISCONNECTED, HOTSPOT)

#### Student Scores Table
- Shows each student's:
  - Name and Roll number
  - Risk Score
  - Total Violations
  - Sorted by risk score (highest first)

#### Download Options
- **Download JSON**: Full report with all violation details
- **Download CSV**: Simplified tabular format for Excel

#### Reset System Button
- Clears ALL data:
  - All students
  - All sessions
  - All violations
  - All logs
  - All heartbeats
- Resets exam state to ready
- Prepares system for next exam

### File Format Examples

#### JSON Format
```json
{
  "exam_duration": {
    "started_at": "2024-03-24T10:00:00",
    "stopped_at": "2024-03-24T11:30:00"
  },
  "summary": {
    "total_students": 150,
    "total_violations": 45,
    "total_risk_points": 2850,
    "violation_type_breakdown": {
      "NETWORK_SWITCH": 25,
      "HOTSPOT": 15,
      "DISCONNECTED": 5
    }
  },
  "students": [...]
}
```

#### CSV Format
```
Name,Roll,Status,Risk Score,Total Violations
John Doe,001,Violated,120,8
Jane Smith,002,Active,45,3
...
```

### Backend Integration
- **GET** `/exam/report` - Generate report
- **POST** `/system/reset` - Clear all data
- Reports include timestamps and comprehensive metrics

---

## 8. UI REQUIREMENTS & DESIGN

### Color Scheme

#### Status Colors
- **Green (#0e7b52)**: Safe, Active, Success
- **Yellow (#fff9ec)**: Warning, Disconnected
- **Red (#9f3030)**: Violation, High-risk, Error
- **Blue (#2d7fbe)**: Info, Secondary actions

#### Risk Score Colors
- **Green**: Risk < 20 (Safe)
- **Yellow**: Risk 20-39 (Warning)
- **Red**: Risk ≥ 40 (High Risk)

### Layout Structure
```
┌─ HEADER (SSID, Start/Stop buttons) ──────────────────┐
├─ STATUS BAR (Exam status, metrics, last sync) ────────┤
├─ WIFI CONFIG + STATUS PANEL ─────────────────────────┤
├─ STUDENT MANAGEMENT + VIOLATION LOGS ────────────────┤
├─ VIOLATION CHART + NEARBY HOTSPOTS ──────────────────┤
└─ REPORT PANEL (after exam stops) ────────────────────┘
```

### Responsive Design
- **Desktop (1024px+)**: Multi-column grids
- **Tablet (768px-1023px)**: 2-column layouts
- **Mobile (<768px)**: Single-column stacked layout

### Visual Elements
- **Cards**: Shadow effects, rounded corners, gradient backgrounds
- **Tables**: Striped rows, hover effects, clear headers
- **Buttons**: Consistent styling, hover states, disabled states
- **Badges**: Color-coded status indicators
- **Charts**: Simple horizontal bar charts for violation counts

---

## 9. REAL-TIME UPDATES

### Polling Strategy
- **Interval**: 5 seconds
- **Endpoints called**:
  - `GET /status` - Student list, hotspots, exam status
  - `GET /violations` - Violation logs

### Data Refresh
- Automatic refresh on component mount
- Periodic refresh every 5 seconds
- Manual refresh button available
- Last sync timestamp displayed

### Performance
- Efficient data fetching combined in Promise.all()
- Minimal re-renders with useMemo optimization
- Cascading delete prevents data orphaning

---

## 10. API ENDPOINTS SUMMARY

### WiFi Management
```
POST /wifi/config - Set SSID & password
GET /wifi/config - Get current WiFi config
```

### Exam Control
```
POST /exam/start - Start exam
POST /exam/stop - Stop exam
```

### Student Operations
```
POST /student/login - Student login (needs exam_active)
DELETE /student/<id> - Delete student
POST /students/delete-all - Delete all students
```

### WiFi Scanning
```
POST /scan - Submit WiFi scan (needs exam_active)
```

### Status & Reports
```
GET /status - Get exam status & students
GET /violations - Get violation logs
GET /exam/report - Generate exam report
POST /system/reset - Clear all data
```

---

## 11. WORKFLOW EXAMPLE

### Typical Exam Session

1. **Setup Phase**
   - Open admin dashboard
   - Enter WiFi SSID and password
   - Click "Save WiFi Config"

2. **Pre-Exam**
   - View "Live System Status" (all zeros)
   - Review configuration
   - Inform students about WiFi

3. **Exam Start**
   - Click "Start Exam" button
   - Students can now login
   - ESP32 can begin scanning

4. **During Exam** (5-second updates)
   - Monitor active students
   - Watch for violations in logs
   - Check nearby WiFi threats
   - Monitor risk scores

5. **Exam Stop**
   - Click "Stop Exam" button
   - Report automatically displays
   - Review student violations
   - Check final risk scores

6. **Post-Exam**
   - Download report (JSON/CSV)
   - Review violations by student
   - Click "Reset System for New Exam"
   - System clears all data

---

## 12. ERROR HANDLING

### Common Errors

#### WiFi Config
```
- "SSID cannot be empty" - Enter SSID before saving
- "WiFi configuration saved successfully!" - Success
```

#### Student Operations
```
- "Are you sure you want to delete [student]?" - Confirmation
- "Failed to delete student" - Database error
```

#### System Reset
```
- "WARNING: This will delete ALL data" - Confirmation prompt
- "System reset for new exam" - Success
```

#### Exam Control
```
- "Exam is not active. Student login not allowed." - 403 error
- "Exam is not active. Scans not allowed." - 403 error
```

### Error Display
- Error messages shown in red banner at page top
- Auto-dismiss after errors resolves
- Confirmation dialogs prevent accidental actions

---

## End of Feature Guide

For technical documentation, see [API Implementation Guide] or check individual component code comments.
