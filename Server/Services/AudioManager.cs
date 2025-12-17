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

        // Sự kiện báo khi file âm thanh đã lưu xong
        public static event Action<string> OnAudioSaved;

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