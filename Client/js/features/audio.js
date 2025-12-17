import { SocketService } from "../services/socket.js";
import { UIManager } from "../utils/ui.js";

let isAudioActive = false;
let recordingInterval = null;
let remainingSeconds = 0;

// Live audio streaming
let audioCtx = null;
let analyser = null;
let animationId = null;
let audioBuffer = new Uint8Array(2048);
let nextAudioTime = 0;

export const AudioFeature = {
  init() {
    // Listen for live audio chunks (header 0x04)
    SocketService.on("BINARY_STREAM", this.handleLiveAudio.bind(this));
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

    const view = new DataView(arrayBuffer);
    const header = view.getUint8(0);
    if (header !== 0x04) return; // Only handle audio (0x04)

    const pcmData = arrayBuffer.slice(1);
    this.playAudioChunk(pcmData);
  },

  startLiveAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.connect(audioCtx.destination);
      nextAudioTime = 0;
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

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
    nextAudioTime = 0;

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

    const samples = new Int16Array(pcmBuffer);
    const floatData = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      floatData[i] = samples[i] / 32768;
    }

    const buffer = audioCtx.createBuffer(1, floatData.length, 16000);
    buffer.copyToChannel(floatData, 0, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);

    const startAt = Math.max(
      audioCtx.currentTime + 0.02,
      nextAudioTime || audioCtx.currentTime
    );
    source.start(startAt);
    nextAudioTime = startAt + buffer.duration;
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
    const duration = Math.max(
      3,
      Math.min(60, parseInt(durationInput ? durationInput.value : 10, 10) || 10)
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
    const fileName = `Audio_Rec_${time}.wav`;

    // 2. Cập nhật giao diện: Chỉ hiện nút Play
    const recent = document.getElementById("audio-recent");
    if (recent) {
      const item = document.createElement("div");
      item.className = "d-flex align-items-center justify-content-between mb-2";

      // Giao diện chỉ có Tên file + Nút Play (Không có nút Download ở đây)
      item.innerHTML = `
        <div class="text-truncate me-2">
            <i class="fas fa-file-audio me-2"></i>${fileName}
        </div>
        <div>
            <button class="btn btn-sm btn-outline-success" onclick="(function(u){
                const container = document.getElementById('audio-preview-container');
                container.innerHTML = ''; 
                
                const audio = document.createElement('audio');
                audio.src = u;
                audio.controls = true;
                audio.style.width = '100%';
                audio.style.marginTop = '10px';
                
                container.appendChild(audio);
                audio.play();
            })('${url}')">
                <i class="fas fa-play me-1"></i> Play
            </button>
        </div>`;

      if (recent.querySelector("p")) recent.innerHTML = "";
      recent.prepend(item);
    }

    // 3. TỰ ĐỘNG TẢI XUỐNG (Đã thêm lại phần này)
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // LƯU Ý QUAN TRỌNG:
    // Mình đã xóa dòng URL.revokeObjectURL(url) ở đây.
    // Điều này giúp file vẫn tồn tại trong bộ nhớ trình duyệt để nút Play hoạt động.
    setTimeout(() => {
      document.body.removeChild(a);
      // Không revoke URL ở đây nữa!
    }, 100);

    UIManager.showToast("Đã lưu file & sẵn sàng phát!", "success");

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
};
