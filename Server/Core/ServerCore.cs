using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Fleck;
using Newtonsoft.Json;

using RemoteControlServer.Models;
using RemoteControlServer.Helpers;
using RemoteControlServer.Services;

namespace RemoteControlServer.Core
{
    public class ServerCore
    {
        // ServerCore: Trung tâm xử lý phía Server
        // - Khởi tạo WebSocket Server
        // - Xử lý các lệnh từ Client (AUTH, FILE/PROCESS, STREAM...)
        // - Phát broadcast Stream và Log
        // All comments below in Vietnamese for clarity.
        // Gộp trách nhiệm mạng vào SocketManager
        // Lưu mật khẩu OTP tạm thời cho phiên (mỗi lần start sẽ random một mật khẩu)
        private static string _sessionPassword = "";

        // Lấy danh sách tất cả apps cài đặt kèm trạng thái running
        internal static object GetCurrentApps()
        {
            // Dùng Dictionary tạm để merge, sau đó chọn entry tốt nhất cho mỗi app
            var candidateApps = new Dictionary<string, List<dynamic>>(StringComparer.OrdinalIgnoreCase);
            var runningProcesses = Process.GetProcesses().ToList();

            try
            {
                // 1. Lấy apps đang chạy (running) từ processes có MainWindow
                // Group theo ProcessName để tránh trùng lặp (VD: Chrome có nhiều process)
                var runningApps = runningProcesses
                    .Where(p => !string.IsNullOrEmpty(p.MainWindowTitle))
                    .GroupBy(p => p.ProcessName, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First()) // Chỉ lấy 1 instance đầu tiên
                    .ToList();

                foreach (var proc in runningApps)
                {
                    try
                    {
                        string appKey = NormalizeAppKey(proc.ProcessName);
                        if (!candidateApps.ContainsKey(appKey))
                        {
                            candidateApps[appKey] = new List<dynamic>();
                        }
                        
                        candidateApps[appKey].Add(new
                        {
                            id = proc.Id,
                            name = proc.ProcessName,
                            title = proc.MainWindowTitle,
                            memory = GetMemoryUsage(proc),
                            status = "running",
                            path = proc.MainModule?.FileName ?? ""
                        });
                    }
                    catch { } // Skip processes we can't access
                }

                // 2. Lấy installed apps từ Registry (machine + user + 32-bit)
                AddInstalledAppsFromRegistry(
                    Microsoft.Win32.Registry.LocalMachine,
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                    candidateApps,
                    runningProcesses
                );

                AddInstalledAppsFromRegistry(
                    Microsoft.Win32.Registry.LocalMachine,
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
                    candidateApps,
                    runningProcesses
                );

                AddInstalledAppsFromRegistry(
                    Microsoft.Win32.Registry.CurrentUser,
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                    candidateApps,
                    runningProcesses
                );

                AddInstalledAppsFromRegistry(
                    Microsoft.Win32.Registry.CurrentUser,
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
                    candidateApps,
                    runningProcesses
                );

                // 3. Lấy apps từ Start Menu làm backup
                AddAppsFromStartMenu(candidateApps, runningProcesses);

                // 4. Bổ sung AppX/UWP (Microsoft Store) để thấy app như Spotify, Zoom)
                AddUwpApps(candidateApps, runningProcesses);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting apps: {ex.Message}");
            }

            // Deduplicate step 1: Chọn entry tốt nhất cho mỗi normalized key
            var candidatesList = new List<dynamic>();
            foreach (var kvp in candidateApps)
            {
                var candidates = kvp.Value;
                if (candidates.Count == 0) continue;

                dynamic bestCandidate = null;
                if (candidates.Count == 1)
                {
                    bestCandidate = candidates[0];
                }
                else
                {
                    // Ưu tiên: running > có path exe rõ ràng > có title dài hơn
                    bestCandidate = candidates
                        .OrderByDescending(c => c.status == "running" ? 1 : 0)
                        .ThenByDescending(c => !string.IsNullOrWhiteSpace(c.path) && c.path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
                        .ThenByDescending(c => !string.IsNullOrWhiteSpace(c.path) && c.path.StartsWith("shell:", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
                        .ThenByDescending(c => ((string)c.title ?? "").Length)
                        .First();
                }

                // Filter: Chỉ thêm nếu là app thực sự
                if (IsValidApp(bestCandidate))
                {
                    candidatesList.Add(bestCandidate);
                }
            }

            // Deduplicate step 2: Loại bỏ apps có tên tương tự (Chrome vs Google Chrome)
            var finalApps = new List<dynamic>();
            var processedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                // 1.5. Lấy background apps (chạy ngầm) - VD: Unikey, Dropbox, OneDrive
                var backgroundApps = runningProcesses
                    .Where(p => string.IsNullOrEmpty(p.MainWindowTitle) && IsBackgroundApp(p))
                    .GroupBy(p => p.ProcessName, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .ToList();
                Console.WriteLine($">> Background processes detected: {backgroundApps.Count}");

                foreach (var proc in backgroundApps)
                {
                    try
                    {
                        string appKey = NormalizeAppKey(proc.ProcessName);
                        if (!candidateApps.ContainsKey(appKey))
                        {
                            candidateApps[appKey] = new List<dynamic>();
                        }

                        string exePath = proc.MainModule?.FileName ?? "";
                        bool alreadySamePath = candidateApps[appKey].Any(c => string.Equals((string)c.path ?? "", exePath, StringComparison.OrdinalIgnoreCase));
                        if (!alreadySamePath)
                        {
                            candidateApps[appKey].Add(new
                            {
                                id = proc.Id,
                                name = proc.ProcessName,
                                title = proc.ProcessName + " (Background)",
                                memory = GetMemoryUsage(proc),
                                status = "running",
                                path = exePath
                            });
                        }
                    }
                    catch { }
                }

            foreach (var app in candidatesList.OrderByDescending(a => a.status == "running" ? 1 : 0))
            {
                string appName = ((string)app.name ?? "").ToLower();
                string normalizedName = new string(appName.Where(char.IsLetterOrDigit).ToArray());

                // Kiểm tra xem đã có app tương tự chưa
                bool isDuplicate = processedNames.Any(existing =>
                {
                    string existingNormalized = new string(existing.Where(char.IsLetterOrDigit).ToArray());
                    // Nếu tên ngắn hơn chứa trong tên dài hơn → coi là trùng
                    return (normalizedName.Length > 3 && existingNormalized.Length > 3) &&
                           (normalizedName.Contains(existingNormalized) || existingNormalized.Contains(normalizedName));
                });

                if (!isDuplicate)
                {
                    finalApps.Add(app);
                    processedNames.Add(appName);
                }
            }

            return finalApps.OrderBy(x => ((dynamic)x).name).ToList();
        }

        private static void AddInstalledAppsFromRegistry(Microsoft.Win32.RegistryKey rootKey, string registryPath, Dictionary<string, List<dynamic>> installedApps, List<Process> runningProcesses)
        {
            try
            {
                using (var key = rootKey.OpenSubKey(registryPath))
                {
                    if (key == null) return;

                    foreach (string subKeyName in key.GetSubKeyNames())
                    {
                        try
                        {
                            using (var subKey = key.OpenSubKey(subKeyName))
                            {
                                if (subKey == null) continue;

                                string displayName = subKey.GetValue("DisplayName") as string;
                                string installLocation = subKey.GetValue("InstallLocation") as string;
                                string displayIcon = subKey.GetValue("DisplayIcon") as string;
                                string uninstallString = subKey.GetValue("UninstallString") as string;

                                if (string.IsNullOrEmpty(displayName)) continue;

                                // Skip system components
                                if (displayName.Contains("Update") ||
                                    displayName.Contains("Redistributable") ||
                                    displayName.Contains("Runtime") ||
                                    displayName.StartsWith("Microsoft Visual C++"))
                                    continue;

                                string appKey = NormalizeAppKey(displayName);
                                string executablePath = ResolveExecutablePath(installLocation, displayIcon, uninstallString);

                                if (!installedApps.ContainsKey(appKey))
                                {
                                    installedApps[appKey] = new List<dynamic>();
                                }

                                // Kiểm tra xem đã có entry tương tự chưa để tránh duplicate hoàn toàn giống nhau
                                bool alreadyExists = installedApps[appKey].Any(c => 
                                    c.name == displayName && 
                                    c.path == (string.IsNullOrWhiteSpace(ResolveExecutablePath(installLocation, displayIcon, uninstallString)) ? "" : ResolveExecutablePath(installLocation, displayIcon, uninstallString)));

                                if (!alreadyExists)
                                {
                                    // Try to find matching running process
                                    var matchingProcess = runningProcesses.FirstOrDefault(p =>
                                        p.ProcessName.Contains(displayName, StringComparison.OrdinalIgnoreCase) ||
                                        displayName.Contains(p.ProcessName, StringComparison.OrdinalIgnoreCase) ||
                                        (!string.IsNullOrEmpty(p.MainWindowTitle) &&
                                         p.MainWindowTitle.Contains(displayName, StringComparison.OrdinalIgnoreCase))
                                    );

                                    if (matchingProcess != null && !string.IsNullOrEmpty(matchingProcess.MainWindowTitle))
                                    {
                                        installedApps[appKey].Add(new
                                        {
                                            id = matchingProcess.Id,
                                            name = displayName,
                                            title = matchingProcess.MainWindowTitle,
                                            memory = GetMemoryUsage(matchingProcess),
                                            status = "running",
                                            path = string.IsNullOrWhiteSpace(executablePath) ? (installLocation ?? "") : executablePath
                                        });
                                    }
                                    else
                                    {
                                        installedApps[appKey].Add(new
                                        {
                                            id = 0,
                                            name = displayName,
                                            title = displayName,
                                            memory = "N/A",
                                            status = "stopped",
                                            path = executablePath
                                        });
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private static void AddUwpApps(Dictionary<string, List<dynamic>> installedApps, List<Process> runningProcesses)
        {
            try
            {
                Console.WriteLine(">> Scanning UWP/Store apps via PowerShell...");
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell",
                    Arguments = "-NoProfile -Command \"Get-StartApps | ConvertTo-Json\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var proc = Process.Start(psi))
                {
                    if (proc == null) 
                    {
                        Console.WriteLine(">> Failed to start PowerShell process");
                        return;
                    }

                    string output = proc.StandardOutput.ReadToEnd();
                    string errors = proc.StandardError.ReadToEnd();
                    proc.WaitForExit(5000);

                    if (!string.IsNullOrWhiteSpace(errors))
                    {
                        Console.WriteLine($">> PowerShell errors: {errors}");
                    }

                    if (string.IsNullOrWhiteSpace(output)) 
                    {
                        Console.WriteLine(">> No output from Get-StartApps");
                        return;
                    }

                    // Get-StartApps có thể trả về object hoặc array
                    var appsJson = JsonConvert.DeserializeObject(output);
                    if (appsJson == null) return;

                    var appEntries = new List<dynamic>();
                    if (appsJson is Newtonsoft.Json.Linq.JArray arr)
                    {
                        appEntries.AddRange(arr);
                    }
                    else
                    {
                        appEntries.Add(appsJson);
                    }

                    int uwpCount = 0;
                    foreach (var app in appEntries)
                    {
                        try
                        {
                            string displayName = app?["Name"]?.ToString();
                            string appId = app?["AppID"]?.ToString();

                            if (string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(appId))
                                continue;

                            string appKey = NormalizeAppKey(displayName);
                            if (!installedApps.ContainsKey(appKey))
                            {
                                installedApps[appKey] = new List<dynamic>();
                            }

                            // Kiểm tra duplicate
                            string shellPath = $"shell:AppsFolder\\{appId}";
                            bool alreadyExists = installedApps[appKey].Any(c => c.path == shellPath);
                            if (alreadyExists)
                                continue;

                            uwpCount++;

                            // Match running process if possible để đánh dấu running
                            var matchingProcess = runningProcesses.FirstOrDefault(p =>
                                displayName.Contains(p.ProcessName, StringComparison.OrdinalIgnoreCase) ||
                                p.ProcessName.Contains(displayName, StringComparison.OrdinalIgnoreCase) ||
                                (!string.IsNullOrEmpty(p.MainWindowTitle) &&
                                 p.MainWindowTitle.Contains(displayName, StringComparison.OrdinalIgnoreCase))
                            );

                            if (matchingProcess != null && !string.IsNullOrEmpty(matchingProcess.MainWindowTitle))
                            {
                                installedApps[appKey].Add(new
                                {
                                    id = matchingProcess.Id,
                                    name = displayName,
                                    title = matchingProcess.MainWindowTitle,
                                    memory = GetMemoryUsage(matchingProcess),
                                    status = "running",
                                    path = shellPath
                                });
                            }
                            else
                            {
                                installedApps[appKey].Add(new
                                {
                                    id = 0,
                                    name = displayName,
                                    title = displayName,
                                    memory = "N/A",
                                    status = "stopped",
                                    path = shellPath
                                });
                            }
                        }
                        catch { }
                    }
                    Console.WriteLine($">> Found {uwpCount} UWP/Store apps");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($">> UWP scan failed: {ex.Message}");
            }
        }

        private static void AddAppsFromStartMenu(Dictionary<string, List<dynamic>> installedApps, List<Process> runningProcesses)
        {
            try
            {
                string commonStartMenu = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu) + "\\Programs";
                string userStartMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu) + "\\Programs";

                var menuPaths = new[] { commonStartMenu, userStartMenu };
                var supportedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".lnk", ".appref-ms", ".url" };

                foreach (var menuPath in menuPaths)
                {
                    if (!Directory.Exists(menuPath)) continue;

                    var files = Directory
                        .GetFiles(menuPath, "*.*", SearchOption.AllDirectories)
                        .Where(f => supportedExtensions.Contains(Path.GetExtension(f)))
                        .ToArray();

                    foreach (var file in files)
                    {
                        string fileName = Path.GetFileNameWithoutExtension(file);
                        string loweredName = fileName.ToLower();

                        if (loweredName.Contains("uninstall") ||
                            loweredName.Contains("help") ||
                            loweredName.Contains("readme"))
                            continue;

                        string appKey = NormalizeAppKey(fileName);
                        if (!installedApps.ContainsKey(appKey))
                        {
                            installedApps[appKey] = new List<dynamic>();
                        }

                        // Kiểm tra duplicate
                        bool alreadyExists = installedApps[appKey].Any(c => c.path == file);
                        if (alreadyExists)
                            continue;

                        var matchingProcess = runningProcesses.FirstOrDefault(p =>
                                p.ProcessName.Equals(fileName, StringComparison.OrdinalIgnoreCase) ||
                                (!string.IsNullOrEmpty(p.MainWindowTitle) &&
                                 p.MainWindowTitle.Contains(fileName, StringComparison.OrdinalIgnoreCase))
                            );

                        if (matchingProcess != null && !string.IsNullOrEmpty(matchingProcess.MainWindowTitle))
                        {
                            installedApps[appKey].Add(new
                            {
                                id = matchingProcess.Id,
                                name = fileName,
                                title = matchingProcess.MainWindowTitle,
                                memory = GetMemoryUsage(matchingProcess),
                                status = "running",
                                path = file
                            });
                        }
                        else
                        {
                            installedApps[appKey].Add(new
                            {
                                id = 0,
                                name = fileName,
                                title = fileName,
                                memory = "N/A",
                                status = "stopped",
                                path = file
                            });
                        }
                    }
                }
            }
            catch { }
        }

        private static bool IsBackgroundApp(Process proc)
        {
            {
                try
                {
                    var path = proc.MainModule?.FileName ?? "";
                    if (string.IsNullOrWhiteSpace(path)) return false;

                    var lowerPath = path.ToLower();

                    // Loại bỏ Windows system processes
                    var systemPaths = new[] { "\\windows\\system32", "\\windows\\syswow64", "\\windows\\winsxs" };
                    if (systemPaths.Any(sp => lowerPath.Contains(sp))) return false;

                    // Loại bỏ system services
                    var systemProcesses = new[] { "svchost", "dwm", "csrss", "lsass", "services", "smss", "wininit", "winlogon", "explorer" };
                    if (systemProcesses.Any(sp => proc.ProcessName.Equals(sp, StringComparison.OrdinalIgnoreCase))) return false;

                    // Chỉ lấy apps từ các thư mục user apps
                    // Chỉ cần: là file .exe và KHÔNG nằm trong thư mục hệ thống
                    if (!lowerPath.EndsWith(".exe")) return false;
                    return true; 
                }
                catch
                {
                    return false;
                }
            }
        }

        private static string NormalizeAppKey(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return Guid.NewGuid().ToString();
            
            // Remove common prefixes/suffixes
            var cleaned = raw
                .Replace("Microsoft", "", StringComparison.OrdinalIgnoreCase)
                .Replace("(TM)", "", StringComparison.OrdinalIgnoreCase)
                .Replace("(R)", "", StringComparison.OrdinalIgnoreCase)
                .Trim();
            
            var key = new string(cleaned.Where(char.IsLetterOrDigit).ToArray());
            return key.ToLowerInvariant();
        }

        private static bool IsValidApp(dynamic app)
        {
            try
            {
                string path = app?.path ?? "";
                string name = app?.name ?? "";
                string title = app?.title ?? "";

                // Loại bỏ file extension không phải app
                var invalidExtensions = new[] { ".ini", ".txt", ".log", ".xml", ".json", ".dll", ".config", ".dat", ".tmp" };
                if (invalidExtensions.Any(ext => path.EndsWith(ext, StringComparison.OrdinalIgnoreCase) || 
                                                  name.EndsWith(ext, StringComparison.OrdinalIgnoreCase)))
                {
                    return false;
                }

                // Loại bỏ nếu path là folder (không có extension và không bắt đầu bằng shell:)
                if (!string.IsNullOrWhiteSpace(path) && 
                    !path.StartsWith("shell:", StringComparison.OrdinalIgnoreCase) &&
                    !path.Contains(".") &&
                    Directory.Exists(path))
                {
                    return false;
                }

                // Loại bỏ nếu name hoặc title chứa đường dẫn folder đầy đủ
                if (title.Contains("\\") && title.Contains(":") && !title.Contains(".exe", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                // Loại bỏ Windows system processes
                var lowerPath = path.ToLower();
                var systemPaths = new[] { "\\windows\\system32", "\\windows\\syswow64", "\\windows\\winsxs" };
                if (systemPaths.Any(sp => lowerPath.Contains(sp)))
                {
                    return false;
                }

                // Loại bỏ system process names
                var lowerName = name.ToLower();
                var systemNames = new[] { "svchost", "dwm", "csrss", "lsass", "services", "smss", "wininit", "winlogon", 
                                         "conhost", "fontdrvhost", "taskhostw", "rundll32", "dllhost" };
                if (systemNames.Any(sn => lowerName == sn))
                {
                    return false;
                }

                // Chỉ chấp nhận nếu:
                // 1. Có path .exe, .lnk, .appref-ms, .url hoặc shell:AppsFolder
                // 2. Hoặc là running process (có ID > 0)
                var validExtensions = new[] { ".exe", ".lnk", ".appref-ms", ".url" };
                bool hasValidPath = validExtensions.Any(ext => path.EndsWith(ext, StringComparison.OrdinalIgnoreCase)) ||
                                   path.StartsWith("shell:", StringComparison.OrdinalIgnoreCase);
                bool isRunning = app.id > 0;

                return hasValidPath || isRunning;
            }
            catch
            {
                return false;
            }
        }

        private static string ResolveExecutablePath(string installLocation, string displayIcon, string uninstallString)
        {
            // Prefer explicit paths from registry values first
            var candidate = ExtractExePath(displayIcon);
            if (!string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate)) return candidate;

            candidate = ExtractExePath(uninstallString);
            if (!string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate)) return candidate;

            // Fallback: try the install folder and pick the largest exe in root
            if (!string.IsNullOrWhiteSpace(installLocation) && Directory.Exists(installLocation))
            {
                try
                {
                    var exe = Directory.GetFiles(installLocation, "*.exe", SearchOption.TopDirectoryOnly)
                        .OrderByDescending(f => new FileInfo(f).Length)
                        .FirstOrDefault();
                    if (!string.IsNullOrWhiteSpace(exe)) return exe;
                }
                catch { }
            }

            return string.Empty;
        }

        private static string ExtractExePath(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

            var cleaned = raw.Split(',')[0].Trim().Trim('"');
            int exeIdx = cleaned.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
            if (exeIdx >= 0)
            {
                cleaned = cleaned.Substring(0, exeIdx + 4);
            }

            return cleaned;
        }

        // Lấy danh sách tất cả tiến trình hiện tại
        internal static object GetCurrentProcesses()
        {
            // Lấy danh sách toàn bộ tiến trình
            return Process.GetProcesses()
                .Select(p => new {
                    id = p.Id,
                    name = p.ProcessName,
                    memory = GetMemoryUsage(p)
                })
                .OrderByDescending(p => p.id)
                .ToList();
        }

        private static string GetMemoryUsage(Process process)
        {
            try
            {
                double memoryMb = process.WorkingSet64 / 1048576.0;
                return string.Format(CultureInfo.InvariantCulture, "{0:F1} MB", memoryMb);
            }
            catch
            {
                return "N/A";
            }
        }

        // 1. Thêm hàm lấy danh sách Shortcut trong Start Menu
        // Lấy danh sách shortcut (ứng dụng) trong Start Menu của Windows
        internal static object GetInstalledApps()
        {
            var apps = new List<object>();
            try
            {
                // Đường dẫn đến Start Menu chung của máy tính
                string commonStartMenu = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu) + "\\Programs";
                
                // Lấy tất cả file .lnk (shortcut)
                // SearchOption.AllDirectories: Quét cả thư mục con
                var files = Directory.GetFiles(commonStartMenu, "*.lnk", SearchOption.AllDirectories);

                foreach (var file in files)
                {
                    string fileName = Path.GetFileNameWithoutExtension(file);
                    
                    if (!fileName.ToLower().Contains("uninstall") && 
                        !fileName.ToLower().Contains("help") && 
                        !fileName.ToLower().Contains("readme"))
                    {
                        apps.Add(new { name = fileName, path = file });
                    }
                }
            }
            catch { } // Bỏ qua lỗi nếu không truy cập được thư mục
            return apps.OrderBy(x => ((dynamic)x).name).ToList();
        }

        // Bắt đầu khởi tạo WebSocket Server, đăng ký sự kiện và thread stream
        public static void Start(string url)
        {
            SystemHelper.InitCounters();
            _sessionPassword = new Random().Next(100000, 999999).ToString();

            // In ra Console thật nổi bật
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("=================================================");
            Console.WriteLine($"   REMOTE CONTROL SERVER IS RUNNING");
            Console.WriteLine($"   URL: {url}");
            Console.WriteLine($"   >> YOUR OTP PASSWORD: {_sessionPassword} <<");
            Console.WriteLine("=================================================");
            Console.ResetColor();

            var server = new WebSocketServer(url);
            server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    Console.WriteLine(">> Client kết nối!");
                    SocketManager.Add(socket);
                };
                socket.OnClose = () =>
                {
                    Console.WriteLine(">> Client ngắt kết nối!");
                    SocketManager.Remove(socket);
                    if (SocketManager.All.Count == 0) StreamManager.StopStreaming();
                };
                socket.OnMessage = message => HandleClientCommand(socket, message);
            });

            Console.WriteLine($">> Server đang chạy tại {url}");

            // 1. Xử lý Stream ảnh
            WebcamManager.OnFrameCaptured += (imgBytes) => {
                SocketManager.BroadcastBinary(0x02, imgBytes);
            };

            // Audio kèm webcam
            WebcamManager.OnAudioCaptured += (pcmBytes) => {
                SocketManager.BroadcastBinary(0x03, pcmBytes);
            };

            // Live audio stream (system audio capture from mic)
            // Dùng cho cả tab Audio và Screen Monitor audio
            AudioManager.OnAudioCaptured += (pcmBytes) => {
                try
                {
                    // Prepend a 4-byte UTC timestamp (ms since epoch, little-endian)
                    uint tsMs = (uint)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    var payload = new byte[4 + (pcmBytes?.Length ?? 0)];
                    payload[0] = (byte)(tsMs & 0xFF);
                    payload[1] = (byte)((tsMs >> 8) & 0xFF);
                    payload[2] = (byte)((tsMs >> 16) & 0xFF);
                    payload[3] = (byte)((tsMs >> 24) & 0xFF);
                    if (pcmBytes != null && pcmBytes.Length > 0)
                        Buffer.BlockCopy(pcmBytes, 0, payload, 4, pcmBytes.Length);

                    // Header 0x04 then [timestamp(4) + pcm]
                    SocketManager.BroadcastBinary(0x04, payload);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Audio timestamp pack error: {ex.Message}");
                    // Fallback: send raw PCM if packing fails
                    SocketManager.BroadcastBinary(0x04, pcmBytes);
                }
            };

            // Xử lý khi Webcam ghi hình xong -> Gửi file về Client
            WebcamManager.OnVideoSaved += (filePath) => {
                Task.Run(() => {
                    try 
                    {
                        // Quan trọng: Đợi 1 giây để chắc chắn file đã được đóng hoàn toàn (tránh lỗi file đang được sử dụng)
                        Thread.Sleep(1000); 

                        if (File.Exists(filePath))
                        {
                            Console.WriteLine(">> Đang gửi video webcam về Client...");
                            byte[] fileBytes = File.ReadAllBytes(filePath);
                            string base64File = Convert.ToBase64String(fileBytes);
                            
                            // Gửi với type "VIDEO_FILE" để khớp với code Client (webcam.js)
                            SocketManager.BroadcastJson("VIDEO_FILE", base64File);
                            SocketManager.BroadcastJson("LOG", $"Đã tải video webcam ({fileBytes.Length / 1024} KB)!");

                            // Xóa file tạm sau khi gửi xong
                            File.Delete(filePath);
                        }
                        else
                        {
                            SocketManager.BroadcastJson("LOG", "Lỗi: Không tìm thấy file video webcam.");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("❌ Lỗi gửi file Webcam: " + ex.Message);
                        SocketManager.BroadcastJson("LOG", "Lỗi gửi file webcam: " + ex.Message);
                    }
                });
            };

            // 2. Xử lý Gửi File Video
            StreamManager.OnScreenVideoSaved += (filePath) => {
                Task.Run(() => {
                    try 
                    {
                        // --- THÊM DÒNG NÀY ---
                        // Đợi 1 giây để chắc chắn OpenCV đã đóng file hoàn toàn
                        Thread.Sleep(1000); 
                        // ---------------------

                        if (File.Exists(filePath))
                        {
                            Console.WriteLine(">> Đang gửi video màn hình về Client...");
                            byte[] fileBytes = File.ReadAllBytes(filePath); // Dòng này hay bị lỗi nếu không có Delay
                            string base64File = Convert.ToBase64String(fileBytes);
                            
                            SocketManager.BroadcastJson("SCREEN_RECORD_FILE", base64File);
                            SocketManager.BroadcastJson("LOG", $"Đã tải video màn hình ({fileBytes.Length / 1024} KB)!");

                            File.Delete(filePath);
                        }
                        else 
                        {
                            Console.WriteLine("❌ Lỗi: Không tìm thấy file video để gửi."); // Log thêm để debug
                        }
                    }
                    catch (Exception ex)
                    {
                        // Log lỗi ra Console Server để bạn dễ thấy
                        Console.WriteLine("❌ Lỗi gửi file Video: " + ex.Message); 
                        SocketManager.BroadcastJson("LOG", "Lỗi ServerCore: " + ex.Message);
                    }
                });
            };

            AudioManager.OnAudioSaved += (filePath) => {
                Task.Run(() => {
                    try 
                    {
                        if (File.Exists(filePath))
                        {
                            // Console.WriteLine(">> Đang gửi file ghi âm về Client...");
                            byte[] fileBytes = File.ReadAllBytes(filePath);
                            string base64File = Convert.ToBase64String(fileBytes);
                            
                            // Gửi về client với type AUDIO_RECORD_FILE
                            SocketManager.BroadcastJson("AUDIO_RECORD_FILE", base64File);
                            // SocketManager.BroadcastJson("LOG", $"Đã tải file ghi âm ({fileBytes.Length / 1024} KB)!");

                            // Xóa file tạm
                            File.Delete(filePath);
                        }
                    }
                    catch (Exception ex)
                    {
                        SocketManager.BroadcastJson("LOG", "Lỗi gửi file audio: " + ex.Message);
                    }
                });
            };

            // Khởi chạy vòng lặp gửi Stream ở lớp StreamManager
            StreamManager.StartScreenLoop();
        }

        #region Command Handlers (Hàm xử lý các lệnh từ client)

        // Xử lý xác thực (AUTH)
        private static void HandleAuth(IWebSocketConnection socket, WebPacket packet)
        {
            if (packet.payload == _sessionPassword)
            {
                SocketManager.SendJson(socket, "AUTH_RESULT", "OK");
                Console.WriteLine("-> Client đăng nhập thành công!");
            }
            else
            {
                SocketManager.SendJson(socket, "AUTH_RESULT", "FAIL");
                Console.WriteLine("-> Client sai mật khẩu!");
            }
        }

        // Các hàm xử lý khác (đổi tên, xóa, upload) đã được tách sang CommandHandler.cs

        #endregion

        // Xử lý mọi gói lệnh từ client (AUTH, COMMANDS...)
        private static void HandleClientCommand(IWebSocketConnection socket, string jsonMessage)
        {
            try
            {
                var packet = JsonConvert.DeserializeObject<WebPacket>(jsonMessage);

                // 1. Auth
                if (packet?.type == "AUTH")
                {
                    HandleAuth(socket, packet);
                    return;
                }

                // 2. Delegate bất kỳ command nào cho CommandRouter
                if (!string.IsNullOrEmpty(packet?.command))
                {
                    CommandRouter.ProcessCommand(socket, packet);
                }
            }
            catch (Exception ex) { Console.WriteLine("Lỗi Handle: " + ex.Message); }
        }
    }
}