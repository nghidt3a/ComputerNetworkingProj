# Hướng dẫn cài đặt FFmpeg và tích hợp Audio vào Webcam Recording

## 1. Cài đặt FFmpeg

### Windows:

1. Tải FFmpeg từ: https://github.com/BtbN/FFmpeg-Builds/releases
   - Download file `ffmpeg-master-latest-win64-gpl.zip`
2. Giải nén và copy `ffmpeg.exe` vào một trong hai vị trí:

   - **Option A**: Đặt vào thư mục `Server/bin/Debug/net8.0-windows/` (cùng thư mục với Server.exe)
   - **Option B**: Thêm vào System PATH
     - Giải nén vào `C:\ffmpeg\bin`
     - Thêm `C:\ffmpeg\bin` vào Environment Variables → System Variables → Path

3. Kiểm tra cài đặt:

```bash
ffmpeg -version
```

## 2. Cài đặt NuGet Package

Mở terminal trong thư mục Server và chạy:

```bash
dotnet add package NAudio --version 2.2.1
```

## 3. Tạo VideoRecorder Service

Tạo file mới: `Server/Services/VideoRecorder.cs`

```csharp
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using NAudio.Wave;

namespace RemoteControlServer.Services
{
    public static class VideoRecorder
    {
        private static Process _ffmpegProcess;
        private static WaveInEvent _audioCapture;
        private static string _tempVideoPath;
        private static string _tempAudioPath;
        private static string _outputPath;
        private static bool _isRecording;

        public static void StartRecording(string videoFramesFolder, string outputFile, bool includeAudio = false)
        {
            if (_isRecording) return;

            _isRecording = true;
            _tempVideoPath = videoFramesFolder;
            _outputPath = outputFile;

            if (includeAudio)
            {
                _tempAudioPath = Path.Combine(Path.GetTempPath(), $"audio_{Guid.NewGuid()}.wav");
                StartAudioCapture();
            }
        }

        private static void StartAudioCapture()
        {
            _audioCapture = new WaveInEvent
            {
                WaveFormat = new WaveFormat(44100, 16, 1),
                BufferMilliseconds = 50
            };

            var writer = new WaveFileWriter(_tempAudioPath, _audioCapture.WaveFormat);

            _audioCapture.DataAvailable += (s, e) =>
            {
                writer.Write(e.Buffer, 0, e.BytesRecorded);
            };

            _audioCapture.RecordingStopped += (s, e) =>
            {
                writer?.Dispose();
            };

            _audioCapture.StartRecording();
            Console.WriteLine($"🎤 Audio recording started: {_tempAudioPath}");
        }

        public static async Task StopRecordingAndEncode()
        {
            if (!_isRecording) return;

            _isRecording = false;

            // Stop audio capture
            if (_audioCapture != null)
            {
                _audioCapture.StopRecording();
                _audioCapture.Dispose();
                _audioCapture = null;
                await Task.Delay(500); // Wait for file to flush
            }

            // Encode video with FFmpeg
            await EncodeVideo();

            // Cleanup temp files
            if (File.Exists(_tempAudioPath))
            {
                try { File.Delete(_tempAudioPath); } catch { }
            }
        }

        private static async Task EncodeVideo()
        {
            var inputPattern = Path.Combine(_tempVideoPath, "frame_%04d.jpg");
            var hasAudio = _audioCapture != null && File.Exists(_tempAudioPath);

            // Build FFmpeg command
            string ffmpegArgs;
            if (hasAudio)
            {
                // Video + Audio
                ffmpegArgs = $"-framerate 15 -i \"{inputPattern}\" -i \"{_tempAudioPath}\" " +
                             $"-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p " +
                             $"-c:a aac -b:a 128k -shortest -y \"{_outputPath}\"";
            }
            else
            {
                // Video only
                ffmpegArgs = $"-framerate 15 -i \"{inputPattern}\" " +
                             $"-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p " +
                             $"-y \"{_outputPath}\"";
            }

            Console.WriteLine($"🎬 FFmpeg encoding: {ffmpegArgs}");

            _ffmpegProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffmpeg",
                    Arguments = ffmpegArgs,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };

            _ffmpegProcess.Start();
            await _ffmpegProcess.WaitForExitAsync();

            if (_ffmpegProcess.ExitCode == 0)
            {
                Console.WriteLine($"✅ Video encoded successfully: {_outputPath}");
            }
            else
            {
                var error = await _ffmpegProcess.StandardError.ReadToEndAsync();
                Console.WriteLine($"❌ FFmpeg error: {error}");
            }

            _ffmpegProcess.Dispose();
            _ffmpegProcess = null;
        }
    }
}
```

## 4. Modify WebcamManager.cs

Cập nhật `Server/Services/WebcamManager.cs` để lưu frames vào thư mục tạm:

```csharp
// Thêm vào đầu class
private static string _recordingFramesFolder;
private static int _frameCounter;

// Trong StartRecording():
_recordingFramesFolder = Path.Combine(Path.GetTempPath(), $"webcam_rec_{Guid.NewGuid()}");
Directory.CreateDirectory(_recordingFramesFolder);
_frameCounter = 0;

_recordTimer = new System.Timers.Timer(66); // ~15 fps
_recordTimer.Elapsed += async (s, e) =>
{
    if (_currentFrame != null)
    {
        var framePath = Path.Combine(_recordingFramesFolder, $"frame_{_frameCounter:D4}.jpg");
        await File.WriteAllBytesAsync(framePath, _currentFrame);
        _frameCounter++;
    }
};
```

## 5. Modify CommandRouter.cs

Cập nhật xử lý lệnh `RECORD_WEBCAM`:

```csharp
case "RECORD_WEBCAM":
    try
    {
        var recordData = JsonConvert.DeserializeObject<dynamic>(packet.param);
        int duration = (int)(recordData.duration ?? 10);
        bool includeAudio = (bool)(recordData.audio ?? false);

        string msg = WebcamManager.StartRecording(duration, includeAudio);
        SocketManager.SendJson(socket, "LOG", msg);
    }
    catch
    {
        // Fallback nếu param là số thuần
        int.TryParse(packet.param, out int dur);
        string msg = WebcamManager.StartRecording(dur > 0 ? dur : 10, false);
        SocketManager.SendJson(socket, "LOG", msg);
    }
    break;
```

## 6. Rebuild và Test

```bash
cd Server
dotnet build
dotnet run
```

### Test Flow:

1. Bật Webcam trong client
2. Check "Record with Audio"
3. Nhập duration (ví dụ: 10s)
4. Click "RECORD & SAVE"
5. Chờ encode xong, file .mp4 sẽ tự tải về

## Troubleshooting

### Lỗi "ffmpeg not found":

- Kiểm tra ffmpeg.exe có trong PATH hoặc bin folder
- Chạy `where ffmpeg` trong CMD để verify

### File .mp4 không có audio:

- Kiểm tra microphone permission trong Windows Settings
- Verify \_tempAudioPath được tạo và có dung lượng > 0

### Video/Audio không sync:

- Điều chỉnh framerate trong FFmpeg args (mặc định 15 fps)
- Giảm BufferMilliseconds trong WaveInEvent

## Tối ưu

### Giảm kích thước file:

```bash
-crf 28  # Tăng compression (23 = good quality, 28 = smaller file)
```

### Tăng FPS:

```csharp
_recordTimer = new System.Timers.Timer(33); // 30 fps
// FFmpeg: -framerate 30
```

### Chất lượng audio cao hơn:

```bash
-c:a aac -b:a 192k  # Tăng bitrate từ 128k lên 192k
```
