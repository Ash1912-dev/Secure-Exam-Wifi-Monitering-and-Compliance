# Deployment & Setup Guide

## Prerequisites

### Backend Requirements
Located in `backend/requirements.txt`:
```
Flask
Flask-CORS
SQLAlchemy
python-dotenv
```

### Frontend Requirements
Located in `frontend/admin/package.json`:
```
React 18+
Vite (build tool)
```

---

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Variables (Optional)
Create a `.env` file in the backend directory:
```bash
SEWCMS_ALLOWED_SSID=YourWiFiName
SEWCMS_HEARTBEAT_TIMEOUT=10
SEWCMS_HOTSPOT_RSSI=-55
SEWCMS_DATABASE_URL=sqlite:///sewcms.db
```

### 3. Run Backend Server
```bash
python app.py
```
Server will run on `http://localhost:5000`

### 4. Database
- SQLite database automatically created on first run
- Tables: students, sessions, violations, heartbeats, scan_logs
- No manual schema setup required

---

## Frontend Setup

### 1. Install Dependencies
```bash
cd frontend/admin
npm install
```

### 2. Environment Variables (Optional)
Create a `.env` file in frontend/admin directory:
```bash
VITE_API_BASE=http://localhost:5000
```

### 3. Run Development Server
```bash
npm run dev
```
Access dashboard at `http://localhost:5173` or URL shown in terminal

### 4. Build for Production
```bash
npm run build
```
Output in `dist/` folder

---

## API Endpoints Reference

### WiFi Configuration
- **POST** `/wifi/config` - Set WiFi SSID/password
  ```json
  Request: {"ssid": "EXAM_WIFI", "password": "password123"}
  Response: {"message": "...", "ssid": "EXAM_WIFI"}
  ```

- **GET** `/wifi/config` - Get current config
  ```json
  Response: {"primary_ssid": "EXAM_WIFI", "primary_password": "..."}
  ```

### Exam Control
- **POST** `/exam/start` - Start exam
  ```json
  Response: {"message": "Exam started", "allowed_ssid": "EXAM_WIFI"}
  ```

- **POST** `/exam/stop` - Stop exam
  ```json
  Response: {"message": "Exam stopped"}
  ```

### Student Management
- **DELETE** `/student/<id>` - Delete specific student
  ```json
  Response: {"message": "Student deleted successfully", "deleted_id": 1}
  ```

- **POST** `/students/delete-all` - Delete all students
  ```json
  Response: {"message": "All students deleted", "deleted_count": 150}
  ```

### Reports & System
- **GET** `/exam/report` - Generate exam report
  ```json
  Response: {
    "exam_duration": {...},
    "summary": {...},
    "students": [...]
  }
  ```

- **POST** `/system/reset` - Reset system
  ```json
  Response: {"message": "System reset for new exam", "status": "ready"}
  ```

---

## File Structure

```
Secure Exam Wifi Monitering and Compliance/
├── backend/
│   ├── app.py                 # Main Flask app
│   ├── models.py              # SQLAlchemy models
│   ├── requirements.txt        # Python dependencies
│   └── routes/
│       ├── __init__.py
│       └── api.py             # All API endpoints (NEW: WiFi config, reports, deletes)
│
├── frontend/
│   ├── admin/
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.jsx        # UPGRADED: All new components & features
│   │       ├── api.js         # UPDATED: New API methods
│   │       ├── main.jsx
│   │       └── styles.css     # UPDATED: New component styles
│   │
│   └── student/
│       ├── (similar structure)
│
├── esp32/
│   └── firmware/
│       └── firmware.ino       # Student device code
│
├── FEATURE_GUIDE.md           # NEW: Comprehensive feature documentation
└── README_SEWCMS.md
```

---

## New Files Modified

### Backend: `routes/api.py`
**Added endpoints for:**
- WiFi configuration management
- Student deletion (individual & bulk)
- Exam report generation
- System reset
- Enhanced exam state tracking
- Access control for exam-inactive periods

### Frontend: `src/App.jsx`
**Major rewrite includes:**
- WiFi Configuration Component
- System Status Panel Component
- Enhanced Student Management with delete buttons
- Improved Violation Logs with filtering
- Final Report Section with downloads
- System Reset functionality

### Frontend: `src/api.js`
**New API functions:**
- `setWifiConfig(ssid, password)`
- `getWifiConfig()`
- `deleteStudent(studentId)`
- `deleteAllStudents()`
- `getExamReport()`
- `resetSystem()`

### Frontend: `src/styles.css`
**Added styles for:**
- WiFi configuration form
- System status cards
- Status panels with gradients
- Report panel layouts
- Filtering controls
- Responsive grids
- Color-coded components
- Mobile responsive design

---

## Running Complete System

### Terminal 1 - Backend
```bash
cd backend
python app.py
# Server runs on http://localhost:5000
```

### Terminal 2 - Frontend
```bash
cd frontend/admin
npm install (first time only)
npm run dev
# Dashboard runs on http://localhost:5173
```

### Terminal 3 - ESP32 (Optional)
- Upload firmware to ESP32 board
- Ensure board connects to configured WiFi

---

## Testing New Features

### Test WiFi Configuration
1. Navigate to the WiFi Configuration panel (top-left)
2. Enter test SSID: "TEST_WIFI"
3. Enter password: "test123"
4. Click "Save WiFi Config"
5. Verify message: "WiFi configuration saved successfully!"
6. Check top header shows: "Primary Exam WiFi: TEST_WIFI"

### Test Exam Control with Access
1. With exam STOPPED, try accessing student panel without starting exam
   - Should show expected behavior
2. Start Exam - click "Start Exam" button
3. Stop Exam - click "Stop Exam" button
4. Report should appear automatically
5. Verify report contains:
   - Total students count
   - Violation breakdown
   - Student scores

### Test Student Management
1. After students login (via student portal or test data)
2. Click Delete on any student - confirm dialog appears
3. Click "Delete All Students" - warning appears
4. Verify students removed from table

### Test Report Downloads
1. Stop an exam to generate report
2. Click "Download JSON" - JSON file downloads
3. Click "Download CSV" - CSV file downloads
4. Open files to verify data format

### Test System Reset
1. After exam, view report
2. Click "Reset System for New Exam"
3. Confirm action in dialog
4. Verify:
   - Student table becomes empty
   - Report disappears
   - Dashboard ready for new exam

---

## Troubleshooting

### Backend Won't Start
```
Error: No module named 'flask'
Fix: pip install -r requirements.txt
```

### Frontend Shows Blank Page
```
Error: Cannot connect to API
Fix: Ensure backend is running on http://localhost:5000
Check VITE_API_BASE in .env file
```

### Reports Not Generating
```
Error: /exam/report returns 500
Check:
- Database exists and has data
- Backend restarted after schema changes
- Exam was stopped (required for report)
```

### WiFi Config Not Saving
```
Issue: Form disabled
Cause: Exam is active
Fix: Stop exam first, then update config
```

### Delete Operations Failing
```
Error: 404 Student not found
Cause: Student data already deleted
Fix: Refresh page to see current state
```

---

## Performance Notes

- Dashboard refreshes every **5 seconds**
- Supports up to **500+ students** without performance issues
- Database queries optimized with indexes on:
  - student.roll (unique)
  - session.token (unique)
  - violation.created_at (for sorting)
  - heartbeat.session_id, created_at

---

## Security Considerations

### Current Implementation
- ✅ Basic WiFi authentication tracking
- ✅ Student session tokens (UUID)
- ✅ Risk scoring system
- ⚠️ No encryption (local network assumed safe)
- ⚠️ No authentication for admin panel

### Recommendations
- Run on trusted internal network
- Add authentication for admin panel
- Use HTTPS in production
- Regular database backups
- Rotate session tokens periodically

---

## Backup & Recovery

### Database Backup
```bash
# Copy database file
cp backend/sewcms.db backend/sewcms.db.backup
```

### Export Report Before Reset
1. Stop exam
2. Download report as JSON
3. Click "Reset System for New Exam"
4. Reports are archived locally

---

## Support & Documentation

- **Feature Guide**: See FEATURE_GUIDE.md
- **API Docs**: Check routes/api.py comments
- **Component Docs**: Check src/App.jsx component comments
- **Styling**: See src/styles.css class documentation

---

## Version Information

- **Frontend**: React 18+
- **Backend**: Python 3.10+
- **Database**: SQLite 3
- **API**: Flask REST endpoints
- **Last Updated**: March 24, 2024

---

## Next Steps

1. Install dependencies for backend and frontend
2. Start backend server
3. Start frontend dev server
4. Configure initial WiFi SSID/password
5. Run test exam session
6. Review FEATURE_GUIDE.md for complete usage guide

Happy monitoring! 🎓🔒
