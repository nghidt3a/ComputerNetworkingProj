using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using OpenCvSharp;
using NAudio.Wave;
using RemoteControlServer.Helpers;
using RemoteControlServer.Services;

namespace RemoteControlServer.Core
{
    public static class StreamManager
    {
        private static bool _isStreaming = false;
        private static byte[] _lastFrame = null;

        // --- Variables cho Recording ---
        private static bool _isRecording = false;
        private static string _currentSavePath;
        private static DateTime _stopRecordTime;
        private static bool _includeAudio = false;
        
        // Frame timing để sync với audio
        private static long _recordingStartTicks;
        private static int _targetFps = 24;  // Khớp với FFmpeg input framerate
        private static int _framesRecorded = 0;
        
        // Temp folders for FFmpeg
        private static string _tempFramesFolder;
        private static string _tempAudioPath;
        private static WaveFileWriter _audioWriter;
        private static WaveInEvent _audioCapture;
        
        // Live audio streaming flag (audio được handle bởi AudioManager)
        private static bool _isAudioStreaming = false;
        
        // Sự kiện báo khi file video đã lưu xong
        public static event Action<string> OnScreenVideoSaved;

        public static bool IsStreaming => _isStreaming;
        public static bool IsAudioStreaming => _isAudioStreaming;

        public static void StartStreaming()
        {
            _isStreaming = true;
            // Tự động bật audio streaming kèm video - dùng AudioManager (đã có sẵn)
            AudioManager.StartStreaming();
            _isAudioStreaming = true;
        }

        public static void StopStreaming()
        {
            _isStreaming = false;
            // Nếu đang ghi hình mà tắt stream thì dừng ghi luôn
            if (_isRecording) StopRecording();
            // Stop audio streaming
            AudioManager.StopStreaming();
            _isAudioStreaming = false;
        }
        
        /// <summary>Start live audio streaming to client (dùng AudioManager)</summary>
        public static void StartAudioStreaming()
        {
            if (_isAudioStreaming) return;
            AudioManager.StartStreaming();
            _isAudioStreaming = true;
            Console.WriteLine("🔊 Screen audio streaming started (via AudioManager)");
        }
        
        /// <summary>Stop live audio streaming</summary>
        public static void StopAudioStreaming()
        {
            if (!_isAudioStreaming) return;
            AudioManager.StopStreaming();
            _isAudioStreaming = false;
            Console.WriteLine("🔇 Screen audio streaming stopped");
        }

        // --- Hàm Start Recording ---
        public static string StartRecording(int durationSeconds, bool includeAudio = false)
        {
            if (!_isStreaming) return "Lỗi: Hãy bật Stream màn hình trước!";
            if (_isRecording) return "Đang ghi hình rồi!";

            try
            {
                _includeAudio = includeAudio;
                
                // 1. Tạo output path với extension .webm
                string tempFolder = Path.GetTempPath();
                string fileName = $"ScreenRec_{DateTime.Now:HHmmss}.webm";
                _currentSavePath = Path.Combine(tempFolder, fileName);

                // 2. Tạo temp folder cho frames
                _tempFramesFolder = Path.Combine(Path.GetTempPath(), $"screen_{Guid.NewGuid()}");
                Directory.CreateDirectory(_tempFramesFolder);
                Console.WriteLine($"📁 Screen frames folder: {_tempFramesFolder}");
                
                // 3. Thiết lập audio nếu cần
                _tempAudioPath = null;
                if (includeAudio)
                {
                    _tempAudioPath = Path.Combine(Path.GetTempPath(), $"screen_audio_{Guid.NewGuid()}.wav");
                    var waveFormat = new WaveFormat(44100, 16, 2); // 44.1kHz stereo
                    _audioWriter = new WaveFileWriter(_tempAudioPath, waveFormat);
                    
                    // Capture system audio via WASAPI loopback
                    try
                    {
                        _audioCapture = new WaveInEvent
                        {
                            WaveFormat = waveFormat,
                            BufferMilliseconds = 50
                        };
                        _audioCapture.DataAvailable += (s, e) =>
                        {
                            if (_isRecording && _audioWriter != null && e.BytesRecorded > 0)
                            {
                                try { _audioWriter.Write(e.Buffer, 0, e.BytesRecorded); }
                                catch { }
                            }
                        };
                        _audioCapture.StartRecording();
                        Console.WriteLine($"🎤 Screen audio file: {_tempAudioPath}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Audio capture failed: {ex.Message}");
                        _includeAudio = false;
                    }
                }

                // 4. Thiết lập thời gian và bắt đầu ghi
                _stopRecordTime = DateTime.Now.AddSeconds(durationSeconds);
                _recordingStartTicks = DateTime.Now.Ticks;
                _framesRecorded = 0;
                _isRecording = true;

                string mode = includeAudio ? "video + audio" : "video only";
                return $"Đang ghi màn hình {mode}... ({durationSeconds}s)";
            }
            catch (Exception ex)
            {
                return "Lỗi StartRecord: " + ex.Message;
            }
        }

        // --- Hàm Stop Recording ---
        private static async void StopRecording()
        {
            if (!_isRecording) return;
            _isRecording = false;
            
            // Stop audio capture
            if (_audioCapture != null)
            {
                try
                {
                    _audioCapture.StopRecording();
                    _audioCapture.Dispose();
                }
                catch { }
                _audioCapture = null;
            }
            
            // Close audio file
            if (_audioWriter != null)
            {
                try
                {
                    _audioWriter.Dispose();
                }
                catch { }
                _audioWriter = null;
                await Task.Delay(300); // Wait for file flush
            }

            Console.WriteLine($"🎬 Encoding screen video... Frames: {_framesRecorded}");

            // Encode with FFmpeg
            bool success = await EncodeWithFFmpeg(_currentSavePath, _includeAudio);
            
            // Cleanup temp files
            CleanupTempFiles();

            if (success && File.Exists(_currentSavePath))
            {
                Console.WriteLine($"✅ Screen video saved: {_currentSavePath}");
                OnScreenVideoSaved?.Invoke(_currentSavePath);
            }
            else
            {
                Console.WriteLine($"❌ Screen video encoding failed");
            }
        }
        
        private static async Task<bool> EncodeWithFFmpeg(string outputPath, bool includeAudio)
        {
            try
            {
                var inputPattern = Path.Combine(_tempFramesFolder, "frame_%04d.jpg");
                var hasAudio = includeAudio && !string.IsNullOrEmpty(_tempAudioPath) && File.Exists(_tempAudioPath);

                string ffmpegArgs;
                if (hasAudio)
                {
                    // Video + Audio -> WebM with VP9 + Opus
                    ffmpegArgs = $"-framerate {_targetFps} -i \"{inputPattern}\" -i \"{_tempAudioPath}\" " +
                                 $"-c:v libvpx-vp9 -crf 30 -b:v 0 -deadline realtime -cpu-used 4 " +
                                 $"-c:a libopus -b:a 128k -shortest -y \"{outputPath}\"";
                }
                else
                {
                    // Video only -> WebM with VP9
                    ffmpegArgs = $"-framerate {_targetFps} -i \"{inputPattern}\" " +
                                 $"-c:v libvpx-vp9 -crf 30 -b:v 0 -deadline realtime -cpu-used 4 " +
                                 $"-an -y \"{outputPath}\"";
                }

                Console.WriteLine($"🔧 FFmpeg screen: {ffmpegArgs.Substring(0, Math.Min(100, ffmpegArgs.Length))}...");

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "ffmpeg.exe",
                        Arguments = ffmpegArgs,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                    }
                };

                process.Start();
                var errorOutput = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0)
                {
                    Console.WriteLine($"✅ Screen video encoded: {outputPath} ({new FileInfo(outputPath).Length / 1024} KB)");
                    return true;
                }
                else
                {
                    Console.WriteLine($"❌ FFmpeg failed (exit code {process.ExitCode})");
                    Console.WriteLine($"Error: {errorOutput.Substring(0, Math.Min(500, errorOutput.Length))}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ FFmpeg exception: {ex.Message}");
                return false;
            }
        }
        
        private static void CleanupTempFiles()
        {
            try
            {
                if (!string.IsNullOrEmpty(_tempFramesFolder) && Directory.Exists(_tempFramesFolder))
                {
                    Directory.Delete(_tempFramesFolder, true);
                }
                if (!string.IsNullOrEmpty(_tempAudioPath) && File.Exists(_tempAudioPath))
                {
                    File.Delete(_tempAudioPath);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Cleanup error: {ex.Message}");
            }
        }
        
        /// <summary>Save a screen frame as JPEG for FFmpeg encoding</summary>
        private static void SaveScreenFrame(byte[] jpegBytes)
        {
            if (!_isRecording || jpegBytes == null || jpegBytes.Length == 0) return;

            try
            {
                var framePath = Path.Combine(_tempFramesFolder, $"frame_{_framesRecorded:D4}.jpg");
                File.WriteAllBytes(framePath, jpegBytes);
                _framesRecorded++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error saving screen frame: {ex.Message}");
            }
        }

        public static void StartScreenLoop()
        {
            Task.Run(() =>
            {
                // Tính toán interval giữa các frame (ticks)
                long ticksPerFrame = 10_000_000 / _targetFps;

                while (true)
                {
                    if (_isStreaming && SocketManager.All.Count > 0)
                    {
                        try
                        {
                            // 1. Chụp ảnh màn hình
                            var currentFrame = SystemHelper.GetScreenShot(90L); 
                            
                            if (currentFrame != null)
                            {
                                // --- PHẦN GHI HÌNH ĐỒNG BỘ VỚI AUDIO ---
                                if (_isRecording)
                                {
                                    // Tính số frame cần có dựa trên thời gian thực đã trôi qua
                                    long elapsedTicks = DateTime.Now.Ticks - _recordingStartTicks;
                                    int expectedFrames = (int)(elapsedTicks / ticksPerFrame);
                                    
                                    // Ghi đủ số frame để khớp với thời gian thực
                                    while (_framesRecorded < expectedFrames && currentFrame != null)
                                    {
                                        SaveScreenFrame(currentFrame);
                                    }

                                    // Kiểm tra thời gian dừng
                                    if (DateTime.Now >= _stopRecordTime) StopRecording();
                                }
                                // ------------------------------------------------

                                // --- PHẦN GỬI STREAM ---
                                bool isDuplicate = _lastFrame != null && currentFrame.Length == _lastFrame.Length && currentFrame.SequenceEqual(_lastFrame);
                                if (!isDuplicate)
                                {
                                    _lastFrame = currentFrame;
                                    SocketManager.BroadcastBinary(0x01, currentFrame);
                                }
                            }
                        }
                        catch (Exception ex) { Console.WriteLine("Lỗi Loop: " + ex.Message); }

                        Thread.Sleep(30); // ~30fps capture rate
                    }
                    else
                    {
                        Thread.Sleep(500);
                        _lastFrame = null;
                    }
                }
            });
        }
    }
}