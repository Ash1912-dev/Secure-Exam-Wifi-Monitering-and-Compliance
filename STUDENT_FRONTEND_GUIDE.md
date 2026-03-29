# Student Frontend Upgrade - SEWCMS

## Overview

The Student React Frontend has been upgraded with a **controlled exam flow** featuring multi-stage navigation, network validation, and real-time monitoring.

---

## Flow Stages

### Stage 1: WiFi Connection Page
**Purpose:** Ensure student is connected to correct exam network before login

**Display:**
- Network SSID (from backend)
- Network Password (masked with dots)
- Step-by-step instructions
- Warning message about network switching

**User Action:**
- Student connects device WiFi to exam network
- Clicks "I have connected to Exam WiFi" button

**Validation:**
- Backend checks exam_active status
- Only allows progression if exam is running

**Error Handling:**
- Shows "Exam Not Active" if exam hasn't started
- Displays error banners for connection issues

---

### Stage 2: Login Page
**Purpose:** Student provides credentials to start exam session

**Display:**
- Full Name input field
- Roll Number input field
- Disclaimer: "Ensure connected to exam WiFi"

**User Action:**
- Enters name and roll number
- Clicks "Start Exam Session" button

**Validation:**
- Form requires both fields
- Backend validates student doesn't already have active session
- Returns token on success

**Error Handling:**
- Shows error message if login fails
- Prevents submission if fields empty
- Handles duplicate login attempts

**Response:**
- Token stored in localStorage
- Session data cached locally
- Moves to Exam Session stage

---

### Stage 3: Exam Session Page
**Purpose:** Monitor exam progress and connection status

**Display:**
- Student name and roll number
- Elapsed time timer (in HH:MM:SS format)
- Connection status badge (Connected/Disconnected/Violation)
- Risk score display
- Last sync time
- Network warnings
- Important reminders list
- End Exam Session button

**Real-Time Updates:**
- Heartbeat sent every 5 seconds
- Status updated from server response
- Risk score synced in real-time
- Last sync timestamp updated

**Warnings:**
- Green info banner: "Connected to exam network"
- Yellow warning banner: "Connection Lost" (if Disconnected)
- Red warning banner: "Violation Detected" (if Violated)

**Error Handling:**
- Shows error messages during sync failures
- Displays loading state while syncing
- Handles network timeouts gracefully

**Logout:**
- Confirmation dialog before ending session
- Clears localStorage session
- Resets all state
- Returns to WiFi Connection stage

---

## Component Architecture

### App.jsx Structure

```javascript
FLOW_STAGES = {
  WIFI_CONNECTION: "wifi-connection",
  LOGIN: "login",
  EXAM_SESSION: "exam-session"
}

WifiConnectionStage (Component)
  - Displays WiFi SSID & password
  - Handles continue flow

LoginStage (Component)
  - Form for name & roll
  - Handles login submission

ExamSessionStage (Component)
  - Displays status & monitoring
  - Handles heartbeat & logout

App Component
  - State Management
  - Flow Control
  - API Integration
```

---

## State Management

### Flow Control
- `currentFlow`: Which stage is displayed
- Controls which component renders

### Session Data
- `session`: Contains token, name, roll, and SSID
- Persisted to localStorage
- Cleared on logout

### Exam Status
- `examActive`: Is exam running?
- `status`: Current connection status
- `riskScore`: Cumulative risk points
- `sessionTime`: Elapsed time in exam

### UI State
- `error`: Error message to display
- `loading`: Request in progress
- `lastSync`: Last heartbeat timestamp
- `wifiConfig`: WiFi SSID and password

---

## API Integration

### New API Methods (in api.js)

```javascript
// Get WiFi configuration
getWifiConfig()
  → Returns: { primary_ssid, primary_password }

// Get exam status
getExamStatus()
  → Returns: { exam_active, allowed_ssid, students, ... }

// Existing methods (unchanged)
studentLogin(payload)
sendHeartbeat(payload)
fetchStatus()
```

---

## User Flow Diagram

```
START
  ↓
Check Exam Active?
  ├─ NO → Show "Exam Not Active"
  └─ YES ↓
    Load WiFi Config
      ↓
    Display WiFi Connection Page
      ↓
    User clicks "I have connected"
      ↓
    Verify Exam Active
      ├─ NO → Show error
      └─ YES ↓
        Show Login Page
          ↓
        User enters Name & Roll
          ↓
        Submit Login
          ├─ ERROR → Show error message
          └─ SUCCESS ↓
            Store session in localStorage
              ↓
            Show Exam Session Page
              ↓
            Send Heartbeat every 5 seconds
              ↓
            Update Status & Risk Score
              ↓
            [Loop until logout]
              ↓
            User clicks "End Exam Session"
              ↓
            Confirm action
              ├─ NO → Continue exam
              └─ YES ↓
                Clear localStorage
                  ↓
                Return to WiFi Connection Page
```

---

## Key Features

### 1. Controlled Flow
- ✅ Exam must be active to proceed
- ✅ Cannot skip WiFi connection stage
- ✅ Linear, enforced progression
- ✅ Cannot login if exam not running

### 2. Network Validation
- ✅ Displays correct SSID & password
- ✅ Instructions for connecting
- ✅ Verification before login
- ✅ Continuous monitoring during exam

### 3. Session Persistence
- ✅ Token stored in localStorage
- ✅ Can refresh page and maintain session
- ✅ Session recovered on page reload
- ✅ Proper cleanup on logout

### 4. Real-Time Monitoring
- ✅ Heartbeat every 5 seconds
- ✅ Status updates in real-time
- ✅ Risk score synchronized
- ✅ Connection state tracked

### 5. Error Handling
- ✅ User-friendly error messages
- ✅ Loading states during requests
- ✅ Handles network timeouts
- ✅ Graceful fallbacks

### 6. Mobile Responsive
- ✅ Works on all screen sizes
- ✅ Touch-friendly buttons
- ✅ Readable on mobile
- ✅ Form inputs work on mobile

---

## UI Components

### WiFi Connection Page
```
┌─────────────────────────────────────┐
│  Connect to Exam WiFi               │
│                                     │
│  Network SSID:    [EXAM_WIFI]       │
│  Password:        [●●●●●●●●]       │
│                                     │
│  Steps:                             │
│  1. Go to WiFi settings             │
│  2. Select "EXAM_WIFI"              │
│  3. Enter password                  │
│  4. Connect                         │
│  5. Click button below              │
│                                     │
│  [I have connected...]              │
│                                     │
│  ⚠️ Do not switch networks          │
└─────────────────────────────────────┘
```

### Login Page
```
┌─────────────────────────────────────┐
│  Enter Your Details                 │
│  Please provide your information    │
│                                     │
│  Full Name                          │
│  [Enter your full name............] │
│                                     │
│  Roll Number                        │
│  [Enter your roll number...........]│
│                                     │
│  [Start Exam Session]               │
│                                     │
│  ✓ Ensure connected to exam WiFi   │
└─────────────────────────────────────┘
```

### Exam Session Page
```
┌─────────────────────────────────────┐
│  Exam in Progress          00:15:30 │
│  Student: John Doe (001)            │
│                                     │
│  Connection Status:   ●  Connected  │
│  Risk Score:         0              │
│  Last Sync:       12:30:45          │
│                                     │
│  ✓ Connected to exam network        │
│    Do not switch networks           │
│                                     │
│  Important Reminders:               │
│  • Stay connected to "EXAM_WIFI"    │
│  • Do not switch networks           │
│  • Do not use hotspots or VPN       │
│  • System checks every 5 seconds    │
│  • Each violation increases risk    │
│                                     │
│  [End Exam Session]                 │
└─────────────────────────────────────┘
```

---

## Error States

### Exam Not Active
```
┌─────────────────────────────────────┐
│ Exam Not Active                     │
│                                     │
│ The exam has not started yet.       │
│ Please wait for the administrator   │
│ to start the exam.                  │
│                                     │
│ Refresh this page or check back.    │
└─────────────────────────────────────┘
```

### Connection Lost
```
⚠️ Connection Lost - Please reconnect
   to the exam WiFi immediately
```

### Violation Detected
```
⚠️ Violation Detected - You may have
   switched networks. Reconnect immediately.
```

---

## localStorage Schema

### Session Key
```
Key: "sewcms_student_session"

Value: {
  token: "uuid-string",
  name: "Student Name",
  roll: "Roll Number",
  status: "Active",
  risk_score: 0,
  current_ssid: "EXAM_WIFI",
  allowed_ssid: "EXAM_WIFI"
}
```

---

## Styling

### Color Scheme
- **Primary Blue**: #194d8a (buttons, active states)
- **Success Green**: #0d7c3f (connected status)
- **Warning Yellow**: #936100 (disconnected status)
- **Danger Red**: #9a1a1a (violation status)
- **Background Blue**: #f0f5ff (info sections)

### Responsive Breakpoints
- **Mobile**: 0-640px (single column, larger touch targets)
- **Desktop**: 640px+ (full layout)

---

## Session Lifecycle

### Session Creation
1. User logs in with name & roll
2. Backend returns token
3. Token stored in localStorage
4. Session state updated
5. Exam Session page displayed

### Session Maintenance
- Heartbeat sent every 5 seconds
- Status updated from server
- Risk score synced
- Session kept alive as long as active

### Session Termination
1. User clicks "End Exam Session"
2. Confirmation dialog appears
3. User confirms
4. localStorage cleared
5. State reset
6. Return to WiFi Connection stage

---

## Validation Rules

### Login Form
- ✅ Name required, min 1 character
- ✅ Roll required, min 1 character
- ✅ Submit button disabled if empty
- ✅ Backend validates no duplicate active login

### WiFi Connection
- ✅ Exam must be active
- ✅ User must confirm connection
- ✅ Error shown if exam stopped during flow

### Exam Session
- ✅ Token must be valid
- ✅ Heartbeat must succeed
- ✅ Student must exist in system
- ✅ Status updated in real-time

---

## Performance Considerations

- **Heartbeat**: 5-second interval (configurable)
- **Re-renders**: Optimized with React hooks
- **localStorage**: Minimal data stored
- **API Calls**: Batched where possible
- **Timer**: Uses setInterval for accuracy

---

## Browser Compatibility

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS, Android)

---

## Testing Recommendations

1. **WiFi Connection Page**
   - Verify SSID and password display correctly
   - Test "exam not active" error
   - Test continue button flow

2. **Login Page**
   - Test form validation (empty fields)
   - Test successful login
   - Test duplicate login rejection
   - Test error display

3. **Exam Session Page**
   - Verify timer counts up properly
   - Test heartbeat updates (every 5 sec)
   - Test status badge colors
   - Test warning banners
   - Test logout flow

4. **Mobile Testing**
   - Verify responsive layout
   - Test on small screens
   - Test touch interactions
   - Test input fields on mobile keyboards

5. **Session Persistence**
   - Refresh page during exam
   - Verify session recovered
   - Test logout clears session
   - Test localStorage data

---

## Security Notes

### Current Implementation
- ✅ Token-based authentication
- ✅ Session stored locally
- ⚠️ No encryption (local network assumed)
- ⚠️ No HTTPS validation

### Recommendations
- Use HTTPS in production
- Add token expiration
- Implement token refresh
- Add CSRF protection
- Validate tokens server-side

---

## Future Enhancements

1. Session timeout warning
2. Automatic session refresh
3. Offline mode support
4. PIN-based re-authentication
5. Biometric authentication
6. Screen lock detection
7. Tab visibility monitoring
8. Audio/visual warnings for violations

---

## Integration Checklist

- ✅ WiFi configuration endpoint
- ✅ Exam status endpoint
- ✅ Student login endpoint (with exam check)
- ✅ Heartbeat endpoint
- ✅ Status fetch endpoint
- ✅ Error handling
- ✅ Loading states
- ✅ Flow validation

---

**Implementation Complete** ✅

All student frontend features have been upgraded with controlled exam flow and proper validation.
