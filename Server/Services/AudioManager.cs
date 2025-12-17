using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave; // Cần thư viện NAudio

namespace RemoteControlServer.Services
{
    public static class AudioManager
    {
        private static WaveInEvent _streamSource; // nguồn cho live streaming
        private static WaveInEvent _recSource;    // nguồn riêng cho recording
        private static WaveFileWriter _waveFile;
        private static string _currentFilePath;
        private static bool _isRecording = false;
        private static bool _isStreaming = false;

        // Sự kiện báo khi file âm thanh đã lưu xong
        public static event Action<string> OnAudioSaved;

        // Sự kiện phát audio chunks khi ghi âm (live stream)
        public static event Action<byte[]> OnAudioCaptured;

        public static void StartStreaming()
        {
            if (_isStreaming) return;
            _isStreaming = true;

            try
            {
                // Cấu hình WaveIn (16kHz, 16bit, Mono) cho streaming
                _streamSource = new WaveInEvent();
                _streamSource.WaveFormat = new WaveFormat(16000, 16, 1);
                _streamSource.BufferMilliseconds = 50; // Giảm buffer để streaming mượt hơn
                _streamSource.NumberOfBuffers = 3;

                _streamSource.DataAvailable += (s, e) =>
                {
                    if (e.BytesRecorded > 0)
                    {
                        byte[] chunk = new byte[e.BytesRecorded];
                        Array.Copy(e.Buffer, chunk, e.BytesRecorded);
                        OnAudioCaptured?.Invoke(chunk);
                    }
                };

                _streamSource.StartRecording();
                Console.WriteLine(">> Bắt đầu streaming âm thanh...");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Lỗi StartStreaming: " + ex.Message);
                _isStreaming = false;
            }
        }

        public static void StopStreaming()
        {
            if (!_isStreaming) return;
            _isStreaming = false;

            try
            {
                if (_streamSource != null)
                {
                    _streamSource.StopRecording();
                    _streamSource.Dispose();
                    _streamSource = null;
                }
                Console.WriteLine(">> Đã tắt streaming âm thanh...");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Lỗi StopStreaming: " + ex.Message);
            }
        }

        public static string StartRecording(int seconds)
        {
            if (_isRecording) return "Đang ghi âm rồi!";

            try
            {
                _isRecording = true;
                string tempFolder = Path.GetTempPath();
                string fileName = $"AudioRec_{DateTime.Now:HHmmss}.wav";
                _currentFilePath = Path.Combine(tempFolder, fileName);

                // Cấu hình nguồn ghi riêng, đồng bộ với streaming (16kHz, 16bit, Mono)
                _recSource = new WaveInEvent();
                _recSource.WaveFormat = new WaveFormat(16000, 16, 1);
                // Giữ cấu hình buffer giống streaming để chunk đều và mượt
                _recSource.BufferMilliseconds = 50;
                _recSource.NumberOfBuffers = 3;

                _waveFile = new WaveFileWriter(_currentFilePath, _recSource.WaveFormat);

                _recSource.DataAvailable += (s, e) =>
                {
                    if (_waveFile != null)
                    {
                        _waveFile.Write(e.Buffer, 0, e.BytesRecorded);
                        // Không flush mỗi chunk để tránh I/O chặn làm rè live
                    }
                    // Không broadcast từ nguồn ghi để tránh trùng với nguồn streaming
                };

                _recSource.RecordingStopped += (s, e) =>
                {
                    DisposeRecordingResources();
                    Console.WriteLine($">> Đã lưu file ghi âm: {_currentFilePath}");
                    OnAudioSaved?.Invoke(_currentFilePath);
                };

                _recSource.StartRecording();

                // Hẹn giờ tắt (thêm 100ms buffer để đảm bảo ghi đủ)
                Task.Delay(seconds * 1000 + 100).ContinueWith(_ => StopRecording());

                return $"Đang ghi âm {seconds} giây...";
            }
            catch (Exception ex)
            {
                _isRecording = false;
                DisposeRecordingResources();
                return "Lỗi StartAudio: " + ex.Message;
            }
        }

        private static void StopRecording()
        {
            if (_isRecording && _recSource != null)
            {
                _isRecording = false;
                _recSource.StopRecording();
            }
        }

        private static void DisposeRecordingResources()
        {
            _waveFile?.Dispose();
            _waveFile = null;
            _recSource?.Dispose();
            _recSource = null;
        }
    }
}