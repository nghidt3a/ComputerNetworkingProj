using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using NAudio.Wave;

namespace RemoteControlServer.Services
{
    /// <summary>
    /// VideoRecorder handles merging video frames and audio into MP4 using FFmpeg.
    /// </summary>
    public static class VideoRecorder
    {
        private static WaveFileWriter _audioWriter;
        private static string _tempAudioPath;
        private static string _tempFramesFolder;
        private static bool _isRecording;
        private static int _frameCounter;

        /// <summary>
        /// Start recording: create temp folders and audio file.
        /// </summary>
        public static void StartRecording(bool includeAudio)
        {
            if (_isRecording) return;

            _isRecording = true;
            _frameCounter = 0;
            _tempAudioPath = null; // Reset audio path

            // Create temp folder for frames
            _tempFramesFolder = Path.Combine(Path.GetTempPath(), $"webcam_{Guid.NewGuid()}");
            Directory.CreateDirectory(_tempFramesFolder);
            Console.WriteLine($"📁 Frames folder: {_tempFramesFolder}");

            if (includeAudio)
            {
                // Create temp audio file
                _tempAudioPath = Path.Combine(Path.GetTempPath(), $"audio_{Guid.NewGuid()}.wav");
                var waveFormat = new WaveFormat(16000, 16, 1); // 16kHz mono 16-bit
                _audioWriter = new WaveFileWriter(_tempAudioPath, waveFormat);
                Console.WriteLine($"🎤 Audio file: {_tempAudioPath}");
            }
            else
            {
                Console.WriteLine($"🎬 Recording video only (no audio)");
            }
        }

        /// <summary>
        /// Save a JPEG frame to temp folder.
        /// </summary>
        public static void SaveFrame(byte[] jpegBytes)
        {
            if (!_isRecording || jpegBytes == null || jpegBytes.Length == 0) return;

            try
            {
                var framePath = Path.Combine(_tempFramesFolder, $"frame_{_frameCounter:D4}.jpg");
                File.WriteAllBytes(framePath, jpegBytes);
                _frameCounter++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error saving frame: {ex.Message}");
            }
        }

        /// <summary>
        /// Write audio chunk to WAV file.
        /// </summary>
        public static void WriteAudioChunk(byte[] pcmData)
        {
            if (!_isRecording || _audioWriter == null || pcmData == null) return;

            try
            {
                _audioWriter.Write(pcmData, 0, pcmData.Length);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error writing audio: {ex.Message}");
            }
        }

        /// <summary>
        /// Stop recording and encode video with FFmpeg.
        /// </summary>
        public static async Task<string> StopRecordingAndEncode(string outputPath, bool includeAudio = true)
        {
            if (!_isRecording) return null;

            _isRecording = false;

            // Close audio file
            if (_audioWriter != null)
            {
                _audioWriter.Dispose();
                _audioWriter = null;
                await Task.Delay(300); // Wait for file flush
            }

            Console.WriteLine($"🎬 Encoding video... Frames: {_frameCounter}");

            // Run FFmpeg
            bool success = await EncodeWithFFmpeg(outputPath, includeAudio);

            // Cleanup temp files
            CleanupTempFiles();

            return success ? outputPath : null;
        }

        private static async Task<bool> EncodeWithFFmpeg(string outputPath, bool includeAudio = true)
        {
            try
            {
                var inputPattern = Path.Combine(_tempFramesFolder, "frame_%04d.jpg");
                var hasAudio = includeAudio && !string.IsNullOrEmpty(_tempAudioPath) && File.Exists(_tempAudioPath);

                string ffmpegArgs;
                if (hasAudio)
                {
                    // Video + Audio -> WebM with VP9 + Opus
                    ffmpegArgs = $"-framerate 24 -i \"{inputPattern}\" -i \"{_tempAudioPath}\" " +
                                 $"-c:v libvpx-vp9 -crf 30 -b:v 0 -deadline realtime -cpu-used 4 " +
                                 $"-c:a libopus -b:a 128k -shortest -y \"{outputPath}\"";
                }
                else
                {
                    // Video only -> WebM with VP9
                    ffmpegArgs = $"-framerate 24 -i \"{inputPattern}\" " +
                                 $"-c:v libvpx-vp9 -crf 30 -b:v 0 -deadline realtime -cpu-used 4 " +
                                 $"-an -y \"{outputPath}\"";
                }

                Console.WriteLine($"🔧 FFmpeg: {ffmpegArgs.Substring(0, Math.Min(100, ffmpegArgs.Length))}...");

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

                // Read stderr for progress (FFmpeg outputs to stderr)
                var errorOutput = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0)
                {
                    Console.WriteLine($"✅ Video encoded: {outputPath} ({new FileInfo(outputPath).Length / 1024} KB)");
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
                // Delete frames folder
                if (Directory.Exists(_tempFramesFolder))
                {
                    Directory.Delete(_tempFramesFolder, true);
                    Console.WriteLine($"🗑️ Cleaned frames folder");
                }

                // Delete audio file
                if (File.Exists(_tempAudioPath))
                {
                    File.Delete(_tempAudioPath);
                    Console.WriteLine($"🗑️ Cleaned audio file");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Cleanup warning: {ex.Message}");
            }
        }
    }
}
