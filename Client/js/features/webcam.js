import { SocketService } from "../services/socket.js";
import { UIManager } from "../utils/ui.js";

let webcamZoomLevel = 100;
let webcamFitMode = "contain";
let isWebcamPanning = false;
let webcamStartX, webcamStartY, webcamScrollLeft, webcamScrollTop;
let isWebcamActive = false; // Track webcam state
let recordingInterval = null;
let remainingSeconds = 0;

// Audio streaming state
let audioCtx = null;
let nextAudioTime = 0;
let isAudioMuted = false; // Track audio mute state

export const WebcamFeature = {
  init() {
    SocketService.on("WEBCAM_FRAME", this.handleWebcamFrame.bind(this));
    SocketService.on("VIDEO_FILE", this.handleVideoDownload.bind(this));
    SocketService.on("BINARY_STREAM", this.handleBinaryStream.bind(this));

    // Setup pan controls
    this.setupWebcamPan();
  },

  /**
   * Toggle Webcam ON/OFF
   */
  toggleWebcam() {
    const btn = document.getElementById("btn-webcam-toggle");
    const btnText = document.getElementById("btn-webcam-text");
    const recordBtn = document.getElementById("btn-webcam-record");

    if (!isWebcamActive) {
      // Turn ON
      console.log("📹 Starting Webcam...");
      SocketService.send("START_WEBCAM");
      isWebcamActive = true;

      // Update button appearance
      if (btn) {
        btn.className = "btn btn-danger w-100 mb-2 fw-bold";
      }
      if (btnText) {
        btnText.innerText = "TẮT WEBCAM";
      }

      // Enable record button
      if (recordBtn) {
        recordBtn.disabled = false;
      }

      UIManager.showToast("Bật Webcam...", "info");
    } else {
      // Turn OFF
      console.log("📹 Stopping Webcam...");
      SocketService.send("STOP_WEBCAM");
      isWebcamActive = false;
      // Stop any ongoing recording countdown
      this.stopRecordingTimer(true);

      // Reset interface
      this.resetWebcam();

      // Update button appearance
      if (btn) {
        btn.className = "btn btn-success w-100 mb-2 fw-bold";
      }
      if (btnText) {
        btnText.innerText = "BẬT WEBCAM";
      }

      // Disable record button
      if (recordBtn) {
        recordBtn.disabled = true;
      }

      UIManager.showToast("Tắt Webcam", "info");
    }
  },

  // Reset webcam về trạng thái ban đầu
  resetWebcam() {
    console.log("🔄 Resetting webcam...");

    const camImg = document.getElementById("webcam-feed");
    const placeholder = document.getElementById("webcam-placeholder");
    const statusBadge = document.getElementById("cam-status");

    if (camImg) {
      // Fade out first, then clear src after transition
      camImg.classList.remove("visible");
      setTimeout(() => {
        camImg.src = "";
      }, 350); // Match CSS transition duration
      console.log("✓ Webcam image reset");
    }

    if (placeholder) {
      // Restore visibility by removing data-hidden attribute
      placeholder.classList.remove("hidden");
      placeholder.removeAttribute("data-hidden");
      console.log("✓ Webcam placeholder shown");
    }

    if (statusBadge) {
      statusBadge.className = "badge bg-secondary";
      statusBadge.innerText = "OFFLINE";
      console.log("✓ Status badge reset");
    }

    webcamZoomLevel = 100;
    webcamFitMode = "contain";
    this.updateWebcamZoomDisplay();

    // Reset audio queue
    this.resetAudioPlayback();
  },

  // Nhận binary stream (âm thanh webcam header 0x03)
  handleBinaryStream(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const header = view.getUint8(0);
    if (header !== 0x03) return; // audio only

    const pcmData = arrayBuffer.slice(1);
    this.playAudioChunk(pcmData);
  },

  ensureAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      nextAudioTime = 0;
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  },

  playAudioChunk(pcmBuffer) {
    // Skip if audio is muted
    if (isAudioMuted) return;
    
    this.ensureAudioContext();
    if (!audioCtx) return;

    const samples = new Int16Array(pcmBuffer);
    const floatData = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      floatData[i] = samples[i] / 32768;
    }

    const buffer = audioCtx.createBuffer(1, floatData.length, 16000);
    buffer.copyToChannel(floatData, 0, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    const startAt = Math.max(
      audioCtx.currentTime + 0.02,
      nextAudioTime || audioCtx.currentTime
    );
    source.start(startAt);
    nextAudioTime = startAt + buffer.duration;
  },

  resetAudioPlayback() {
    nextAudioTime = 0;
    // Không đóng AudioContext để tránh chờ user gesture, chỉ reset queue
  },

  /**
   * Toggle audio (cả live playback và record) từ switch overlay
   */
  toggleAudio() {
    isAudioMuted = !isAudioMuted;
    
    const checkbox = document.getElementById("webcam-audio-switch");
    const icon = document.getElementById("audio-switch-icon");
    
    // Sync checkbox state
    if (checkbox) checkbox.checked = !isAudioMuted;
    
    // Update icon
    if (icon) {
      if (isAudioMuted) {
        icon.className = "fas fa-volume-mute";
      } else {
        icon.className = "fas fa-volume-up";
      }
    }
    
    const status = isAudioMuted ? "🔇 Audio OFF" : "🔊 Audio ON";
    UIManager.showToast(status, "info");
  },

  /**
   * Get audio enabled state (for recording)
   */
  isAudioEnabled() {
    return !isAudioMuted;
  },

  handleWebcamFrame(data) {
    const payload = data.payload || data;

    if (!payload) {
      console.error("❌ No payload received");
      return;
    }

    console.log("✅ Received webcam frame");

    const camImg = document.getElementById("webcam-feed");
    const placeholder = document.getElementById("webcam-placeholder");
    const statusBadge = document.getElementById("cam-status");

    console.log("📷 Elements found:", {
      camImg: !!camImg,
      placeholder: !!placeholder,
      statusBadge: !!statusBadge,
    });

    if (camImg) {
      camImg.src = "data:image/jpeg;base64," + payload;
      // Trigger reflow to allow transition
      camImg.offsetHeight;
      camImg.classList.add("visible");

      console.log("✓ Webcam image displayed");

      // Apply zoom and fit
      this.applyWebcamZoom(webcamZoomLevel);
      this.applyWebcamFit(webcamFitMode);
    } else {
      console.error("❌ #webcam-feed element not found!");
    }

    if (placeholder) {
      // Use class-based approach for smooth fade
      placeholder.classList.add("hidden");
      placeholder.setAttribute("data-hidden", "true");
      console.log("✓ Webcam placeholder hidden");
    } else {
      console.error("❌ #webcam-placeholder element not found!");
    }

    if (statusBadge) {
      statusBadge.className = "badge bg-success";
      statusBadge.innerText = "LIVE";
      console.log("✓ Status badge updated");
    }
  },

  /**
   * Start recording webcam
   */
  startRecording() {
    if (!isWebcamActive) {
      UIManager.showToast("Hãy bật Webcam trước!", "error");
      return;
    }

    const durationInput = document.getElementById("record-duration");
    const duration = Math.max(
      5,
      Math.min(
        120,
        parseInt(durationInput ? durationInput.value : 10, 10) || 10
      )
    );

    // Check if audio recording is enabled (từ audio switch overlay)
    const includeAudio = this.isAudioEnabled();

    // Disable controls during recording
    const recordBtn = document.getElementById("btn-webcam-record");
    const cancelBtn = document.getElementById("btn-webcam-cancel");
    const audioSwitch = document.getElementById("webcam-audio-switch");
    if (recordBtn) recordBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = false;
    if (durationInput) durationInput.disabled = true;
    if (audioSwitch) audioSwitch.disabled = true;

    this.startRecordingTimer(duration);

    // Send command with audio flag
    const payload = JSON.stringify({ duration, audio: includeAudio });
    SocketService.send("RECORD_WEBCAM", payload);

    const mode = includeAudio ? "video + audio" : "video only";
    UIManager.showToast(`Đang ghi ${mode} ${duration}s...`, "info");
  },

  handleVideoDownload(data) {
    const payload = data.payload || data;
    const binaryString = window.atob(payload);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const fileName = `Webcam_Rec_${time}`;

    // Show modal with video preview
    showVideoPreviewModal(url, fileName);

    // Re-enable controls
    const durationInput = document.getElementById("record-duration");
    const recordBtn = document.getElementById("btn-webcam-record");
    const cancelBtn = document.getElementById("btn-webcam-cancel");
    const audioSwitch = document.getElementById("webcam-audio-switch");
    if (durationInput) durationInput.disabled = false;
    if (audioSwitch) audioSwitch.disabled = false;
    if (isWebcamActive && recordBtn) recordBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
    this.stopRecordingTimer();
  },

  // NEW: Webcam Zoom
  zoom(action) {
    const img = document.getElementById("webcam-feed");
    if (!img || img.style.display === "none") return;

    if (action === "in") {
      if (webcamZoomLevel < 200) webcamZoomLevel += 25;
    } else if (action === "out") {
      if (webcamZoomLevel > 50) webcamZoomLevel -= 25;
    } else if (action === "reset") {
      webcamZoomLevel = 100;
    }

    this.applyWebcamZoom(webcamZoomLevel);
    this.updateWebcamZoomDisplay();
    UIManager.showToast(`Webcam Zoom: ${webcamZoomLevel}%`, "info");
  },

  applyWebcamZoom(level) {
    const img = document.getElementById("webcam-feed");
    if (!img) return;

    img.className = img.className.replace(/zoom-\d+/g, "").trim();
    img.classList.add(`zoom-${level}`);
  },

  updateWebcamZoomDisplay() {
    const display = document.getElementById("webcam-zoom-level");
    if (display) {
      display.textContent = `${webcamZoomLevel}%`;
    }
  },

  // NEW: Webcam Fit Mode Toggle
  toggleFitMode() {
    const modes = ["contain", "cover", "fill"];
    const currentIndex = modes.indexOf(webcamFitMode);
    webcamFitMode = modes[(currentIndex + 1) % modes.length];

    this.applyWebcamFit(webcamFitMode);

    const btn = document.getElementById("btn-webcam-fit");
    const icons = {
      contain: "fa-compress-arrows-alt",
      cover: "fa-expand-arrows-alt",
      fill: "fa-arrows-alt",
    };

    if (btn) {
      const icon = btn.querySelector("i");
      if (icon) icon.className = `fas ${icons[webcamFitMode]}`;
    }

    UIManager.showToast(`Webcam Fit: ${webcamFitMode}`, "info");
  },

  applyWebcamFit(mode) {
    const img = document.getElementById("webcam-feed");
    if (!img) return;

    img.className = img.className
      .replace(/fit-(contain|cover|fill)/g, "")
      .trim();
    img.classList.add(`fit-${mode}`);
  },

  // NEW: Webcam Fullscreen
  toggleFullscreen() {
    const container = document.getElementById("webcam-container");
    if (!container) return;

    if (!document.fullscreenElement) {
      container
        .requestFullscreen()
        .then(() => {
          container.classList.add("fullscreen");

          if (!container.querySelector(".webcam-fullscreen-exit")) {
            const exitBtn = document.createElement("button");
            exitBtn.className = "webcam-fullscreen-exit";
            exitBtn.innerHTML = '<i class="fas fa-times"></i> Exit (ESC)';
            exitBtn.onclick = () => this.toggleFullscreen();
            container.appendChild(exitBtn);
          }

          UIManager.showToast("Webcam Fullscreen", "info");
        })
        .catch((err) => {
          UIManager.showToast("Fullscreen failed", "error");
        });
    } else {
      document.exitFullscreen().then(() => {
        container.classList.remove("fullscreen");
        const exitBtn = container.querySelector(".webcam-fullscreen-exit");
        if (exitBtn) exitBtn.remove();
        UIManager.showToast("Exited Fullscreen", "info");
      });
    }
  },

  // NEW: Pan & Drag for Zoomed Webcam
  setupWebcamPan() {
    const container = document.getElementById("webcam-container");
    if (!container) return;

    container.addEventListener("mousedown", (e) => {
      if (webcamZoomLevel > 100) {
        isWebcamPanning = true;
        webcamStartX = e.pageX - container.offsetLeft;
        webcamStartY = e.pageY - container.offsetTop;
        webcamScrollLeft = container.scrollLeft;
        webcamScrollTop = container.scrollTop;
      }
    });

    container.addEventListener("mouseleave", () => {
      isWebcamPanning = false;
    });

    container.addEventListener("mouseup", () => {
      isWebcamPanning = false;
    });

    container.addEventListener("mousemove", (e) => {
      if (!isWebcamPanning) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - webcamStartX) * 1.5;
      const walkY = (y - webcamStartY) * 1.5;
      container.scrollLeft = webcamScrollLeft - walkX;
      container.scrollTop = webcamScrollTop - walkY;
    });
  },

  // Recording countdown helpers
  startRecordingTimer(durationSec) {
    const timerEl = document.getElementById("recording-timer-container");
    const countdownEl = document.getElementById("recording-countdown");
    remainingSeconds = durationSec;
    if (timerEl) timerEl.style.display = "flex";
    if (countdownEl) countdownEl.textContent = `${remainingSeconds}s`;

    if (recordingInterval) clearInterval(recordingInterval);
    recordingInterval = setInterval(() => {
      remainingSeconds -= 1;
      // Play beep at last 3 seconds
      if (remainingSeconds <= 3 && remainingSeconds > 0) {
        this.playCountdownBeep();
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
    const timerEl = document.getElementById("recording-timer-container");
    if (timerEl) timerEl.style.display = "none";
    remainingSeconds = 0;

    // Re-enable controls unless forceHide (called by webcam off)
    const durationInput = document.getElementById("record-duration");
    const recordBtn = document.getElementById("btn-webcam-record");
    const cancelBtn = document.getElementById("btn-webcam-cancel");
    if (durationInput) durationInput.disabled = false;
    if (!forceHide && isWebcamActive && recordBtn) recordBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
  },

  // Cancel recording early
  cancelRecording() {
    this.stopRecordingTimer();
    // Attempt to notify server to cancel if supported
    SocketService.send("CANCEL_RECORD");
    UIManager.showToast("Đã hủy ghi hình", "info");
  },

  // Simple beep using Web Audio API
  playCountdownBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.16);
    } catch (e) {
      // Fail silently
    }
  },
};
