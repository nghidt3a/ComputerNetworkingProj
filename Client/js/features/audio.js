import { SocketService } from "../services/socket.js";
import { UIManager } from "../utils/ui.js";

let isAudioActive = false;
let recordingInterval = null;
let remainingSeconds = 0;

// Live audio streaming
let audioCtx = null;
let analyser = null;
let animationId = null;
let workletNode = null; // AudioWorklet-backed jitter buffer
let audioBuffer = new Uint8Array(2048);
// Preview playback state
let currentPreviewItem = null;
let currentPreviewButton = null;

export const AudioFeature = {
  init() {
    // Listen for live audio chunks (header 0x04) - dispatched as AUDIO_STREAM
    SocketService.on("AUDIO_STREAM", this.handleLiveAudio.bind(this));
    // Listen for server-sent audio file when recording completes
    SocketService.on("AUDIO_RECORD_FILE", this.handleAudioDownload.bind(this));

    // Wire UI buttons (in case HTML was added after init)
    const recBtn = document.getElementById("btn-audio-record");
    const cancelBtn = document.getElementById("btn-audio-cancel");
    if (recBtn) recBtn.onclick = () => this.startRecording();
    if (cancelBtn) cancelBtn.onclick = () => this.cancelRecording();
  },

  toggleAudio() {
    const btn = document.getElementById("btn-audio-toggle");
    const btnText = document.getElementById("btn-audio-text");
    const recBtn = document.getElementById("btn-audio-record");
    const icon = document.getElementById("btn-audio-icon");

    isAudioActive = !isAudioActive;

    if (isAudioActive) {
      // Start live audio
      this.startLiveAudio();

      if (btn) btn.className = "btn btn-danger w-100 mb-2 fw-bold";
      if (btnText) btnText.innerText = "Stop";
      if (icon) icon.className = "fas fa-stop me-2";
      if (recBtn) recBtn.disabled = false;
      UIManager.showToast("Live audio started", "info");
    } else {
      // Stop live audio
      this.stopLiveAudio();

      if (btn) btn.className = "btn btn-success w-100 mb-2 fw-bold";
      if (btnText) btnText.innerText = "Start";
      if (icon) icon.className = "fas fa-power-off me-2";
      if (recBtn) recBtn.disabled = true;
      this.stopRecordingTimer(true);
      UIManager.showToast("Live audio stopped", "info");
    }
  },

  handleLiveAudio(arrayBuffer) {
    if (!isAudioActive) return;

    // AUDIO_STREAM format: [header 0x04 (1 byte)] [timestamp (4 bytes)] [PCM data]
    // Header đã được filter bởi socket.js, chỉ cần parse timestamp và PCM
    const view = new DataView(arrayBuffer);

    // Skip header (1 byte) + timestamp (4 bytes) = 5 bytes
    const pcmData = arrayBuffer.slice(5);
    this.playAudioChunk(pcmData);
  },

  startLiveAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
    }
    // Ensure context is running
    if (audioCtx.state === "suspended") audioCtx.resume();

    // Load worklet module once and create processor node
    const ensureWorklet = async () => {
      if (!workletNode) {
        try {
          await audioCtx.audioWorklet.addModule("js/features/audio-worklet.js");
          workletNode = new AudioWorkletNode(audioCtx, "pcm-player");
          // Connect: worklet -> analyser -> destination
          workletNode.connect(analyser);
          analyser.connect(audioCtx.destination);
        } catch (err) {
          console.error("AudioWorklet init failed, falling back.", err);
          // Fallback: connect analyser directly to destination
          analyser.connect(audioCtx.destination);
        }
      }
    };
    ensureWorklet();

    // Hide placeholder
    const placeholder = document.getElementById("audio-placeholder");
    if (placeholder) placeholder.style.display = "none";

    // Send START_AUDIO command to server
    SocketService.send("START_AUDIO");

    this.startVisualizer();
  },

  stopLiveAudio() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    // Clear buffered samples inside worklet
    if (workletNode) {
      try {
        workletNode.port.postMessage({ type: "clear" });
      } catch {}
    }

    // Send STOP_AUDIO command to server
    SocketService.send("STOP_AUDIO");

    // Clear waveform and show placeholder
    const canvas = document.getElementById("audio-waveform-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Show placeholder
    const placeholder = document.getElementById("audio-placeholder");
    if (placeholder) placeholder.style.display = "flex";
  },

  playAudioChunk(pcmBuffer) {
    if (!audioCtx || !analyser) return;

    // Convert 16-bit PCM to Float32 [-1, 1]
    const samples = new Int16Array(pcmBuffer);
    const floatData = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      floatData[i] = samples[i] / 32768;
    }

    // Prefer AudioWorklet for smooth low-latency playback
    if (workletNode) {
      try {
        workletNode.port.postMessage({ type: "push", samples: floatData }, [
          floatData.buffer,
        ]);
        return;
      } catch (e) {
        console.warn("Worklet push failed, using BufferSource fallback.", e);
      }
    }

    // Fallback: schedule small buffers (less stable under jitter)
    const buffer = audioCtx.createBuffer(1, floatData.length, 16000);
    buffer.copyToChannel(floatData, 0, 0);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    source.start();
  },

  startVisualizer() {
    const canvas = document.getElementById("audio-waveform-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isAudioActive) return;

      animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgb(200, 200, 200)"; // White/gray bars

      // Draw mirrored vertical bars from center (like waveform)
      const barWidth = Math.max(2, canvas.width / bufferLength);
      const centerY = canvas.height / 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (canvas.height / 2);

        // Draw bar going UP from center
        ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight);

        // Draw bar going DOWN from center (mirror)
        ctx.fillRect(x, centerY, barWidth - 1, barHeight);

        x += barWidth;
      }
    };
    draw();
  },

  startVolumeMonitor() {
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const updateVolume = () => {
      if (!isAudioActive) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const volume = (avg / 255) * 100;

      // Update volume bar
      const volumeBar = document.getElementById("audio-volume-bar");
      if (volumeBar) {
        volumeBar.style.width = volume.toFixed(0) + "%";
      }

      // Update frequency display
      const freqEl = document.getElementById("audio-freq");
      if (freqEl) {
        const maxFreq = 8000; // Display max 8kHz
        freqEl.textContent = (maxFreq * (avg / 255)).toFixed(0) + " Hz";
      }

      requestAnimationFrame(updateVolume);
    };
    updateVolume();
  },

  startRecording() {
    if (!isAudioActive)
      return UIManager.showToast("Hãy bật Audio trước!", "error");

    const durationInput = document.getElementById("audio-record-duration");
    const duration = Math.min(
      60,
      parseInt(durationInput ? durationInput.value : 10, 10) || 10
    );

    const recordBtn = document.getElementById("btn-audio-record");
    const cancelBtn = document.getElementById("btn-audio-cancel");
    if (recordBtn) recordBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = false;
    if (durationInput) durationInput.disabled = true;

    // Update status to RECORDING
    const statusBadge = document.getElementById("audio-status");
    if (statusBadge) {
      statusBadge.className = "badge bg-danger";
      statusBadge.textContent = "RECORDING";
    }

    this.startRecordingTimer(duration);
    SocketService.send("RECORD_AUDIO", duration);
    UIManager.showToast(`Đang ghi âm ${duration}s...`, "info");
  },

  cancelRecording() {
    this.stopRecordingTimer();
    SocketService.send("CANCEL_RECORD");
    UIManager.showToast("Đã hủy ghi âm", "info");
  },

  handleAudioDownload(data) {
    const payload = data.payload || data;
    if (!payload) return;

    // 1. Chuyển đổi base64 sang blob
    const binaryString = window.atob(payload);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob); // Tạo URL cho file âm thanh

    const time = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    let fileName = `Audio_Rec_${time}.wav`;

    // 2. Cập nhật giao diện: Hiện Play + Download (icon-only), inline Rename trên tên, X ở góc phải
    const recent = document.getElementById("audio-recent");
    if (recent) {
      const item = document.createElement("div");
      item.className =
        "d-flex align-items-center justify-content-between mb-2 position-relative audio-item";
      item.style.cssText = "padding: 6px 8px;";
      item.dataset.url = url;
      item.dataset.name = fileName;

      const left = document.createElement("div");
      left.className =
        "text-truncate me-2 flex-grow-1 d-flex align-items-center";
      const nameSpan = document.createElement("span");
      nameSpan.className = "audio-file-name";
      // Tách tên file và .wav
      const baseName = fileName.replace(/\.wav$/i, "");
      nameSpan.textContent = baseName;
      nameSpan.style.cssText =
        "white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
      const wavLabel = document.createElement("span");
      wavLabel.style.cssText =
        "display: inline-block; background: #e0e0e0; color: #666; font-size: 12px; padding: 2px 6px; margin-left: 6px; border-radius: 3px; white-space: nowrap; flex-shrink: 0;";
      wavLabel.textContent = ".wav";

      const fileIcon = document.createElement("i");
      fileIcon.className = "fas fa-file-audio me-2";
      left.appendChild(fileIcon);
      left.appendChild(nameSpan);
      left.appendChild(wavLabel);

      const right = document.createElement("div");
      right.className = "d-flex gap-2 align-items-center";
      right.style.cssText = "margin-top: 2px; margin-left: 0;";
      // Play (icon-only)
      const playBtn = document.createElement("button");
      playBtn.className = "btn btn-sm btn-outline-success";
      playBtn.innerHTML = `<i class=\"fas fa-play\"></i>`;
      playBtn.title = "Play";
      playBtn.style.width = "24px";
      playBtn.style.height = "24px";
      playBtn.style.padding = "0";
      playBtn.style.fontSize = "12px";
      playBtn.onclick = () => {
        const container = document.getElementById("audio-preview-container");
        if (!container) return;
        const existing = container.querySelector("audio");
        // Toggle stop if this item is currently playing
        if (currentPreviewItem === item && existing) {
          try {
            existing.pause();
          } catch {}
          container.innerHTML = "";
          if (currentPreviewButton)
            currentPreviewButton.innerHTML = `<i class=\"fas fa-play\"></i>`;
          currentPreviewItem = null;
          currentPreviewButton = null;
          return;
        }
        // Stop any previous
        if (existing) {
          try {
            existing.pause();
          } catch {}
          container.innerHTML = "";
          if (currentPreviewButton)
            currentPreviewButton.innerHTML = `<i class=\"fas fa-play\"></i>`;
        }
        const audioEl = document.createElement("audio");
        audioEl.src = item.dataset.url;
        audioEl.controls = true;
        audioEl.style.width = "100%";
        audioEl.style.marginTop = "10px";
        container.appendChild(audioEl);
        audioEl.play();
        currentPreviewItem = item;
        currentPreviewButton = playBtn;
        playBtn.innerHTML = `<i class=\"fas fa-stop\"></i>`;
      };

      // Download (icon-only)
      const dlBtn = document.createElement("button");
      dlBtn.className = "btn btn-sm btn-outline-primary";
      dlBtn.innerHTML = `<i class=\"fas fa-download\"></i>`;
      dlBtn.title = "Download";
      dlBtn.style.width = "24px";
      dlBtn.style.height = "24px";
      dlBtn.style.padding = "0";
      dlBtn.style.fontSize = "12px";
      dlBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = item.dataset.url;
        a.download = item.dataset.name || fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 50);
        UIManager.showToast(`Đang tải xuống ${a.download}`, "info");
        // Thông báo server về việc tải xuống
        SocketService.send("AUDIO_DOWNLOADED", a.download);
      };

      // Delete (trash icon, red, same row as play/download)
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-sm btn-outline-danger";
      delBtn.innerHTML = `<i class=\"fas fa-trash\"></i>`;
      delBtn.title = "Delete";
      delBtn.style.width = "24px";
      delBtn.style.height = "24px";
      delBtn.style.padding = "0";
      delBtn.onclick = () => {
        const u = item.dataset.url;
        // Nếu item đang được play, dừng và clear preview
        if (currentPreviewItem === item) {
          const container = document.getElementById("audio-preview-container");
          if (container) container.innerHTML = "";
          if (currentPreviewButton)
            currentPreviewButton.innerHTML = `<i class=\"fas fa-play\"></i>`;
          currentPreviewItem = null;
          currentPreviewButton = null;
        }
        item.remove();
        try {
          URL.revokeObjectURL(u);
        } catch {}
        if (!recent.children.length) {
          recent.innerHTML = `<p class=\"text-xs text-secondary font-italic mb-0\">No recordings yet</p>`;
        }
      };

      // Inline rename: click on name to open input (chỉ đổi tên, không .wav)
      nameSpan.style.cursor = "text";
      nameSpan.title = "Click để đổi tên";
      nameSpan.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentName = baseName;
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentName;
        input.style.cssText =
          "width: 120px; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;";

        const parent = nameSpan.parentElement;
        parent.replaceChild(input, nameSpan);
        input.focus();
        input.select();

        const saveRename = () => {
          let newName = input.value.trim();
          if (!newName) newName = currentName;
          // Loại bỏ ký tự không hợp lệ trong tên file
          newName = newName.replace(/[\\/:*?\"<>|.]/g, "-");
          // Cập nhật item.dataset.name với .wav
          const fullName = newName + ".wav";
          item.dataset.name = fullName;
          nameSpan.textContent = newName;
          parent.replaceChild(nameSpan, input);
          UIManager.showToast("Đã đổi tên file", "info");
        };

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveRename();
          } else if (e.key === "Escape") {
            e.preventDefault();
            parent.replaceChild(nameSpan, input);
          }
        });
        input.addEventListener("blur", saveRename);
      });

      right.appendChild(playBtn);
      right.appendChild(dlBtn);
      right.appendChild(delBtn);

      item.appendChild(left);
      item.appendChild(right);

      if (recent.querySelector("p")) recent.innerHTML = "";
      recent.prepend(item);
    }

    // 3. Không tự động tải xuống nữa; hiển thị trong Recent để người dùng thao tác
    // Không hiển thị toast tự động

    // 4. Reset trạng thái các nút
    const durationInput = document.getElementById("audio-record-duration");
    const recordBtn = document.getElementById("btn-audio-record");
    const cancelBtn = document.getElementById("btn-audio-cancel");

    if (durationInput) durationInput.disabled = false;

    // Kiểm tra an toàn biến global
    if (typeof isAudioActive !== "undefined" && isAudioActive && recordBtn) {
      recordBtn.disabled = false;
    } else if (recordBtn) {
      recordBtn.disabled = false;
    }

    if (cancelBtn) cancelBtn.disabled = true;
    this.stopRecordingTimer();
  },

  startRecordingTimer(durationSec) {
    const timerEl = document.getElementById("audio-recording-timer-container");
    const countdownEl = document.getElementById("audio-recording-countdown");
    remainingSeconds = durationSec;
    if (timerEl) {
      timerEl.classList.remove("d-none");
      timerEl.classList.add("d-flex");
    }
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
      if (remainingSeconds <= 0) this.stopRecordingTimer();
    }, 1000);
  },

  stopRecordingTimer(forceHide = false) {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    const timerEl = document.getElementById("audio-recording-timer-container");
    if (timerEl) {
      timerEl.classList.add("d-none");
      timerEl.classList.remove("d-flex");
    }
    remainingSeconds = 0;

    // Reset status back to LIVE
    if (!forceHide && isAudioActive) {
      const statusBadge = document.getElementById("audio-status");
      if (statusBadge) {
        statusBadge.className = "badge bg-success";
        statusBadge.textContent = "LIVE";
      }
    }

    const durationInput = document.getElementById("audio-record-duration");
    const recordBtn = document.getElementById("btn-audio-record");
    const cancelBtn = document.getElementById("btn-audio-cancel");
    if (durationInput) durationInput.disabled = false;
    if (!forceHide && isAudioActive && recordBtn) recordBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = true;
  },

  // Countdown beep sound (giống webcam và screen)
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
