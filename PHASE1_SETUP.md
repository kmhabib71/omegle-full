# 🚀 Phase 1: Video Chat Setup & Testing Guide

## Overview

This guide walks you through setting up and testing Phase 1 of the Omegle-like video chat application. Phase 1 focuses on initial load & setup with comprehensive debugging capabilities.

## 🔧 Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Camera and Microphone** access
4. **Modern browser** (Chrome, Firefox, Safari, Edge)

## 📋 Phase 1 Requirements Checklist

### ✔ Socket Connection Validation

- [x] Verify Socket.IO connection to server
- [x] Test network connectivity
- [x] Initialize WebRTC configuration
- [x] Set connection state to "disconnected"

### ✔ Media Device Preparation

- [x] Check camera/microphone permissions
- [x] Test device availability
- [x] Initialize local stream (but don't start)
- [x] Set media constraints (mobile optimization)

### ✔ UI State Initialization

- [x] Show ONLY "START" button (disabled until socket connects)
- [x] Hide NEXT and STOP buttons
- [x] Clear any previous user video frames
- [x] Reset all connection states

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Make sure your `.env.local` file contains:

```env
# Socket.IO Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Other existing configurations...
```

### 3. Start the Socket.IO Server

```bash
npm run dev:socket
```

You should see:

```
🚀 Socket.IO server ready on http://localhost:3001
📡 WebRTC signaling server is running
```

### 4. Start the Next.js Application (in a new terminal)

```bash
npm run dev
```

### 5. Access the Application

Open your browser and navigate to:

```
http://localhost:3000/video-chat
```

## 🔍 Phase 1 Debug Panel

The application includes a comprehensive debug panel that shows:

### 📡 Connection States

- **Socket**: disconnected → connecting → connected
- **WebRTC**: not_initialized → initialized
- **Media**: not_ready → checking → ready
- **Queue**: not_in_queue (Phase 1 only)

### ✔ Phase 1 Checkpoints

#### 🔌 Socket Connection Validation

- ✔ Socket Connection
- ✔ Network Connectivity
- ✔ WebRTC Initialized
- ✔ Connection State Set

#### 🎥 Media Device Preparation

- ✔ Camera Permission
- ✔ Microphone Permission
- ✔ Device Availability
- ✔ Local Stream Initialized
- ✔ Media Constraints Set

#### 🎛️ UI State Initialization

- ✔ START Button Visible
- ✔ START Button Disabled (until ready)
- ✔ NEXT Button Hidden
- ✔ STOP Button Hidden
- ✔ Video Frames Cleared
- ✔ States Reset

## 🧪 Testing Phase 1

### 1. Initial Load Test

1. Open the video chat page
2. Check that the debug panel shows "Phase 1 Debug Panel"
3. Verify all checkpoints are being processed
4. Watch the connection states change in real-time

### 2. Socket Connection Test

1. Check console for: `✔ Socket connected: [socket-id]`
2. Debug panel should show: Socket: `connected` (green)
3. Look for: `✔ Connection validated: [data]`
4. Ping/Pong should work: `🏓 Pong received: [data]`

### 3. WebRTC Initialization Test

1. Console should show: `✔ WebRTC PeerConnection initialized`
2. Debug panel should show: WebRTC: `initialized` (green)
3. No errors in browser console

### 4. Media Device Test

1. Browser should request camera/microphone permissions
2. Debug panel should show:
   - Camera Available: ✔
   - Microphone Available: ✔
   - Camera Permission: "granted"
   - Microphone Permission: "granted"
3. Console should show: `✔ Media devices available`

### 5. UI State Test

1. START button should be visible but disabled initially
2. NEXT and STOP buttons should be hidden
3. Video frames should show placeholder text
4. Connection status should show "🟢 Connected to server"

### 6. Phase 1 Completion Test

1. All checkpoints should show ✔
2. "Phase 1 Complete: ✔" should appear at bottom of debug panel
3. START button should become enabled (green)
4. No errors in browser console

## 🚫 Common Issues & Solutions

### Issue: Socket Connection Failed

**Symptoms**: Socket shows "error" or "disconnected"
**Solution**:

- Make sure Socket.IO server is running (`npm run dev:socket`)
- Check port 3001 is not in use
- Verify firewall settings

### Issue: Media Devices Not Detected

**Symptoms**: Camera/Microphone show ❌
**Solution**:

- Allow camera/microphone permissions in browser
- Check if devices are being used by other applications
- Try refreshing the page

### Issue: WebRTC Not Initialized

**Symptoms**: WebRTC shows "error"
**Solution**:

- Check browser compatibility
- Ensure HTTPS or localhost (WebRTC requirement)
- Try different browser

### Issue: START Button Stays Disabled

**Symptoms**: Button remains gray even when Phase 1 complete
**Solution**:

- Check debug panel for failed checkpoints
- Look for console errors
- Verify all prerequisites are met

## 📊 Success Criteria

Phase 1 is successfully completed when:

1. **All 15 checkpoints show ✔**
2. **Debug panel shows "Phase 1 Complete: ✔"**
3. **START button is enabled (green)**
4. **Socket connection is stable**
5. **Media devices are accessible**
6. **No console errors**

## 🔄 Next Steps

Once Phase 1 is complete, you're ready for:

- **Phase 2**: START Button Click Flow
- **Phase 3**: Partner Matching & Connection
- **Phase 4**: Active Connection Management

## 📝 Debug Logs

Expected console output for successful Phase 1:

```
🚀 Starting Phase 1: Initial Load & Setup
✔ All states reset to initial values
✔ Video frames cleared
✔ Socket connected: [socket-id]
✔ Connection validated: {...}
🏓 Pong received: {...}
✔ WebRTC PeerConnection initialized
✔ Media devices available
✔ Local stream initialized (not started)
```

## 🆘 Support

If you encounter issues:

1. Check browser console for errors
2. Verify all dependencies are installed
3. Ensure both servers are running
4. Check camera/microphone permissions
5. Try in incognito/private browsing mode
