# Quick Reference - Logger Usage

## 🖥️ Client Logger

### Import

```javascript
import { Logger } from "./utils/logger.js";
```

### Methods

| Method           | Emoji | Example                                           |
| ---------------- | ----- | ------------------------------------------------- |
| `info()`         | ℹ️    | `Logger.info("Starting connection...")`           |
| `success()`      | ✅    | `Logger.success("File uploaded successfully")`    |
| `error()`        | ❌    | `Logger.error("Network error occurred")`          |
| `warning()`      | ⚠️    | `Logger.warning("Low bandwidth detected")`        |
| `command()`      | 🔧    | `Logger.command("CAPTURE_SCREEN", "90")`          |
| `file()`         | 📁    | `Logger.file("Opening", "C:\\Users\\file.txt")`   |
| `media()`        | 🎬    | `Logger.media("Recording started", "30 seconds")` |
| `network()`      | 🌐    | `Logger.network("Connected to server")`           |
| `ui()`           | 🎨    | `Logger.ui("Theme changed", "dark mode")`         |
| `navigation()`   | 🗺️    | `Logger.navigation("dashboard")`                  |
| `serverAction()` | 🖥️    | `Logger.serverAction("Screen refresh received")`  |
| `header()`       | Bold  | `Logger.header("Session Started")`                |

### Examples

```javascript
// Info logging
Logger.info("Initializing webcam stream");

// Success feedback
Logger.success("Settings saved successfully");

// Error handling
try {
  // some operation
} catch (error) {
  Logger.error(`Failed to load: ${error.message}`);
}

// Commands
Logger.command("GET_APPS", "");
Logger.command("KILL", "1234");

// File operations
Logger.file("Downloading", "document.pdf");
Logger.file("Uploading to", "C:\\Shared\\");

// Media operations
Logger.media("Webcam recording", "2 minutes 30 seconds");
Logger.media("Stopping screen record");

// Network
Logger.network("Reconnecting to server...");

// UI changes
Logger.ui("Sidebar toggled", "expanded");

// Navigation
Logger.navigation("monitor");
Logger.navigation("file-manager");
```

---

## ⚙️ Server Logger (C#)

### Import

```csharp
using RemoteControlServer.Helpers;
```

### Methods

| Method             | Emoji | Example                                                 |
| ------------------ | ----- | ------------------------------------------------------- |
| `Info()`           | ℹ️    | `Logger.Info("Server started")`                         |
| `Success()`        | ✅    | `Logger.Success("File sent successfully")`              |
| `Error()`          | ❌    | `Logger.Error("Database connection failed")`            |
| `Warning()`        | ⚠️    | `Logger.Warning("High CPU usage detected")`             |
| `ClientAction()`   | 🖥️    | `Logger.ClientAction("Client connected")`               |
| `Command()`        | 🔧    | `Logger.Command("START_STREAM", "720p")`                |
| `FileOperation()`  | 📁    | `Logger.FileOperation("Deleted", "C:\\temp\\file.dat")` |
| `MediaOperation()` | 🎬    | `Logger.MediaOperation("Recording", "150 KB")`          |
| `Network()`        | 🌐    | `Logger.Network("Listening on port 8181")`              |
| `Header()`         | Bold  | `Logger.Header("SYSTEM STATUS")`                        |

### Examples

```csharp
// Info logging
Logger.Info("Scanning for applications...");

// Success
Logger.Success("Authentication successful!");

// Error handling
try {
    // some operation
} catch (Exception ex) {
    Logger.Error($"Operation failed: {ex.Message}");
}

// Client actions
Logger.ClientAction("Requesting screenshot");
Logger.ClientAction("Uploading file");

// Commands
Logger.Command("GET_PROCESS", "");
Logger.Command("KILL", "1234");

// File operations
Logger.FileOperation("Created", "C:\\Logs\\session.log");
Logger.FileOperation("Deleted", "C:\\Temp\\frame_001.bmp");

// Media operations
Logger.MediaOperation("Encoding video", "500 frames");
Logger.MediaOperation("Recording audio", "2 minutes");

// Network
Logger.Network("Broadcasting to 3 clients");

// Header for important sections
Logger.Header("REMOTE CONTROL SERVER IS RUNNING");
Logger.Separator();
Logger.Network("URL: ws://0.0.0.0:8181");
Logger.Success("Password: 123456");
Logger.Separator();
```

---

## 🎯 Best Practices

1. **Use appropriate method for context**

   - ✅ Use `success()` for completed operations
   - ❌ Use `error()` for failures
   - ⚠️ Use `warning()` for potential issues
   - ℹ️ Use `info()` for general messages

2. **Include context in messages**

   ```javascript
   // Good
   Logger.error(`Failed to load settings: ${error.message}`);
   Logger.media("Webcam recording", `${duration}s, ${fileSize}KB`);

   // Bad
   Logger.error("Error!");
   Logger.media("Recording");
   ```

3. **Use command logging for debugging**

   ```csharp
   Logger.Command(packet.command, packet.param);
   ```

4. **Group related logs**

   ```csharp
   Logger.Header("Starting Video Stream");
   Logger.FileOperation("Created", framePath);
   Logger.MediaOperation("Encoding", "1920x1080");
   Logger.Success("Video stream ready");
   Logger.Separator();
   ```

5. **Chain multiple logs for clarity**
   ```javascript
   Logger.network("Connecting to server...");
   // ... after connection ...
   Logger.success("Connected!");
   ```

---

## 📊 Console Output Format

### Server Terminal

```
[⚙️  SERVER] ℹ️ Starting video capture...
[⚙️  SERVER] 🎬 Encoding video - 1920x1080
[⚙️  SERVER] ✅ Video saved: 512 KB
[🖥️  CLIENT] → Downloaded file: recording.mp4
═════════════════════════════════════════
```

### Browser Console (F12 → Console)

```
[🖥️  CLIENT] ℹ️ Initializing features
[🖥️  CLIENT] 🔧 [CMD] START_WEBCAM
[🖥️  CLIENT] ✅ Webcam started
[🖥️  CLIENT] 🗺️ Navigation: webcam
[⚙️  SERVER] → Screen captured
[🖥️  CLIENT] 🎬 Displaying frame 150 KB
```

---

## 🔍 Debugging

### Client Debug Mode

```javascript
// Enable debug logs
window.DEBUG_MODE = true;
Logger.debug("Checking connection state", socket);

// Disable debug logs (default)
window.DEBUG_MODE = false;
```

### View Navigation State

```javascript
// Call this in browser console
window.debugNavigation();
```

### Example Output

```
───────────────────────────────────────
   Navigation Debug Info
═══════════════════════════════════════
[🖥️  CLIENT] ℹ️ Navigation Buttons: 12
[🖥️  CLIENT] 🐛 [DEBUG] Button 1: dashboard - Active: true
[🖥️  CLIENT] 🐛 [DEBUG] Button 2: monitor - Active: false
...
───────────────────────────────────────
```
