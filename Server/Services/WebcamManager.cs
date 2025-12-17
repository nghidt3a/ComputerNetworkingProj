using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using OpenCvSharp;
using NAudio.Wave;

namespace RemoteControlServer.Services
{
    /// <summary>
    /// WebcamManager provides webcam capture, streaming, and recording.
    /// </summary>
    public static class WebcamManager
    {
        private static VideoCapture _capture;
        private static bool _isStreaming = false;
        private static VideoWriter _writer;
        private static bool _isRecording = false;
        private static Thread _cameraThread;
        private static WaveInEvent _micSource;
        
        // Biến lưu thông tin ghi hình
        private static DateTime _stopRecordTime;
        private static string _currentSavePath;

        // Âm thanh kèm webcam
        private const int AudioSampleRate = 16000; // Hz
        private const int AudioChannels = 1;       // Mono
        private const int AudioBits = 16;          // 16-bit PCM
        private const int AudioBufferMs = 80;      // Chunk ~80ms để giảm độ trễ

        /// <summary>Fires with JPEG bytes for live feed frames.</summary>
        public static event Action<byte[]> OnFrameCaptured;
        /// <summary>Fires with PCM bytes for live audio chunks.</summary>
        public static event Action<byte[]> OnAudioCaptured;
        /// <summary>Fires when a recorded video file is saved.</summary>
        public static event Action<string> OnVideoSaved; 

        /// <summary>Begin capturing frames from the default webcam and route frames to <see cref="OnFrameCaptured"/>.</summary>
        public static void StartWebcam()
        {
            if (_isStreaming) return;
            _isStreaming = true;
            _cameraThread = new Thread(CameraLoop) { IsBackground = true };
            _cameraThread.Start();

            // Bắt đầu ghi âm (stream kèm audio)
            StartMicCapture();
        }

        /// <summary>Stop webcam capture and release resources.</summary>
        public static void StopWebcam()
        {
            _isStreaming = false;
            _isRecording = false;
            Thread.Sleep(500); 

            _capture?.Release();
            _capture = null;
            _writer?.Release();
            _writer = null;

            StopMicCapture();
        }

        private static bool _includeAudio = false;

        /// <summary>Start recording a video for a given duration (seconds). Returns a status message.</summary>
        public static string StartRecording(int durationSeconds, bool includeAudio = false)
        {
            if (!_isStreaming) return "Lỗi: Hãy bật Webcam trước!";
            if (_isRecording) return "Đang ghi hình rồi!";

            try
            {
                _includeAudio = includeAudio;
                
                // 1. Lưu vào thư mục Temp với extension .mp4 nếu có audio, .avi nếu không
                string tempFolder = Path.GetTempPath();
                string extension = includeAudio ? ".mp4" : ".avi";
                string fileName = $"Rec_{DateTime.Now:HHmmss}{extension}";
                _currentSavePath = Path.Combine(tempFolder, fileName);

                // 2. Start VideoRecorder for frame/audio capture
                VideoRecorder.StartRecording(includeAudio);

                // 3. Thiết lập thời gian dừng
                _stopRecordTime = DateTime.Now.AddSeconds(durationSeconds);
                _isRecording = true;

                string mode = includeAudio ? "video + audio" : "video only";
                return $"Server đang ghi {mode}... ({durationSeconds}s)";
            }
            catch (Exception ex)
            {
                return "Lỗi StartRecord: " + ex.Message;
            }
        }

        /// <summary>Stop recording and raise the <see cref="OnVideoSaved"/> event when file completes.</summary>
        private static async void StopRecording()
        {
            if (!_isRecording) return;
            _isRecording = false;
            
            // Đợi một chút để ghi nốt frame cuối
            Thread.Sleep(200);

            if (_includeAudio)
            {
                // Use VideoRecorder to encode with FFmpeg
                Console.WriteLine($"🎬 Encoding video with FFmpeg...");
                var finalPath = await VideoRecorder.StopRecordingAndEncode(_currentSavePath);
                
                if (!string.IsNullOrEmpty(finalPath) && File.Exists(finalPath))
                {
                    Console.WriteLine($"✅ Video file ready: {finalPath}");
                    OnVideoSaved?.Invoke(finalPath);
                }
                else
                {
                    Console.WriteLine($"❌ Video encoding failed");
                }
            }
            else
            {
                // Old AVI method (no audio)
                if (_writer != null)
                {
                    _writer.Release();
                    _writer = null;
                    
                    Console.WriteLine($">> Đã tạo file: {_currentSavePath}");
                    OnVideoSaved?.Invoke(_currentSavePath);
                }
            }
        }

        private static void StartMicCapture()
        {
            try
            {
                _micSource = new WaveInEvent
                {
                    WaveFormat = new WaveFormat(AudioSampleRate, AudioBits, AudioChannels),
                    BufferMilliseconds = AudioBufferMs
                };

                _micSource.DataAvailable += (s, e) =>
                {
                    if (!_isStreaming || e.BytesRecorded <= 0) return;

                    var chunk = new byte[e.BytesRecorded];
                    Buffer.BlockCopy(e.Buffer, 0, chunk, 0, e.BytesRecorded);
                    
                    // Stream audio to client
                    OnAudioCaptured?.Invoke(chunk);
                    
                    // Save audio to VideoRecorder if recording with audio
                    if (_isRecording && _includeAudio)
                    {
                        VideoRecorder.WriteAudioChunk(chunk);
                    }
                };

                _micSource.StartRecording();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Lỗi mic capture: {ex.Message}");
            }
        }

        private static void StopMicCapture()
        {
            try
            {
                if (_micSource != null)
                {
                    _micSource.StopRecording();
                    _micSource.Dispose();
                    _micSource = null;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Lỗi dừng mic: {ex.Message}");
            }
        }

        /// <summary>Main loop capturing frames from the webcam and emitting live frames/events.</summary>
        // Server/Services/WebcamManager.cs
        private static void CameraLoop()
        {
            try 
            {
                // Mở Camera (Ưu tiên DSHOW cho Windows)
                _capture = new VideoCapture(0, VideoCaptureAPIs.DSHOW);
                if (!_capture.IsOpened()) _capture = new VideoCapture(0);

                if (!_capture.IsOpened())
                {
                    _isStreaming = false;
                    return;
                }

                Mat frame = new Mat();

                // --- CẤU HÌNH GHI HÌNH ĐỒNG BỘ ---
                int targetFps = 15; // Webcam thường hỗ trợ tốt ở 15-30 FPS. Chọn 15 để nhẹ file.
                long recordingStartTime = 0;
                int framesWritten = 0;

                while (_isStreaming)
                {
                    _capture.Read(frame);
                    if (!frame.Empty())
                    {
                        // --- PHẦN GHI HÌNH THÔNG MINH (AUTO SYNC) ---
                        if (_isRecording)
                        {
                            if (_includeAudio)
                            {
                                // New method: save frames as JPEG for FFmpeg
                                var jpegBytes = frame.ImEncode(".jpg", new int[] { (int)ImwriteFlags.JpegQuality, 90 });
                                VideoRecorder.SaveFrame(jpegBytes);
                            }
                            else
                            {
                                // Old method: write to AVI directly
                                if (_writer == null || !_writer.IsOpened())
                                {
                                    // Khởi tạo Writer với FPS cố định là targetFps (15)
                                    _writer = new VideoWriter(_currentSavePath, FourCC.MJPG, targetFps, new OpenCvSharp.Size(frame.Width, frame.Height));
                                    
                                    // Đánh dấu mốc thời gian bắt đầu
                                    recordingStartTime = DateTime.Now.Ticks;
                                    framesWritten = 0;
                                }

                                if (_writer.IsOpened())
                                {
                                    // Tính toán số frame cần thiết dựa trên thời gian thực đã trôi qua
                                    double elapsedSeconds = (DateTime.Now.Ticks - recordingStartTime) / 10000000.0;
                                    int expectedFrames = (int)(elapsedSeconds * targetFps);

                                    // Vòng lặp bù frame:
                                    while (framesWritten <= expectedFrames)
                                    {
                                        _writer.Write(frame);
                                        framesWritten++;
                                    }
                                }
                            }

                            // Kiểm tra thời gian dừng
                            if (DateTime.Now >= _stopRecordTime) StopRecording();
                        }
                        // ------------------------------------------------

                        // --- PHẦN STREAM (Gửi ảnh xem live) ---
                        if (OnFrameCaptured != null)
                        {
                            // Nén ảnh JPEG để gửi qua mạng (giảm chất lượng xuống 50 để mượt hơn)
                            var bytes = frame.ImEncode(".jpg", new int[] { (int)ImwriteFlags.JpegQuality, 50 });
                            OnFrameCaptured.Invoke(bytes);
                        }
                    }
                    else
                    {
                        Thread.Sleep(10);
                    }
                    
                    // Delay nhỏ để giảm tải CPU, không ảnh hưởng tới thời gian video vì đã có thuật toán bù ở trên
                    Thread.Sleep(10); 
                }
            }
            catch { _isStreaming = false; }
        }
    }
}