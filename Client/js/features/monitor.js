import { SocketService } from "../services/socket.js";
import { UIManager } from "../utils/ui.js";

let objectUrl = null;
let isStreaming = false; // Biến theo dõi trạng thái streaming
let currentZoom = 100; // Current zoom level
let fitMode = "contain"; // contain, cover, fill
let isPanning = false;
let startX, startY, scrollLeft, scrollTop;

// Control variables
let isControlEnabled = false;
let lastMoveTime = 0;

// FPS tracking
let fpsCount = 0;
let lastFpsTimestamp = performance.now();
let currentFps = 0;

// Performance optimization
let frameUpdateScheduled = false;
let pendingFrameBlob = null;

// Chart.js instances
let cpuChart = null;
let ramChart = null;
// Recording helpers
let recordingInterval = null;
let remainingSeconds = 0;
let isScreenAudioEnabled = true; // Audio toggle state
let isScreenAudioMuted = false; // Live audio mute state

// Screen Audio playback
let screenAudioCtx = null;
let screenNextAudioTime = 0;

// Chart data storage (last 20 points)
const maxDataPoints = 20;
const cpuData = [];
const ramData = [];
const timeLabels = [];

export const MonitorFeature = {
  init() {
    // 1. Đăng ký lắng nghe sự kiện từ Server
    SocketService.on("BINARY_STREAM", this.handleStreamFrame.bind(this));
    SocketService.on("SCREEN_CAPTURE", this.handleSnapshotPreview);
    SocketService.on("SCREENSHOT_FILE", this.handleSnapshotDownload);

    // Screen audio stream - dùng cùng AUDIO_STREAM event (header 0x04) với tab Audio
    SocketService.on("AUDIO_STREAM", this.handleScreenAudio.bind(this));

    // Listen for performance stats to update charts
    SocketService.on("PERF_STATS", (data) => {
      this.updateCharts(data.payload || data);
    });

    // 2. Gán sự kiện cho các nút bấm trong UI
    const btnStart = document.querySelector(
      '#tab-monitor button[data-action="start"]'
    );
    const btnStop = document.querySelector(
      '#tab-monitor button[data-action="stop"]'
    );
    const btnCapture = document.querySelector(
      '#tab-monitor button[data-action="capture"]'
    );

    if (btnStart)
      btnStart.onclick = () => {
        isStreaming = true; // cho phép nhận frame
        SocketService.send("START_STREAM");
        // Khởi tạo AudioContext để nghe realtime
        if (isScreenAudioEnabled) {
          this.ensureScreenAudioContext();
        }
        // Enable record button when stream starts
        const recBtn = document.getElementById("btn-monitor-record");
        if (recBtn) recBtn.disabled = false;
      };
    if (btnStop)
      btnStop.onclick = () => {
        isStreaming = false;
        SocketService.send("STOP_STREAM");
        // Reset audio playback
        this.resetScreenAudio();
        this.resetScreen();
        // Disable record button when stream stops
        const recBtn = document.getElementById("btn-monitor-record");
        if (recBtn) recBtn.disabled = true;
        // Stop any recording timer
        this.stopRecordingTimer(true);
      };
    if (btnCapture)
      btnCapture.onclick = () => SocketService.send("CAPTURE_SCREEN");
    // Recording events
    const btnRec = document.getElementById("btn-monitor-record");
    const btnCancel = document.getElementById("btn-monitor-cancel");
    if (btnRec) btnRec.onclick = () => this.startRecording();
    if (btnCancel) btnCancel.onclick = () => this.cancelRecording();

    // Listen for server recorded screen files
    SocketService.on(
      "SCREEN_RECORD_FILE",
      this.handleScreenRecordDownload.bind(this)
    );

    // Setup Pan & Drag for zoomed images
    this.setupPanControls();

    // Setup Control Toggle
    this.setupControlToggle();

    // Setup Mouse and Keyboard Control
    this.setupMouseControl();

    // Initialize Charts (lazy load when tab is active)
    const navMonitor = document.querySelector('[data-tab="tab-monitor"]');
    if (navMonitor) {
      let chartsInitialized = false;
      navMonitor.addEventListener("click", () => {
        if (!chartsInitialized) {
          chartsInitialized = true;
          setTimeout(() => this.initCharts(), 100);
        }
      });
    }
  },

  initCharts() {
    // Get CSS variable colors for theming
    const primaryColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary-color")
        .trim() || "#cb0c9f";
    const successColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--success-color")
        .trim() || "#82d616";

    // CPU Chart
    const cpuCanvas = document.getElementById("cpu-chart");
    if (cpuCanvas && typeof Chart !== "undefined") {
      cpuChart = new Chart(cpuCanvas, {
        type: "line",
        data: {
          labels: timeLabels,
          datasets: [
            {
              label: "CPU Usage (%)",
              data: cpuData,
              borderColor: primaryColor,
              backgroundColor: primaryColor + "20",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              padding: 10,
              cornerRadius: 4,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
              grid: {
                drawBorder: false,
                color: "rgba(0, 0, 0, 0.05)",
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                display: false,
              },
            },
          },
        },
      });
    }

    // RAM Chart
    const ramCanvas = document.getElementById("ram-chart");
    if (ramCanvas && typeof Chart !== "undefined") {
      ramChart = new Chart(ramCanvas, {
        type: "line",
        data: {
          labels: timeLabels,
          datasets: [
            {
              label: "RAM Usage (%)",
              data: ramData,
              borderColor: successColor,
              backgroundColor: successColor + "20",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              padding: 10,
              cornerRadius: 4,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
              grid: {
                drawBorder: false,
                color: "rgba(0, 0, 0, 0.05)",
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                display: false,
              },
            },
          },
        },
      });
    }
  },

  updateCharts(perf) {
    if (!cpuChart || !ramChart) return;

    // Get current time label
    const now = new Date();
    const timeLabel =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0") +
      ":" +
      now.getSeconds().toString().padStart(2, "0");

    // Add new data point
    cpuData.push(perf.cpu || 0);
    ramData.push(perf.ram || 0);
    timeLabels.push(timeLabel);

    // Keep only last maxDataPoints
    if (cpuData.length > maxDataPoints) {
      cpuData.shift();
      ramData.shift();
      timeLabels.shift();
    }

    // Update charts
    cpuChart.update("none"); // 'none' for no animation (smoother real-time)
    ramChart.update("none");
  },

  // Toggle Monitor (Start/Stop)
  toggleMonitor() {
    const btn = document.getElementById("btn-monitor-toggle");
    const btnText = document.getElementById("btn-monitor-text");
    const btnIcon = btn?.querySelector("i");

    if (!isStreaming) {
      // Bật Stream (server tự động bật audio streaming kèm)
      SocketService.send("START_STREAM");
      isStreaming = true;

      // Khởi tạo AudioContext trước (cần user interaction) để nghe realtime
      if (isScreenAudioEnabled) {
        this.ensureScreenAudioContext();
      }

      // Đổi giao diện nút sang Stop
      if (btn) {
        btn.className = "btn btn-danger btn-sm";
      }
      if (btnText) btnText.innerText = "Stop";
      if (btnIcon) btnIcon.className = "fas fa-stop";

      UIManager.showToast("Starting stream...", "info");
      // Enable record button
      const recBtn = document.getElementById("btn-monitor-record");
      if (recBtn) recBtn.disabled = false;
    } else {
      // Tắt Stream (server tự động tắt audio streaming kèm)
      SocketService.send("STOP_STREAM");
      isStreaming = false;

      // Reset audio playback
      this.resetScreenAudio();

      // Reset giao diện
      this.resetScreen();

      // Đổi giao diện nút về Start
      if (btn) {
        btn.className = "btn btn-success btn-sm";
      }
      if (btnText) btnText.innerText = "Start";
      if (btnIcon) btnIcon.className = "fas fa-play";

      UIManager.showToast("Stream stopped", "info");
      // Disable record button and cancel any recording timer
      const recBtn = document.getElementById("btn-monitor-record");
      const cancelBtn = document.getElementById("btn-monitor-cancel");
      if (recBtn) recBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      this.stopRecordingTimer(true);
    }
  },

  // Reset màn hình về trạng thái ban đầu
  resetScreen() {
    console.log("🔄 Resetting screen...");

    const img = document.getElementById("live-screen");
    const placeholder = document.getElementById("screen-placeholder");

    if (img) {
      // Fade out first, then clear src after transition
      img.classList.remove("visible");
      setTimeout(() => {
        img.src = "";
        // Giải phóng bộ nhớ sau khi fade out
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      }, 350); // Match CSS transition duration
      console.log("Image reset");
    }

    if (placeholder) {
      // Restore visibility by removing data-hidden attribute
      placeholder.classList.remove("hidden");
      placeholder.removeAttribute("data-hidden");
      console.log("Placeholder shown");
    }

    // Reset zoom level
    currentZoom = 100;
    fitMode = "contain";
    this.updateZoomIndicator();

    // Reset FPS indicator
    fpsCount = 0;
    currentFps = 0;
    lastFpsTimestamp = performance.now();
    this.updateFpsIndicator();
  },

  // --- Recording ---
  startRecording() {
    if (!isStreaming) {
      UIManager.showToast("Please start stream first!", "error");
      return;
    }

    const durationInput = document.getElementById("monitor-record-duration");
    const duration = Math.max(
      5,
      Math.min(
        120,
        parseInt(durationInput ? durationInput.value : 10, 10) || 10
      )
    );

    const recordBtn = document.getElementById("btn-monitor-record");
    const cancelBtn = document.getElementById("btn-monitor-cancel");
    const audioSwitch = document.getElementById("screen-audio-switch");
    if (recordBtn) recordBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = false;
    if (durationInput) durationInput.disabled = true;
    if (audioSwitch) audioSwitch.disabled = true;

    this.startRecordingTimer(duration);

    // Send command with audio flag
    const payload = JSON.stringify({ duration, audio: isScreenAudioEnabled });
    SocketService.send("RECORD_SCREEN", payload);

    const mode = isScreenAudioEnabled ? "video + audio" : "video only";
    UIManager.showToast(`Recording screen ${mode} ${duration}s...`, "info");
  },

  /**
   * Toggle screen audio on/off (cả live playback và recording)
   * Audio luôn được server stream kèm video, toggle này chỉ control mute/unmute ở client
   */
  toggleScreenAudio() {
    isScreenAudioEnabled = !isScreenAudioEnabled;
    isScreenAudioMuted = !isScreenAudioEnabled;

    const icon = document.getElementById("screen-audio-icon");

    if (isScreenAudioEnabled) {
      if (icon) icon.className = "fas fa-volume-up";
      // Khởi tạo AudioContext ngay khi bật (user interaction required)
      this.ensureScreenAudioContext();
    } else {
      if (icon) icon.className = "fas fa-volume-mute";
      this.resetScreenAudio();
    }

    const status = isScreenAudioEnabled
      ? "🔊 Screen Audio ON"
      : "🔇 Screen Audio OFF";
    UIManager.showToast(status, "info");
  },

  // --- Screen Audio Playback ---
  handleScreenAudio(arrayBuffer) {
    // Chỉ xử lý khi đang streaming và audio enabled
    if (!isStreaming || isScreenAudioMuted || !isScreenAudioEnabled) {
      return;
    }

    // AUDIO_STREAM format: [header 0x04 (1 byte)] [timestamp (4 bytes)] [PCM data]
    let pcmData;
    if (arrayBuffer instanceof ArrayBuffer) {
      // Skip header (1 byte) + timestamp (4 bytes) = 5 bytes
      pcmData = arrayBuffer.slice(5);
    } else if (arrayBuffer instanceof Blob) {
      // Handle Blob case
      arrayBuffer.arrayBuffer().then((ab) => {
        this.playScreenAudioChunk(ab.slice(5));
      });
      return;
    } else {
      console.warn("Unknown audio data type:", typeof arrayBuffer);
      return;
    }

    this.playScreenAudioChunk(pcmData);
  },

  ensureScreenAudioContext() {
    if (!screenAudioCtx) {
      screenAudioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      screenNextAudioTime = 0;
    }
    if (screenAudioCtx.state === "suspended") screenAudioCtx.resume();
  },

  playScreenAudioChunk(pcmBuffer) {
    this.ensureScreenAudioContext();
    if (!screenAudioCtx) return;

    const samples = new Int16Array(pcmBuffer);
    const floatData = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      floatData[i] = samples[i] / 32768;
    }

    const buffer = screenAudioCtx.createBuffer(1, floatData.length, 16000);
    buffer.copyToChannel(floatData, 0, 0);

    const source = screenAudioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(screenAudioCtx.destination);

    const startAt = Math.max(
      screenAudioCtx.currentTime + 0.02,
      screenNextAudioTime || screenAudioCtx.currentTime
    );
    source.start(startAt);
    screenNextAudioTime = startAt + buffer.duration;
  },

  resetScreenAudio() {
    screenNextAudioTime = 0;
  },

  handleScreenRecordDownload(data) {
    const payload = data.payload || data;
    if (!payload) return;

    // Convert base64 to blob
    const binaryString = window.atob(payload);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const fileName = `Screen_Rec_${time}`;

    // Show modal with video preview (giống webcam)
    showVideoPreviewModal(url, fileName);

    UIManager.showToast("Screen recording ready!", "success");

    // Re-enable controls after video is ready
    const durationInput = document.getElementById("monitor-record-duration");
    const recordBtn = document.getElementById("btn-monitor-record");
    const cancelBtn = document.getElementById("btn-monitor-cancel");
    const audioSwitch = document.getElementById("screen-audio-switch");
    if (durationInput) durationInput.disabled = false;
    if (audioSwitch) audioSwitch.disabled = false;
    if (isStreaming && recordBtn) recordBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
    this.stopRecordingTimer();
  },

  startRecordingTimer(durationSec) {
    const timerEl = document.getElementById(
      "monitor-recording-timer-container"
    );
    const countdownEl = document.getElementById("monitor-recording-countdown");
    remainingSeconds = durationSec;
    if (timerEl) timerEl.style.display = "flex";
    if (countdownEl) countdownEl.textContent = `${remainingSeconds}s`;

    if (recordingInterval) clearInterval(recordingInterval);
    recordingInterval = setInterval(() => {
      remainingSeconds -= 1;
      // Play beep at last 3 seconds (optional)
      if (remainingSeconds <= 3 && remainingSeconds > 0) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = 750;
          o.connect(ctx.destination);
          o.start();
          setTimeout(() => {
            o.stop();
            ctx.close();
          }, 120);
        } catch (e) {
          // ignore audio errors
        }
      }
      if (countdownEl)
        countdownEl.textContent = `${Math.max(0, remainingSeconds)}s`;
      if (remainingSeconds <= 0) {
        this.stopRecordingTimer();
      }
    }, 1000);
  },

  stopRecordingTimer(forceHide = false) {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    const timerEl = document.getElementById(
      "monitor-recording-timer-container"
    );
    if (timerEl) timerEl.style.display = "none";
    remainingSeconds = 0;

    const durationInput = document.getElementById("monitor-record-duration");
    const recordBtn = document.getElementById("btn-monitor-record");
    const cancelBtn = document.getElementById("btn-monitor-cancel");
    if (durationInput) durationInput.disabled = false;
    if (!forceHide && isStreaming && recordBtn) recordBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
  },

  cancelRecording() {
    this.stopRecordingTimer();
    SocketService.send("CANCEL_RECORD");
    UIManager.showToast("Screen recording cancelled", "info");
  },

  handleStreamFrame(arrayBuffer) {
    // Đọc header để phân loại frame (0x01 = monitor, 0x02 = webcam)
    const view = new DataView(arrayBuffer);
    const header = view.getUint8(0);
    const blobData = arrayBuffer.slice(1); // bỏ byte header

    // Chỉ hiển thị màn hình khi đang stream và đúng header
    if (!isStreaming || header !== 0x01) {
      return;
    }

    // FPS counting
    fpsCount += 1;
    const now = performance.now();
    const elapsed = now - lastFpsTimestamp;
    if (elapsed >= 1000) {
      currentFps = Math.round((fpsCount * 1000) / elapsed);
      fpsCount = 0;
      lastFpsTimestamp = now;
      this.updateFpsIndicator();
    }

    // Tạo blob và lưu tạm để xử lý với requestAnimationFrame
    const blob = new Blob([blobData], { type: "image/jpeg" });
    pendingFrameBlob = blob;

    // Sử dụng requestAnimationFrame để throttle việc update UI
    if (!frameUpdateScheduled) {
      frameUpdateScheduled = true;
      requestAnimationFrame(() => {
        MonitorFeature.updateFrameDisplay();
        frameUpdateScheduled = false;
      });
    }
  },

  // Hàm mới để update frame display (được gọi bởi requestAnimationFrame)
  updateFrameDisplay() {
    if (!pendingFrameBlob) return;

    // Giải phóng URL cũ
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    // Tạo URL mới
    objectUrl = URL.createObjectURL(pendingFrameBlob);
    pendingFrameBlob = null;

    const img = document.getElementById("live-screen");
    const placeholder = document.getElementById("screen-placeholder");

    if (img && objectUrl) {
      img.src = objectUrl;
      img.classList.add("visible");

      // Apply current zoom and fit mode
      this.applyZoom(currentZoom);
      this.applyFitMode(fitMode);
    }

    if (placeholder) {
      placeholder.classList.add("hidden");
      placeholder.setAttribute("data-hidden", "true");
    }
  },

  updateFpsIndicator() {
    const fpsEl = document.getElementById("monitor-fps");
    if (fpsEl) fpsEl.textContent = `FPS: ${currentFps}`;
  },

  // Xử lý ảnh xem trước (Base64)
  handleSnapshotPreview(data) {
    const payload = data.payload || data;
    const imgSrc = "data:image/jpeg;base64," + payload;
    const previewImg = document.getElementById("captured-preview");
    const saveBadge = document.getElementById("save-badge");
    const previewText = document.getElementById("preview-text");

    if (previewImg) {
      previewImg.src = imgSrc;
      previewImg.classList.remove("hidden");
      if (previewText) previewText.style.display = "none";
      if (saveBadge) saveBadge.classList.remove("hidden");
    }
  },

  // Xử lý tải ảnh gốc về máy
  handleSnapshotDownload(data) {
    const payload = data.payload || data;
    const link = document.createElement("a");
    link.href = "data:image/jpeg;base64," + payload;
    const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    link.download = `Screenshot_${time}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // NEW: Zoom Controls
  zoom(action) {
    const img = document.getElementById("live-screen");
    if (!img || img.style.display === "none") return;

    if (action === "in") {
      if (currentZoom < 200) currentZoom += 25;
    } else if (action === "out") {
      if (currentZoom > 50) currentZoom -= 25;
    } else if (action === "reset") {
      currentZoom = 100;
    }

    this.applyZoom(currentZoom);
    this.updateZoomIndicator();
    UIManager.showToast(`Zoom: ${currentZoom}%`, "info");
  },

  applyZoom(level) {
    const img = document.getElementById("live-screen");
    if (!img) return;

    // Remove all zoom classes
    img.className = img.className.replace(/zoom-\d+/g, "").trim();

    // Add new zoom class
    img.classList.add(`zoom-${level}`);
  },

  updateZoomIndicator() {
    const indicator = document.getElementById("monitor-zoom-level");
    if (indicator) {
      indicator.textContent = `${currentZoom}%`;
      indicator.classList.add("show");
      setTimeout(() => indicator.classList.remove("show"), 1500);
    }
  },

  // NEW: Toggle Fit Mode
  toggleFitMode() {
    const modes = ["contain", "cover", "fill"];
    const currentIndex = modes.indexOf(fitMode);
    fitMode = modes[(currentIndex + 1) % modes.length];

    this.applyFitMode(fitMode);

    const btn = document.getElementById("btn-monitor-fit");
    const icons = {
      contain: "fa-compress-arrows-alt",
      cover: "fa-expand-arrows-alt",
      fill: "fa-arrows-alt",
    };

    if (btn) {
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = `fas ${icons[fitMode]}`;
      }
    }

    UIManager.showToast(`Fit Mode: ${fitMode}`, "info");
  },

  applyFitMode(mode) {
    const img = document.getElementById("live-screen");
    if (!img) return;

    img.className = img.className
      .replace(/fit-(contain|cover|fill)/g, "")
      .trim();
    img.classList.add(`fit-${mode}`);
  },

  // NEW: Fullscreen Toggle
  toggleFullscreen() {
    const container = document.getElementById("monitor-container");
    if (!container) return;

    if (!document.fullscreenElement) {
      container
        .requestFullscreen()
        .then(() => {
          container.classList.add("fullscreen");

          // Add exit button
          if (!container.querySelector(".fullscreen-exit")) {
            const exitBtn = document.createElement("button");
            exitBtn.className = "fullscreen-exit";
            exitBtn.innerHTML =
              '<i class="fas fa-times"></i> Exit Fullscreen (ESC)';
            exitBtn.onclick = () => this.toggleFullscreen();
            container.appendChild(exitBtn);
          }

          UIManager.showToast("Fullscreen Mode", "info");
        })
        .catch((err) => {
          UIManager.showToast("Fullscreen failed: " + err.message, "error");
        });
    } else {
      document.exitFullscreen().then(() => {
        container.classList.remove("fullscreen");
        const exitBtn = container.querySelector(".fullscreen-exit");
        if (exitBtn) exitBtn.remove();
        UIManager.showToast("Exited Fullscreen", "info");
      });
    }
  },

  // NEW: Pan & Drag for Zoomed Images
  setupPanControls() {
    const container = document.getElementById("monitor-container");
    if (!container) return;

    container.addEventListener("mousedown", (e) => {
      if (currentZoom > 100) {
        isPanning = true;
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
      }
    });

    container.addEventListener("mouseleave", () => {
      isPanning = false;
    });

    container.addEventListener("mouseup", () => {
      isPanning = false;
    });

    container.addEventListener("mousemove", (e) => {
      if (!isPanning) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });
  },

  // NEW: Setup Control Toggle
  setupControlToggle() {
    const checkbox = document.getElementById("control-toggle");
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        this.toggleControl(e.target.checked);
      });
    }
  },

  // NEW: Toggle Remote Control
  toggleControl(enabled) {
    isControlEnabled = enabled;
    const screenImg = document.getElementById("live-screen");

    if (isControlEnabled) {
      UIManager.showToast("Remote control ENABLED!", "success");
      if (screenImg) {
        screenImg.style.cursor = "crosshair";
        screenImg.classList.add("control-active");
      }
      // Add keyboard event listener (use arrow function to preserve context)
      this.keyHandler = (e) => this.handleRemoteKey(e);
      document.addEventListener("keydown", this.keyHandler);
    } else {
      UIManager.showToast("Remote control DISABLED!", "info");
      if (screenImg) {
        screenImg.style.cursor = "default";
        screenImg.classList.remove("control-active");
      }
      // Remove keyboard event listener
      if (this.keyHandler) {
        document.removeEventListener("keydown", this.keyHandler);
        this.keyHandler = null;
      }
    }
  },

  // NEW: Setup Mouse Control on Live Screen
  setupMouseControl() {
    const screenImg = document.getElementById("live-screen");
    if (!screenImg) return;

    // Mouse Move
    screenImg.addEventListener("mousemove", (e) => {
      if (!isControlEnabled) return;

      const now = Date.now();
      if (now - lastMoveTime < 50) return; // Throttle to 20fps
      lastMoveTime = now;

      const rect = screenImg.getBoundingClientRect();
      let rawX = (e.clientX - rect.left) / rect.width;
      let rawY = (e.clientY - rect.top) / rect.height;

      // Clamp values between 0 and 1
      const xPercent = Math.max(0, Math.min(1, rawX));
      const yPercent = Math.max(0, Math.min(1, rawY));

      SocketService.send(
        "MOUSE_MOVE",
        JSON.stringify({ x: xPercent, y: yPercent })
      );
    });

    // Mouse Down
    screenImg.addEventListener("mousedown", (e) => {
      if (!isControlEnabled) return;
      e.preventDefault();

      const btn = e.button === 0 ? "left" : e.button === 2 ? "right" : "middle";
      SocketService.send(
        "MOUSE_CLICK",
        JSON.stringify({ btn: btn, action: "down" })
      );
    });

    // Mouse Up
    screenImg.addEventListener("mouseup", (e) => {
      if (!isControlEnabled) return;
      e.preventDefault();

      const btn = e.button === 0 ? "left" : e.button === 2 ? "right" : "middle";
      SocketService.send(
        "MOUSE_CLICK",
        JSON.stringify({ btn: btn, action: "up" })
      );
    });

    // Prevent Context Menu when controlling
    screenImg.addEventListener("contextmenu", (e) => {
      if (isControlEnabled) e.preventDefault();
    });
  },

  // NEW: Handle Keyboard Input for Remote Control
  handleRemoteKey(e) {
    if (!isControlEnabled) return;

    SocketService.send("KEY_PRESS", e.key);

    // Prevent default browser behavior for certain keys
    if (
      [
        "F5",
        "Tab",
        "Alt",
        "ContextMenu",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.key)
    ) {
      e.preventDefault();
    }
  },
};
