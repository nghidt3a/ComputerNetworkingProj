using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using OpenCvSharp; // Cần thư viện này (đã có trong .csproj)
using RemoteControlServer.Helpers;

namespace RemoteControlServer.Core
{
    public static class StreamManager
    {
        private static bool _isStreaming = false;
        private static byte[] _lastFrame = null;

        // --- Variables cho Recording ---
        private static bool _isRecording = false;
        private static VideoWriter _writer;
        private static string _currentSavePath;
        private static DateTime _stopRecordTime;
        
        // Sự kiện báo khi file video đã lưu xong
        public static event Action<string> OnScreenVideoSaved;

        public static bool IsStreaming => _isStreaming;

        public static void StartStreaming()
        {
            _isStreaming = true;
        }

        public static void StopStreaming()
        {
            _isStreaming = false;
            // Nếu đang ghi hình mà tắt stream thì dừng ghi luôn
            if (_isRecording) StopRecording();
        }

        // --- Hàm Start Recording ---
        public static string StartRecording(int durationSeconds)
        {
            if (!_isStreaming) return "Lỗi: Hãy bật Stream màn hình trước!";
            if (_isRecording) return "Đang ghi hình rồi!";

            try
            {
                string tempFolder = Path.GetTempPath();
                string fileName = $"ScreenRec_{DateTime.Now:HHmmss}.avi";
                _currentSavePath = Path.Combine(tempFolder, fileName);

                // Thêm 200ms buffer để đảm bảo ghi đủ frame cuối
                _stopRecordTime = DateTime.Now.AddSeconds(durationSeconds).AddMilliseconds(200);
                _isRecording = true;

                return $"Đang ghi màn hình... ({durationSeconds}s)";
            }
            catch (Exception ex)
            {
                return "Lỗi StartRecord: " + ex.Message;
            }
        }

        // --- Hàm Stop Recording ---
        private static void StopRecording()
        {
            if (!_isRecording) return;
            _isRecording = false;
            Thread.Sleep(200); // Đợi ghi nốt frame

            if (_writer != null)
            {
                _writer.Release();
                _writer = null;
                Console.WriteLine($">> Đã lưu video màn hình: {_currentSavePath}");
                
                // Bắn sự kiện để ServerCore gửi file
                OnScreenVideoSaved?.Invoke(_currentSavePath);
            }
        }

        // Server/Core/StreamManager.cs

        public static void StartScreenLoop()
        {
            Task.Run(() =>
            {
                // CẤU HÌNH TỐI ƯU: 15 FPS (Mượt hơn cho Remote)
                // Bạn KHÔNG CẦN chỉnh sửa số này nữa, thuật toán sẽ tự lo.
                int targetFps = 15;
                
                // Biến theo dõi thời gian ghi hình
                long recordingStartTime = 0;
                int framesWritten = 0;

                while (true)
                {
                    if (_isStreaming && SocketManager.All.Count > 0)
                    {
                        try
                        {
                            // 1. Chụp ảnh màn hình (90% quality cho hình ảnh đẹp hơn)
                            var currentFrame = SystemHelper.GetScreenShot(90L); 
                            
                            if (currentFrame != null)
                            {
                                // --- PHẦN GHI HÌNH THÔNG MINH (AUTO SYNC) ---
                                if (_isRecording)
                                {
                                    // Khởi tạo Writer nếu mới bắt đầu
                                    if (_writer == null || !_writer.IsOpened())
                                    {
                                        using (var tempMat = Cv2.ImDecode(currentFrame, ImreadModes.Color))
                                        {
                                            // Luôn set cứng 10 FPS
                                            _writer = new VideoWriter(_currentSavePath, FourCC.MJPG, targetFps, tempMat.Size());
                                        }
                                        
                                        // Đánh dấu mốc thời gian bắt đầu (tính bằng Ticks)
                                        recordingStartTime = DateTime.Now.Ticks;
                                        framesWritten = 0;
                                    }

                                    if (_writer.IsOpened())
                                    {
                                        // THUẬT TOÁN BÙ FRAME:
                                        // Tính xem tại giây thứ X thì video cần có bao nhiêu frame
                                        double elapsedSeconds = (DateTime.Now.Ticks - recordingStartTime) / 10000000.0;
                                        int expectedFrames = (int)(elapsedSeconds * targetFps);

                                        using (var mat = Cv2.ImDecode(currentFrame, ImreadModes.Color))
                                        {
                                            // Vòng lặp này sẽ tự động:
                                            // - Nếu máy nhanh: Không chạy (chờ frame sau)
                                            // - Nếu máy chậm: Chạy nhiều lần (ghi lặp lại frame cũ để bù thời gian)
                                            while (framesWritten <= expectedFrames)
                                            {
                                                _writer.Write(mat);
                                                framesWritten++;
                                            }
                                        }
                                    }

                                    // Kiểm tra thời gian dừng (dùng > thay vì >= để ghi đủ frame cuối)
                                    if (DateTime.Now > _stopRecordTime) StopRecording();
                                }
                                // ------------------------------------------------

                                // --- PHẦN GỬI STREAM (Giữ nguyên) ---
                                bool isDuplicate = _lastFrame != null && currentFrame.Length == _lastFrame.Length && currentFrame.SequenceEqual(_lastFrame);
                                if (!isDuplicate)
                                {
                                    _lastFrame = currentFrame;
                                    SocketManager.BroadcastBinary(0x01, currentFrame);
                                }
                            }
                        }
                        catch (Exception ex) { Console.WriteLine("Lỗi Loop: " + ex.Message); }

                        // Delay 50ms cho 15-20 FPS (cân bằng giữa mượt và tải CPU)
                        // Không cần chỉnh số này để khớp thời gian nữa, thuật toán ở trên đã lo rồi
                        Thread.Sleep(50);
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