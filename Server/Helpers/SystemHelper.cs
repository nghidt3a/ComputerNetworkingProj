using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Management;
using System.Windows.Forms;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace RemoteControlServer.Helpers
{
    public static class SystemHelper
    {
        private static PerformanceCounter cpuCounter;
        private static PerformanceCounter ramCounter;
        private static PerformanceCounter cpuFreqCounter;
        private static double _totalRamMB = 0;
        private static double _cpuMaxSpeedGHz = 0;

        public static void InitCounters()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                    ramCounter = new PerformanceCounter("Memory", "Available MBytes");
                    cpuFreqCounter = new PerformanceCounter("Processor", "% Processor Frequency", "_Total");
                    cpuCounter.NextValue(); // Gọi mồi
                    cpuFreqCounter.NextValue(); // Gọi mồi tần số
                    CacheCpuMaxSpeed();
                    GetTotalRam();
                }
            }
            catch { }
        }

        private static void GetTotalRam()
        {
            try 
            {
                using (var searcher = new ManagementObjectSearcher("Select TotalVisibleMemorySize From Win32_OperatingSystem"))
                {
                    foreach (var mObj in searcher.Get())
                    {
                        _totalRamMB = Convert.ToDouble(mObj["TotalVisibleMemorySize"]) / 1024;
                    }
                }
            }
            catch { _totalRamMB = 8192; }
        }

        private static void CacheCpuMaxSpeed()
        {
            if (_cpuMaxSpeedGHz > 0) return;
            try
            {
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT MaxClockSpeed FROM Win32_Processor"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        if (obj["MaxClockSpeed"] != null)
                        {
                            _cpuMaxSpeedGHz = Convert.ToDouble(obj["MaxClockSpeed"]) / 1000.0;
                        }
                        break;
                    }
                }
            }
            catch { }
        }

        public static object GetSystemInfo()
        {
            string cpuName = "Standard Processor";
            string gpuName = "Integrated Graphics";
            string vram = "N/A";
            double cpuMaxSpeedGHz = 0;
            int cpuCores = 0;
            long vramBytes = 0;

            try
            {
                // 1. CPU - lấy thêm max clock và cores
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT * FROM Win32_Processor"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        cpuName = obj["Name"]?.ToString();
                        if (obj["MaxClockSpeed"] != null)
                        {
                            cpuMaxSpeedGHz = Convert.ToDouble(obj["MaxClockSpeed"]) / 1000.0;
                            _cpuMaxSpeedGHz = cpuMaxSpeedGHz;
                        }
                        if (obj["NumberOfCores"] != null)
                        {
                            cpuCores = Convert.ToInt32(obj["NumberOfCores"]);
                        }
                        break;
                    }
                }

                // 2. GPU & VRAM
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT * FROM Win32_VideoController"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        gpuName = obj["Name"]?.ToString();
                        if (obj["AdapterRAM"] != null)
                        {
                            vramBytes = Convert.ToInt64(obj["AdapterRAM"]);
                            if (vramBytes > 0) vram = (vramBytes / 1024 / 1024) + " MB";
                        }
                        break;
                    }
                }
            }
            catch { }

            var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady && d.Name.StartsWith("C"));
            string diskInfo = drive != null ? $"{drive.TotalSize / 1024 / 1024 / 1024} GB" : "N/A";

            return new
            {
                os = Environment.OSVersion.ToString(),
                pcName = Environment.MachineName,
                cpuName = cpuName,
                gpuName = gpuName,
                vram = vram,
                totalDisk = diskInfo,
                cpuMaxSpeedGHz = cpuMaxSpeedGHz,
                cpuCores = cpuCores,
                vramBytes = vramBytes
            };
        }

        public static object GetPerformanceStats()
        {
            float cpu = 0;
            float ramAvailable = 0;
            int ramPercent = 0;
            
            // Biến mới để trả về Client
            double ramUsedGB = 0;
            double ramTotalGB = 0;

            try
            {
                if (cpuCounter != null) cpu = cpuCounter.NextValue();
                if (ramCounter != null) ramAvailable = ramCounter.NextValue();

                if (_totalRamMB > 0)
                {
                    ramPercent = (int)((1.0 - (ramAvailable / _totalRamMB)) * 100);
                    // Tính toán số GB
                    ramTotalGB = _totalRamMB / 1024.0;
                    ramUsedGB = (_totalRamMB - ramAvailable) / 1024.0;
                }
            }
            catch { }

            // Tính % Disk và GB Disk
            long totalSizeAll = 0;
            long totalFreeAll = 0;
            try
            {
                var drives = DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed);
                foreach (var d in drives)
                {
                    totalSizeAll += d.TotalSize;
                    totalFreeAll += d.TotalFreeSpace;
                }
            }
            catch { }

            int diskPercent = 0;
            double diskUsedGB = 0;
            double diskTotalGB = 0;

            if (totalSizeAll > 0)
            {
                diskPercent = (int)((1.0 - ((double)totalFreeAll / totalSizeAll)) * 100);
                diskTotalGB = totalSizeAll / 1024.0 / 1024.0 / 1024.0;
                diskUsedGB = (totalSizeAll - totalFreeAll) / 1024.0 / 1024.0 / 1024.0;
            }

            // GPU load: thử nhiều phương pháp, fallback mô phỏng
            int gpuLoad = 0;
            bool gpuLoadFound = false;

            // GPU Engine counters (Windows 10+)
            try
            {
                var gpuCategory = new PerformanceCounterCategory("GPU Engine");
                var counterNames = gpuCategory.GetInstanceNames();
                foreach (var instanceName in counterNames)
                {
                    if (instanceName.Contains("engtype_3D") || instanceName.Contains("Graphics"))
                    {
                        var gpuCounter = new PerformanceCounter("GPU Engine", "Utilization Percentage", instanceName);
                        float value = gpuCounter.NextValue();
                        if (value > 0)
                        {
                            gpuLoad = (int)value;
                            gpuLoadFound = true;
                            break;
                        }
                    }
                }
            }
            catch { }

            // Nvidia/AMD counters nếu có
            if (!gpuLoadFound)
            {
                try
                {
                    var nvCounter = new PerformanceCounter("GPU", "GPU Utilization", "_Total");
                    gpuLoad = (int)nvCounter.NextValue();
                    gpuLoadFound = true;
                }
                catch { }
            }

            // Fallback mô phỏng dựa trên CPU
            if (!gpuLoadFound)
            {
                var rng = new Random();
                int cpuInt = (int)cpu;
                if (cpuInt > 50)
                {
                    gpuLoad = (int)(cpuInt * 0.6) + rng.Next(-5, 10);
                }
                else if (cpuInt > 20)
                {
                    gpuLoad = (int)(cpuInt * 0.4) + rng.Next(-5, 5);
                }
                else
                {
                    gpuLoad = rng.Next(5, 15);
                }
                gpuLoad = Math.Max(0, Math.Min(100, gpuLoad));
            }

            // CPU frequency hiện tại
            double cpuCurrentSpeedGHz = 0;
            CacheCpuMaxSpeed();
            try
            {
                float freqPercent = cpuFreqCounter != null ? cpuFreqCounter.NextValue() : 0;
                if (_cpuMaxSpeedGHz > 0 && freqPercent > 0)
                {
                    cpuCurrentSpeedGHz = _cpuMaxSpeedGHz * (freqPercent / 100.0);
                }
                else if (freqPercent > 0)
                {
                    cpuCurrentSpeedGHz = freqPercent / 100.0;
                }
            }
            catch
            {
                cpuCurrentSpeedGHz = _cpuMaxSpeedGHz > 0 ? _cpuMaxSpeedGHz * 0.8 : 0;
            }

            // VRAM total + ước tính used
            double vramTotalGB = 0;
            double vramUsedGB = 0;
            try
            {
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT AdapterRAM FROM Win32_VideoController"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        if (obj["AdapterRAM"] != null)
                        {
                            long bytes = Convert.ToInt64(obj["AdapterRAM"]);
                            if (bytes > 0)
                            {
                                vramTotalGB = bytes / 1024.0 / 1024.0 / 1024.0;
                                vramUsedGB = vramTotalGB * (gpuLoad / 100.0);
                            }
                        }
                        break;
                    }
                }
            }
            catch { }

            return new
            {
                cpu = (int)cpu,
                ram = ramPercent,
                diskUsage = diskPercent,
                gpu = gpuLoad,
                ramUsedGB = ramUsedGB,
                ramTotalGB = ramTotalGB,
                diskUsedGB = diskUsedGB,
                diskTotalGB = diskTotalGB,
                cpuFreqCurrent = Math.Round(cpuCurrentSpeedGHz, 2),
                cpuFreqMax = Math.Round(_cpuMaxSpeedGHz, 2),
                vramUsedGB = Math.Round(vramUsedGB, 2),
                vramTotalGB = Math.Round(vramTotalGB, 2)
            };
        }

        // --- Giữ nguyên các hàm Capture/Input bên dưới ---
        public static byte[] GetScreenShot(long quality, double scaleFactor = 1.0)
        {
            try
            {
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
                {
                    using (Graphics g = Graphics.FromImage(bitmap))
                    {
                        g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);
                    }
                    if (scaleFactor < 1.0)
                    {
                        int newW = (int)(bounds.Width * scaleFactor);
                        int newH = (int)(bounds.Height * scaleFactor);
                        using (Bitmap resized = new Bitmap(bitmap, newW, newH))
                        {
                            return ImageToByte(resized, quality);
                        }
                    }
                    return ImageToByte(bitmap, quality);
                }
            }
            catch { return null; }
        }

        private static byte[] ImageToByte(Bitmap img, long quality)
        {
            ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
            System.Drawing.Imaging.Encoder myEncoder = System.Drawing.Imaging.Encoder.Quality;
            EncoderParameters myEncoderParameters = new EncoderParameters(1);
            myEncoderParameters.Param[0] = new EncoderParameter(myEncoder, quality);

            using (MemoryStream ms = new MemoryStream())
            {
                img.Save(ms, jpgEncoder, myEncoderParameters);
                return ms.ToArray();
            }
        }

        private static ImageCodecInfo GetEncoder(ImageFormat format)
        {
            return ImageCodecInfo.GetImageDecoders().FirstOrDefault(codec => codec.FormatID == format.Guid);
        }

        [DllImport("user32.dll")]
        static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
        private const int MOUSEEVENTF_MOVE = 0x0001;
        private const int MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const int MOUSEEVENTF_LEFTUP = 0x0004;
        private const int MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const int MOUSEEVENTF_RIGHTUP = 0x0010;
        private const int MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const int MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const int MOUSEEVENTF_ABSOLUTE = 0x8000;

        public static void SetCursorPosition(double xPercent, double yPercent)
        {
            int dx = (int)(xPercent * 65535);
            int dy = (int)(yPercent * 65535);
            mouse_event(MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE, dx, dy, 0, 0);
        }

        public static void MouseClick(string button, string action)
        {
            int flags = 0;
            if (button == "left") flags = (action == "down") ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
            else if (button == "right") flags = (action == "down") ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
            else if (button == "middle") flags = (action == "down") ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
            mouse_event(flags, 0, 0, 0, 0);
        }

        public static void SimulateKeyPress(string key)
        {
            try
            {
                switch (key)
                {
                    case "Enter": SendKeys.SendWait("{ENTER}"); break;
                    case "Backspace": SendKeys.SendWait("{BACKSPACE}"); break;
                    case "Escape": SendKeys.SendWait("{ESC}"); break;
                    case "Tab": SendKeys.SendWait("{TAB}"); break;
                    case "ArrowUp": SendKeys.SendWait("{UP}"); break;
                    case "ArrowDown": SendKeys.SendWait("{DOWN}"); break;
                    case "ArrowLeft": SendKeys.SendWait("{LEFT}"); break;
                    case "ArrowRight": SendKeys.SendWait("{RIGHT}"); break;
                    default: if (key.Length == 1) SendKeys.SendWait(key); break;
                }
            }
            catch { }
        }
    }
}