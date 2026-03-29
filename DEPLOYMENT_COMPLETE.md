# SEWCMS Deployment Guide - Complete System

## Overview

This guide covers deploying the complete **Secure Exam Wi-Fi Compliance & Monitoring System (SEWCMS)** with:
- **Backend**: Flask API server
- **Admin Frontend**: Admin dashboard for exam management
- **Student Frontend**: Student exam interface with flow control

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Admin Dashboard                       │
│            (React + Vite @ localhost:5173)              │
│  - Configure WiFi                                       │
│  - View WiFi scans                                      │
│  - Manage students                                      │
│  - Control exam start/stop                              │
│  - View violations & reports                            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTP (RESTful API)
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Backend Flask Server                        │
│           (Python @ localhost:5000)                      │
│  - SQLite Database                                      │
│  - WiFi Config API                                      │
│  - Student Management                                   │
│  - Exam Control                                         │
│  - Heartbeat Monitoring                                 │
│  - Violation Tracking                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTP (RESTful API)
                   │
┌──────────────────▼──────────────────────────────────────┐
│                Student Frontend                         │
│            (React + Vite @ localhost:5174)              │
│  - WiFi Connection Stage                                │
│  - Login Stage                                          │
│  - Exam Session with Monitoring                         │
│  - Real-time Status Updates                             │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements
- **OS**: Windows, Mac, or Linux
- **Node.js**: v16 or higher
- **Python**: v3.10 or higher
- **RAM**: Minimum 2GB
- **Storage**: 500MB free space

### Software Setup
```bash
# Check Node.js
node --version
npm --version

# Check Python
python --version
pip --version
```

---

## Directory Structure

```
Secure Exam Wifi Monitering and Compliance/
├── backend/
│   ├── app.py
│   ├── models.py
│   ├── requirements.txt
│   └── routes/
│       ├── __init__.py
│       └── api.py
├── frontend/
│   ├── admin/
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── App.jsx
│   │       ├── api.js
│   │       ├── main.jsx
│   │       └── styles.css
│   └── student/
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx
│           ├── api.js
│           ├── main.jsx
│           └── styles.css
└── [documentation files]
```

---

## Step 1: Backend Setup

### 1.1 Install Dependencies

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

### 1.2 Initialize Database

```bash
# From backend/ directory with venv activated
python app.py
# Server will start on localhost:5000
```

**First Run:**
- Database will be created automatically
- Initial tables (students, sessions, violations) created
- Server ready to accept requests

### 1.3 Test Backend

```bash
# In a new terminal/PowerShell window
curl http://localhost:5000/status

# Expected response:
# {"status": "ok", "exam_active": false, "students": 0}
```

**Keep backend running** - leave terminal open.

---

## Step 2: Admin Frontend Setup

### 2.1 Install Dependencies

```bash
# In a new terminal/PowerShell window
cd frontend/admin

npm install
# Wait for completion (1-2 minutes)
```

### 2.2 Configure API Base URL

**File**: `frontend/admin/src/api.js`

Verify that API base URL points to backend:
```javascript
const API_BASE = 'http://localhost:5000';
```

**For production**, change to your server URL:
```javascript
const API_BASE = 'https://your-domain.com/api';
```

### 2.3 Start Development Server

```bash
# From frontend/admin directory
npm run dev

# Output will show:
# Local:        http://localhost:5173/
# Press q to stop
```

**Keep admin frontend running** - leave terminal open.

### 2.4 Test Admin Frontend

Open browser: **http://localhost:5173**

Check:
- ✅ Admin dashboard loads
- ✅ WiFi configuration section visible
- ✅ Student management section visible
- ✅ Exam control buttons visible
- ✅ No console errors (press F12)

---

## Step 3: Student Frontend Setup

### 3.1 Install Dependencies

```bash
# In a new terminal/PowerShell window
cd frontend/student

npm install
# Wait for completion (1-2 minutes)
```

### 3.2 Configure API Base URL

**File**: `frontend/student/src/api.js`

Verify that API base URL points to backend:
```javascript
const API_BASE = 'http://localhost:5000';
```

### 3.3 Start Development Server

```bash
# From frontend/student directory
npm run dev

# Output will show:
# Local:        http://localhost:5174/
# Press q to stop
```

**Keep student frontend running** - leave terminal open.

### 3.4 Test Student Frontend

Open browser: **http://localhost:5174**

Check:
- ✅ WiFi connection page displays
- ✅ SSID and password visible
- ✅ Instructions show
- ✅ No console errors (press F12)

**Note:** May see "Exam Not Active" - this is correct if exam not started in admin.

---

## Step 4: Complete Workflow Testing

### 4.1 Terminal Setup

You should now have **3 open terminals**:

```
Terminal 1 (KEEP RUNNING):
└─ backend/        python app.py
   @ localhost:5000

Terminal 2 (KEEP RUNNING):
└─ frontend/admin/  npm run dev
   @ localhost:5173

Terminal 3 (KEEP RUNNING):
└─ frontend/student/ npm run dev
   @ localhost:5174
```

### 4.2 Workflow Test

**1. Start the Exam (Admin Dashboard)**

Open **http://localhost:5173**

- Navigate to "Exam Control" section
- Set Primary WiFi:
  - SSID: `EXAM_WIFI`
  - Password: `testwifi123`
  - Click "Save WiFi Config"
- Click "Start Exam" button
- Verify: Status shows "Exam Active"

**2. Configure WiFi (Student Device)**

Open **http://localhost:5174**

- Page shows WiFi Connection stage
- Displays SSID: `EXAM_WIFI`
- Shows password: `testwifi123`
- Follow on-screen instructions
- Click "I have connected to Exam WiFi"

**3. Login to Exam (Student)**

After WiFi connection:
- Shows Login page
- Enter Name: `Test Student`
- Enter Roll: `001`
- Click "Start Exam Session"
- Page transitions to Exam Session page

**4. Monitor Exam (Admin Dashboard)**

Switch to **http://localhost:5173**

- Student appears in "Active Students" list
- Status shows "Connected"
- Risk score: 0
- Can view live updates

**5. End Exam (Admin)**

- Click "Stop Exam" button
- Confirms all students logged out
- Admin shows exam report

### 4.3 Test Response to Connection Loss

While exam active:

**On Student Device:**
- Disconnect WiFi (or close browser)
- Admin dashboard shows status change to: "Disconnected"
- Risk score increases
- Reconnect to resume

---

## Step 5: Production Deployment

### 5.1 Build Frontend Applications

```bash
# Admin Frontend
cd frontend/admin
npm run build
# Creates: dist/ folder with optimized files

# Student Frontend
cd frontend/student
npm run build
# Creates: dist/ folder with optimized files
```

### 5.2 Deploy Backend

**Option A: Direct Server Deployment**

```bash
# On production server
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Start with production settings
python app.py --port 5000
```

**Option B: Using Gunicorn**

```bash
# Install production server
pip install gunicorn

# Run with multiple workers
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 5.3 Deploy Frontend

**Option A: Nginx**

```nginx
# /etc/nginx/sites-available/sewcms

server {
    listen 80;
    server_name admin.exams.local;
    
    root /var/www/admin-dist;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
    }
}

server {
    listen 80;
    server_name student.exams.local;
    
    root /var/www/student-dist;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

**Option B: Apache**

```apache
# admin.conf
<VirtualHost *:80>
    ServerName admin.exams.local
    DocumentRoot /var/www/admin-dist
    
    <Directory /var/www/admin-dist>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    ProxyPass /api http://localhost:5000
    ProxyPassReverse /api http://localhost:5000
</VirtualHost>
```

### 5.4 Environment Configuration

**For Production, Update API URLs:**

**Admin Frontend `frontend/admin/src/api.js`:**
```javascript
const API_BASE = process.env.VITE_API_BASE || 'https://api.exams.local';
```

**Student Frontend `frontend/student/src/api.js`:**
```javascript
const API_BASE = process.env.VITE_API_BASE || 'https://api.exams.local';
```

### 5.5 Backend Configuration

**In `backend/app.py`, update Flask settings:**

```python
if __name__ == '__main__':
    # Production settings
    app.run(
        host='0.0.0.0',          # Listen on all interfaces
        port=5000,
        debug=False,              # Disable debug mode
        threaded=True             # Enable threading
    )
```

---

## Troubleshooting

### Issue: Backend fails to start

**Symptom**: `ModuleNotFoundError: No module named 'flask'`

**Solution**:
```bash
# Ensure virtual environment activated
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: Frontend shows blank page

**Symptom**: Admin/Student frontend loads but shows nothing

**Solution**:
1. Check browser console (F12) for errors
2. Verify backend is running on localhost:5000
3. Check API_BASE URL in api.js
4. Clear browser cache: Ctrl+Shift+Delete
5. Restart dev server: `npm run dev`

### Issue: CORS errors

**Symptom**: Console shows "Access to XMLHttpRequest blocked by CORS"

**Solution**:
1. Ensure backend is running
2. Verify API_BASE matches backend URL
3. Add CORS headers in backend (if needed):

```python
# In backend/app.py
from flask_cors import CORS
CORS(app)
```

### Issue: API calls timeout

**Symptom**: "Network request timeout" errors

**Solution**:
1. Check backend terminal - is server running?
2. Verify no firewall blocking port 5000
3. Increase timeout in api.js:

```javascript
const timeout = 15000; // 15 seconds
```

### Issue: Data not persisting

**Symptom**: Students/WiFi config disappears on restart

**Solution**:
1. Verify database file exists: `backend/exam.db`
2. Check file permissions
3. Backup and delete corrupted db:
```bash
# Backend will recreate on next run
rm backend/exam.db
python app.py
```

---

## Port Configuration

**Default Ports:**
- Backend: `5000`
- Admin Frontend: `5173`
- Student Frontend: `5174`

**To change ports:**

**Backend** (`backend/app.py`):
```python
app.run(port=8000)  # Change to 8000
```

**Admin Frontend** (`frontend/admin/vite.config.js`):
```javascript
export default {
  server: {
    port: 3000  // Change to 3000
  }
}
```

**Student Frontend** (`frontend/student/vite.config.js`):
```javascript
export default {
  server: {
    port: 3001  // Change to 3001
  }
}
```

---

## Production Checklist

- [ ] Backend database backed up
- [ ] API URLs configured for production domain
- [ ] HTTPS enabled (use Let's Encrypt)
- [ ] Firewall configured to allow ports
- [ ] Database access restricted (not world-accessible)
- [ ] Log files configured
- [ ] Error monitoring enabled
- [ ] Regular backups scheduled
- [ ] Admin password set (if added in future)
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Load testing completed
- [ ] Performance optimized

---

## Monitoring

### Backend Health Check

```bash
# Check if backend is running
curl http://localhost:5000/status

# Expected output:
# {"status": "ok", "exam_active": false, "students": 0}
```

### Frontend Health Check

Admin: **http://localhost:5173** - Should load dashboard
Student: **http://localhost:5174** - Should load WiFi connection page

### Database Backup

```bash
# Backup SQLite database
cp backend/exam.db backend/exam.db.backup

# Restore from backup
cp backend/exam.db.backup backend/exam.db
```

---

## Performance Tuning

### Backend Optimization

```python
# Enable caching
from flask_caching import Cache
cache = Cache(app, config={'CACHE_TYPE': 'simple'})

# Use connection pooling
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_recycle': 3600,
}
```

### Frontend Optimization

```javascript
// Enable lazy loading
const Admin = lazy(() => import('./pages/Admin'));
const Student = lazy(() => import('./pages/Student'));

// Implement virtualization for large lists
<Virtualized list={students} />
```

---

## Security Recommendations

1. **HTTPS Only**: Use SSL certificates in production
2. **CORS**: Restrict to known domains
3. **Rate Limiting**: Prevent brute force attacks
4. **Input Validation**: Sanitize all user inputs
5. **SQL Injection**: Use parameterized queries (already in place)
6. **Authentication**: Add admin login (future enhancement)
7. **Session Expiry**: Implement timeout
8. **Logging**: Log all access attempts
9. **Firewall**: Restrict database access
10. **Updates**: Keep dependencies patched

---

## Documentation Files

- `FEATURE_GUIDE.md` - Admin dashboard features
- `STUDENT_FRONTEND_GUIDE.md` - Student interface features
- `ARCHITECTURE.md` - System design details
- `DEPLOYMENT.md` - This file
- `IMPLEMENTATION_CHECKLIST.md` - Verification steps

---

## Support & Issues

For issues or questions:

1. **Check logs**: Review terminal output for error messages
2. **Review guides**: Refer to feature guides for capabilities
3. **Verify connectivity**: Ensure all 3 components running
4. **Test endpoints**: Use curl or Postman to test API
5. **Clear cache**: Try clearing browser cache and localStorage

---

## Quick Start Summary

```bash
# Terminal 1: Start Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python app.py

# Terminal 2: Start Admin Frontend
cd frontend/admin
npm install
npm run dev

# Terminal 3: Start Student Frontend
cd frontend/student
npm install
npm run dev

# Now visit:
# Admin:   http://localhost:5173
# Student: http://localhost:5174
```

---

**Deployment Checklist: COMPLETE** ✅

System is ready for development, testing, or production deployment.
