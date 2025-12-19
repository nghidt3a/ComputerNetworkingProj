using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Management;
using System.Windows.Forms;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Collections.Generic;

namespace RemoteControlServer.Helpers
{
    public static class SystemHelper
    {
        private static PerformanceCounter cpuCounter;
        private static PerformanceCounter ramCounter;
        private static PerformanceCounter cpuFreqCounter;
        private static PerformanceCounter cpuPerfCounter; // % Processor Performance
        private static PerformanceCounter cpuActualFreqCounter; // Processor Frequency (MHz)
        private static List<PerformanceCounter> gpu3dCounters;
        private static double _totalRamMB = 0;
        private static double _cpuBaseSpeedGHz = 0;  // Base clock from WMI
        private static double _cpuTurboMaxGHz = 0;   // Turbo max (tracked or estimated)
        private static double _gpuMaxClockMHz = 0;
        private static bool _gpuMaxClockCached = false;

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
                    
                    // Init % Processor Performance counter for turbo detection
                    try {
                        cpuPerfCounter = new PerformanceCounter("Processor Information", "% Processor Performance", "_Total");
                        cpuPerfCounter.NextValue();
                    } catch { }
                    
                    // Init Processor Frequency counter for actual MHz
                    try {
                        cpuActualFreqCounter = new PerformanceCounter("Processor Information", "Processor Frequency", "_Total");
                        cpuActualFreqCounter.NextValue();
                    } catch { }
                    
                    InitGpuCounters();
                    CacheCpuBaseSpeed();
                    EstimateTurboMax();
                    CacheGpuMaxClock();
                    GetTotalRam();
                }
            }
            catch { }
        }

        private static void InitGpuCounters()
        {
            try
            {
                gpu3dCounters = new List<PerformanceCounter>();
                var gpuCategory = new PerformanceCounterCategory("GPU Engine");
                var instances = gpuCategory.GetInstanceNames();

                foreach (var instanceName in instances)
                {
                    // Track 3D engines only; summing gives a decent overall signal.
                    if (!instanceName.Contains("engtype_3D", StringComparison.OrdinalIgnoreCase))
                        continue;

                    var counter = new PerformanceCounter("GPU Engine", "Utilization Percentage", instanceName);
                    counter.NextValue(); // warm-up
                    gpu3dCounters.Add(counter);
                }
            }
            catch
            {
                gpu3dCounters = null;
            }
        }

        private static double GetCpuCurrentSpeedGHz()
        {
            try
            {
                // WMI CurrentClockSpeed - returns current MHz
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT CurrentClockSpeed FROM Win32_Processor"))
                {
                    double totalMhz = 0;
                    int count = 0;
                    foreach (var obj in searcher.Get())
                    {
                        if (obj["CurrentClockSpeed"] != null)
                        {
                            totalMhz += Convert.ToDouble(obj["CurrentClockSpeed"]);
                            count++;
                        }
                    }
                    if (count > 0)
                    {
                        return (totalMhz / count) / 1000.0;
                    }
                }
            }
            catch { }
            return 0;
        }

        // Cache GPU max clock at startup (only once)
        private static void CacheGpuMaxClock()
        {
            if (_gpuMaxClockCached) return;
            _gpuMaxClockCached = true;

            try
            {
                // Try nvidia-smi for NVIDIA GPUs
                var psi = new ProcessStartInfo
                {
                    FileName = "nvidia-smi",
                    Arguments = "--query-gpu=clocks.max.graphics --format=csv,noheader,nounits",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using (var proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        var output = proc.StandardOutput.ReadToEnd().Trim();
                        proc.WaitForExit(2000);
                        if (double.TryParse(output, out double maxMHz))
                        {
                            _gpuMaxClockMHz = maxMHz;
                        }
                    }
                }
            }
            catch { }
        }

        // Get current GPU clock speed from nvidia-smi
        private static double GetGpuCurrentClockMHz()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "nvidia-smi",
                    Arguments = "--query-gpu=clocks.current.graphics --format=csv,noheader,nounits",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using (var proc = Process.Start(psi))
                {
                    if (proc != null)
                    {
                        var output = proc.StandardOutput.ReadToEnd().Trim();
                        proc.WaitForExit(1000);
                        if (double.TryParse(output, out double curMHz))
                        {
                            return curMHz;
                        }
                    }
                }
            }
            catch { }
            return 0;
        }

        private static long GetBestVideoRamBytes()
        {
            // Method 1: Try nvidia-smi for accurate VRAM (NVIDIA GPUs)
            try
            {
                string nvidiaSmiPath = @"C:\Windows\system32\nvidia-smi.exe";
                if (System.IO.File.Exists(nvidiaSmiPath))
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = nvidiaSmiPath,
                        Arguments = "--query-gpu=memory.total --format=csv,noheader,nounits",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    using (var proc = Process.Start(psi))
                    {
                        if (proc != null)
                        {
                            var output = proc.StandardOutput.ReadToEnd().Trim();
                            proc.WaitForExit(2000);
                            if (proc.ExitCode == 0 && double.TryParse(output, out double mib))
                            {
                                // nvidia-smi returns MiB, convert to bytes
                                return (long)(mib * 1024 * 1024);
                            }
                        }
                    }
                }
            }
            catch { }

            // Method 2: Fallback to WMI
            try
            {
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name, AdapterRAM FROM Win32_VideoController"))
                {
                    long bestRam = -1;
                    foreach (var obj in searcher.Get())
                    {
                        var name = obj["Name"]?.ToString();
                        if (string.IsNullOrWhiteSpace(name)) continue;

                        var lowered = name.ToLowerInvariant();
                        if (lowered.Contains("microsoft basic") || lowered.Contains("remote") || lowered.Contains("virtual") || lowered.Contains("citrix"))
                            continue;

                        long ram = 0;
                        try
                        {
                            if (obj["AdapterRAM"] != null)
                                ram = Convert.ToInt64(obj["AdapterRAM"]);
                        }
                        catch { ram = 0; }

                        if (ram > bestRam)
                            bestRam = ram;
                    }

                    if (bestRam > 0) return bestRam;
                }
            }
            catch { }
            return 0;
        }

        private static void GetTotalRam()
        {
            // Try multiple methods to determine total RAM to avoid 0/undefined on some systems
            try
            {
                // Method 1: Win32_OperatingSystem.TotalVisibleMemorySize (KB)
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem"))
                {
                    foreach (var mObj in searcher.Get())
                    {
                        if (mObj["TotalVisibleMemorySize"] != null)
                        {
                            _totalRamMB = Convert.ToDouble(mObj["TotalVisibleMemorySize"]) / 1024.0; // -> MB
                        }
                        break;
                    }
                }
            }
            catch { }

            if (_totalRamMB <= 0)
            {
                try
                {
                    // Method 2: Win32_ComputerSystem.TotalPhysicalMemory (bytes)
                    using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalPhysicalMemory FROM Win32_ComputerSystem"))
                    {
                        foreach (var mObj in searcher.Get())
                        {
                            if (mObj["TotalPhysicalMemory"] != null)
                            {
                                double bytes = Convert.ToDouble(mObj["TotalPhysicalMemory"]);
                                _totalRamMB = bytes / 1024.0 / 1024.0; // -> MB
                            }
                            break;
                        }
                    }
                }
                catch { }
            }

            // Conservative fallback default (8 GB) if everything failed
            if (_totalRamMB <= 0)
            {
                _totalRamMB = 8192; // MB
            }
        }

        private static void CacheCpuBaseSpeed()
        {
            if (_cpuBaseSpeedGHz > 0) return;
            
            // Use WMI MaxClockSpeed (base clock)
            try
            {
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT MaxClockSpeed FROM Win32_Processor"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        if (obj["MaxClockSpeed"] != null)
                        {
                            _cpuBaseSpeedGHz = Convert.ToDouble(obj["MaxClockSpeed"]) / 1000.0;
                        }
                        break;
                    }
                }
            }
            catch { }
        }

        private static void EstimateTurboMax()
        {
            if (_cpuTurboMaxGHz > 0) return;
            
            // Estimate turbo max: typically 1.8x - 2.2x base clock for modern Intel CPUs
            // i7-12700H: base 2.3 GHz, turbo 4.7 GHz = ~2.04x
            // We'll use 2.0x as default multiplier, then track actual max observed
            if (_cpuBaseSpeedGHz > 0)
            {
                _cpuTurboMaxGHz = _cpuBaseSpeedGHz * 2.0;
            }
            
            // Try to get better estimate from % Processor Performance
            try
            {
                if (cpuPerfCounter != null)
                {
                    // If performance > 100%, we can calculate turbo
                    float perf = cpuPerfCounter.NextValue();
                    System.Threading.Thread.Sleep(100);
                    perf = cpuPerfCounter.NextValue();
                    
                    if (perf > 100 && _cpuBaseSpeedGHz > 0)
                    {
                        // Current actual speed = base * (perf/100)
                        // This gives us a data point for turbo capability
                        double actualGHz = _cpuBaseSpeedGHz * (perf / 100.0);
                        if (actualGHz > _cpuTurboMaxGHz)
                        {
                            _cpuTurboMaxGHz = actualGHz;
                        }
                    }
                }
            }
            catch { }
            
            // Minimum turbo max = base speed
            if (_cpuTurboMaxGHz <= 0 && _cpuBaseSpeedGHz > 0)
            {
                _cpuTurboMaxGHz = _cpuBaseSpeedGHz;
            }
        }

        public static object GetSystemInfo()
        {
            string cpuName = "Standard Processor";
            string gpuName = "Integrated Graphics";
            string vram = "N/A";
            double cpuMaxSpeedGHz = 0;
            int cpuCores = 0;
            int cpuLogical = 0;
            long vramBytes = 0;
            string osPretty = "Windows";
            string osVersion = Environment.OSVersion.ToString();

            try
            {
                // 0. OS (Caption + Version + Build) for human-readable output
                try
                {
                    using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Caption, Version, BuildNumber FROM Win32_OperatingSystem"))
                    {
                        foreach (var obj in searcher.Get())
                        {
                            var caption = obj["Caption"]?.ToString()?.Trim();
                            var version = obj["Version"]?.ToString()?.Trim();
                            var build = obj["BuildNumber"]?.ToString()?.Trim();
                            if (!string.IsNullOrWhiteSpace(caption))
                            {
                                if (!string.IsNullOrWhiteSpace(version) && !string.IsNullOrWhiteSpace(build))
                                    osPretty = $"{caption} ({version} Build {build})";
                                else if (!string.IsNullOrWhiteSpace(version))
                                    osPretty = $"{caption} ({version})";
                                else
                                    osPretty = caption;
                            }
                            break;
                        }
                    }
                }
                catch { }

                // 1. CPU - lấy thêm max clock và cores
                using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT * FROM Win32_Processor"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        cpuName = obj["Name"]?.ToString();
                        if (obj["MaxClockSpeed"] != null)
                        {
                            cpuMaxSpeedGHz = Convert.ToDouble(obj["MaxClockSpeed"]) / 1000.0;
                            _cpuBaseSpeedGHz = cpuMaxSpeedGHz;
                        }
                        if (obj["NumberOfCores"] != null)
                        {
                            cpuCores = Convert.ToInt32(obj["NumberOfCores"]);
                        }
                        if (obj["NumberOfLogicalProcessors"] != null)
                        {
                            cpuLogical = Convert.ToInt32(obj["NumberOfLogicalProcessors"]);
                        }
                        break;
                    }
                }

                // 2. GPU Name & VRAM (use GetBestVideoRamBytes for accurate VRAM via nvidia-smi)
                try
                {
                    // Get GPU name from WMI
                    using (var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT Name FROM Win32_VideoController"))
                    {
                        string bestName = null;

                        foreach (var obj in searcher.Get())
                        {
                            var name = obj["Name"]?.ToString();
                            if (string.IsNullOrWhiteSpace(name)) continue;

                            // Skip common virtual/basic adapters
                            var lowered = name.ToLowerInvariant();
                            if (lowered.Contains("microsoft basic") || lowered.Contains("remote") || lowered.Contains("virtual") || lowered.Contains("citrix"))
                                continue;

                            // Prefer NVIDIA/AMD over Intel
                            if (bestName == null || lowered.Contains("nvidia") || lowered.Contains("amd") || lowered.Contains("radeon"))
                            {
                                bestName = name;
                                if (lowered.Contains("nvidia") || lowered.Contains("amd") || lowered.Contains("radeon"))
                                    break; // Found dedicated GPU, stop searching
                            }
                        }

                        if (!string.IsNullOrWhiteSpace(bestName)) gpuName = bestName;
                    }
                    
                    // Get VRAM using nvidia-smi (accurate) or WMI fallback
                    vramBytes = GetBestVideoRamBytes();
                    if (vramBytes > 0)
                    {
                        vram = (vramBytes / 1024 / 1024) + " MB";
                    }
                }
                catch { }
            }
            catch { }

            // Disk: total size across fixed drives (more representative than only C:)
            string diskInfo = "N/A";
            try
            {
                long totalFixedBytes = 0;
                foreach (var d in DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed))
                {
                    totalFixedBytes += d.TotalSize;
                }
                if (totalFixedBytes > 0)
                {
                    diskInfo = $"{totalFixedBytes / 1024 / 1024 / 1024} GB";
                }
            }
            catch { }

            // Ensure total RAM cache is present
            if (_totalRamMB <= 0) GetTotalRam();
            var totalRamGB = Math.Round((_totalRamMB > 0 ? _totalRamMB : 0) / 1024.0, 1);

            return new
            {
                os = osPretty,
                osRaw = osVersion,
                pcName = Environment.MachineName,
                cpuName = cpuName,
                gpuName = gpuName,
                vram = vram,
                totalDisk = diskInfo,
                cpuMaxSpeedGHz = cpuMaxSpeedGHz,
                cpuCores = cpuCores,
                cpuLogical = cpuLogical > 0 ? cpuLogical : Environment.ProcessorCount,
                totalRamGB = totalRamGB,
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

                // If total RAM wasn't detected at startup, retry here
                if (_totalRamMB <= 0) GetTotalRam();

                if (_totalRamMB > 0)
                {
                    ramPercent = (int)Math.Round((1.0 - (ramAvailable / _totalRamMB)) * 100.0);
                    // Tính toán số GB
                    ramTotalGB = _totalRamMB / 1024.0;
                    ramUsedGB = Math.Max(0, (_totalRamMB - ramAvailable) / 1024.0);
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

            // GPU load: try GPU Engine counters (cached), else fallback to 0 (avoid fake values)
            int gpuLoad = 0;
            bool gpuLoadFound = false;

            try
            {
                if (gpu3dCounters == null)
                {
                    InitGpuCounters();
                }

                if (gpu3dCounters != null && gpu3dCounters.Count > 0)
                {
                    double sum = 0;
                    foreach (var c in gpu3dCounters)
                    {
                        try { sum += c.NextValue(); } catch { }
                    }
                    // Sum can exceed 100 depending on engines; clamp.
                    gpuLoad = (int)Math.Round(Math.Max(0, Math.Min(100, sum)));
                    gpuLoadFound = true;
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

            // CPU frequency - create fresh counter each time for real-time updates
            double cpuCurrentSpeedGHz = 0;
            CacheCpuBaseSpeed();
            if (_cpuTurboMaxGHz <= 0) EstimateTurboMax();
            
            // Create new counter each call to ensure fresh value
            try
            {
                using (var perfCounter = new PerformanceCounter("Processor Information", "% Processor Performance", "_Total"))
                {
                    perfCounter.NextValue(); // First call returns 0, need warm-up
                    System.Threading.Thread.Sleep(50); // Small delay
                    float perf = perfCounter.NextValue(); // Second call gives real value
                    
                    if (perf > 0 && _cpuBaseSpeedGHz > 0)
                    {
                        cpuCurrentSpeedGHz = _cpuBaseSpeedGHz * (perf / 100.0);
                    }
                }
            }
            catch { }
            
            // Fallback: Use Processor Frequency counter
            if (cpuCurrentSpeedGHz <= 0)
            {
                try
                {
                    using (var freqCounter = new PerformanceCounter("Processor Information", "Processor Frequency", "_Total"))
                    {
                        freqCounter.NextValue();
                        System.Threading.Thread.Sleep(50);
                        float freqMHz = freqCounter.NextValue();
                        if (freqMHz > 0)
                        {
                            cpuCurrentSpeedGHz = freqMHz / 1000.0;
                        }
                    }
                }
                catch { }
            }
            
            // Update turbo max if we see higher speed
            if (cpuCurrentSpeedGHz > _cpuTurboMaxGHz && cpuCurrentSpeedGHz > 0)
            {
                _cpuTurboMaxGHz = cpuCurrentSpeedGHz;
            }
            
            // Last fallback to WMI
            if (cpuCurrentSpeedGHz <= 0)
            {
                cpuCurrentSpeedGHz = GetCpuCurrentSpeedGHz();
            }

            // GPU clock frequency (NVIDIA via nvidia-smi)
            double gpuClockCurrentMHz = GetGpuCurrentClockMHz();
            if (!_gpuMaxClockCached) CacheGpuMaxClock();

            // Calculate CPU percentage based on current/turboMax
            int cpuFreqPercent = 0;
            if (_cpuTurboMaxGHz > 0)
            {
                cpuFreqPercent = (int)Math.Round((cpuCurrentSpeedGHz / _cpuTurboMaxGHz) * 100.0);
                cpuFreqPercent = Math.Max(0, Math.Min(100, cpuFreqPercent));
            }

            return new
            {
                cpu = cpuFreqPercent,  // Now based on GHz current / turbo max
                cpuUsage = (int)cpu,   // Original CPU utilization %
                ram = ramPercent,
                diskUsage = diskPercent,
                gpu = gpuLoad,
                ramUsedGB = ramUsedGB,
                ramTotalGB = ramTotalGB,
                diskUsedGB = diskUsedGB,
                diskTotalGB = diskTotalGB,
                cpuFreqCurrent = Math.Round(cpuCurrentSpeedGHz, 2),
                cpuFreqMax = Math.Round(_cpuTurboMaxGHz, 2),  // Turbo max instead of base
                gpuClockCurrent = Math.Round(gpuClockCurrentMHz / 1000.0, 2),
                gpuClockMax = Math.Round(_gpuMaxClockMHz / 1000.0, 2)
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

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool BlockInput(bool fBlockIt);

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

        // ---- Power controls ----
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool LockWorkStation();

        [DllImport("powrprof.dll", SetLastError = true)]
        private static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

        public static bool Sleep()
        {
            try
            {
                return SetSuspendState(false, false, false);
            }
            catch
            {
                return false;
            }
        }

        public static bool LockSession()
        {
            try
            {
                return LockWorkStation();
            }
            catch
            {
                return false;
            }
        }

        public static bool DisableInput()
        {
            try
            {
                bool result = BlockInput(true);
                if (!result)
                {
                    int errorCode = Marshal.GetLastWin32Error();
                    Logger.Error($"BlockInput(true) failed. Error code: {errorCode}. Make sure to run as Administrator.");
                }
                else
                {
                    Logger.Info("Input blocked successfully.");
                    _isInputBlocked = true;
                }
                return result;
            }
            catch (Exception ex)
            {
                Logger.Error($"BlockInput exception: {ex.Message}");
                return false;
            }
        }

        // Track trạng thái block để hỗ trợ auto-unblock
        private static bool _isInputBlocked = false;
        public static bool IsInputBlocked => _isInputBlocked;

        public static bool EnableInput()
        {
            try
            {
                // Windows BlockInput API có hành vi không ổn định
                // Cần gọi NHIỀU LẦN với các chiến lược khác nhau để đảm bảo unblock thành công
                
                bool success = false;
                
                // Chiến lược 1: Gọi BlockInput(false) nhiều lần liên tiếp với delay ngắn
                for (int attempt = 0; attempt < 10; attempt++)
                {
                    // Gọi BlockInput(false) 3 lần liên tiếp trong mỗi attempt
                    for (int i = 0; i < 3; i++)
                    {
                        BlockInput(false);
                    }
                    
                    // Verify bằng cách thử block rồi unblock lại
                    BlockInput(true);
                    System.Threading.Thread.Sleep(10);
                    success = BlockInput(false);
                    
                    if (success)
                    {
                        Logger.Info($"Input unblocked successfully on attempt {attempt + 1}");
                        _isInputBlocked = false;
                        return true;
                    }
                    
                    System.Threading.Thread.Sleep(100); // Delay dài hơn giữa các attempt
                }
                
                // Chiến lược 2: Force unblock bằng cách gọi BlockInput(false) nhiều lần với delay dài hơn
                for (int i = 0; i < 5; i++)
                {
                    BlockInput(false);
                    System.Threading.Thread.Sleep(200);
                }
                
                // Kiểm tra lần cuối
                success = BlockInput(false);
                int errorCode = Marshal.GetLastWin32Error();
                
                if (success || errorCode == 0)
                {
                    Logger.Info("Input unblocked successfully (forced with extended retry).");
                    _isInputBlocked = false;
                    return true;
                }
                else
                {
                    // Chiến lược 3 (Fallback cuối cùng): Gọi liên tục trong 2 giây
                    Logger.Warning("Attempting final fallback unblock strategy...");
                    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                    while (stopwatch.ElapsedMilliseconds < 2000)
                    {
                        BlockInput(false);
                        System.Threading.Thread.Sleep(50);
                    }
                    
                    success = BlockInput(false);
                    if (success)
                    {
                        Logger.Info("Input unblocked via fallback strategy.");
                        _isInputBlocked = false;
                        return true;
                    }
                    
                    Logger.Error($"BlockInput(false) failed after all attempts. Error code: {errorCode}");
                    // Vẫn đặt _isInputBlocked = false để tránh trạng thái không nhất quán
                    _isInputBlocked = false;
                    return false;
                }
            }
            catch (Exception ex)
            {
                Logger.Error($"EnableInput exception: {ex.Message}");
                _isInputBlocked = false;
                return false;
            }
        }
        
        // Hàm tiện ích để force unblock - gọi từ bên ngoài khi cần
        public static void ForceUnblockInput()
        {
            try
            {
                // Gọi BlockInput(false) liên tục trong 3 giây
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                while (stopwatch.ElapsedMilliseconds < 3000)
                {
                    BlockInput(false);
                    System.Threading.Thread.Sleep(30);
                }
                _isInputBlocked = false;
                Logger.Info("Force unblock completed.");
            }
            catch (Exception ex)
            {
                Logger.Error($"ForceUnblockInput exception: {ex.Message}");
            }
        }
    }
}