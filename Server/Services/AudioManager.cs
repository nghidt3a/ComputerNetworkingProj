using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave; // Cần thư viện NAudio

namespace RemoteControlServer.Services
{
    public static class AudioManager
    {
        private static WaveInEvent _waveSource;
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
                // Cấu hình WaveIn (16kHz, 16bit, Mono)
                _waveSource = new WaveInEvent();
                _waveSource.WaveFormat = new WaveFormat(16000, 16, 1);
                _waveSource.BufferMilliseconds = 50; // Giảm buffer để streaming mượt hơn
                _waveSource.NumberOfBuffers = 3;

                _waveSource.DataAvailable += (s, e) =>
                {
                    if (e.BytesRecorded > 0)
                    {
                        byte[] chunk = new byte[e.BytesRecorded];
                        Array.Copy(e.Buffer, chunk, e.BytesRecorded);
                        OnAudioCaptured?.Invoke(chunk);
                    }
                };

                _waveSource.StartRecording();
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
                if (_waveSource != null)
                {
                    _waveSource.StopRecording();
                    _waveSource.Dispose();
                    _waveSource = null;
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

                // Cấu hình WaveIn (44.1kHz, 16bit, Mono để nhẹ file)
                _waveSource = new WaveInEvent();
                _waveSource.WaveFormat = new WaveFormat(44100, 16, 1);

                _waveFile = new WaveFileWriter(_currentFilePath, _waveSource.WaveFormat);

                _waveSource.DataAvailable += (s, e) =>
                {
                    if (_waveFile != null)
                    {
                        _waveFile.Write(e.Buffer, 0, e.BytesRecorded);
                        _waveFile.Flush();
                    }

                    // Broadcast audio chunks for live streaming
                    if (e.BytesRecorded > 0)
                    {
                        byte[] chunk = new byte[e.BytesRecorded];
                        Array.Copy(e.Buffer, chunk, e.BytesRecorded);
                        OnAudioCaptured?.Invoke(chunk);
                    }
                };

                _waveSource.RecordingStopped += (s, e) =>
                {
                    DisposeResources();
                    Console.WriteLine($">> Đã lưu file ghi âm: {_currentFilePath}");
                    OnAudioSaved?.Invoke(_currentFilePath);
                };

                _waveSource.StartRecording();

                // Hẹn giờ tắt (thêm 100ms buffer để đảm bảo ghi đủ)
                Task.Delay(seconds * 1000 + 100).ContinueWith(_ => StopRecording());

                return $"Đang ghi âm {seconds} giây...";
            }
            catch (Exception ex)
            {
                _isRecording = false;
                DisposeResources();
                return "Lỗi StartAudio: " + ex.Message;
            }
        }

        private static void StopRecording()
        {
            if (_isRecording && _waveSource != null)
            {
                _isRecording = false;
                _waveSource.StopRecording();
            }
        }

        private static void DisposeResources()
        {
            _waveFile?.Dispose();
            _waveFile = null;
            _waveSource?.Dispose();
            _waveSource = null;
        }
    }
}