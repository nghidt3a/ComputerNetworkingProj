using System;
using RemoteControlServer.Core;
using RemoteControlServer.Services;
using RemoteControlServer.Helpers;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Security.Principal;



namespace RemoteControlServer
{
    /// <summary>
    /// Program entry point for the Remote Control Server application.
    /// It configures Windows DPI settings and starts the ServerCore.
    /// </summary>
    class Program
    {
        [DllImport("shcore.dll")]
        private static extern int SetProcessDpiAwareness(int processDpiAwareness);
        private const int PROCESS_PER_MONITOR_DPI_AWARE = 2;

        // Kiểm tra xem process chạy với quyền Administrator
        private static bool IsRunAsAdmin()
        {
            try
            {
                WindowsIdentity identity = WindowsIdentity.GetCurrent();
                WindowsPrincipal principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }

        [STAThread] // Required for Windows UI components used by helpers (SendKeys/Forms)
        static void Main(string[] args)
        {
            // Nếu không chạy với admin, tự động restart với quyền admin
            if (!IsRunAsAdmin())
            {
                try
                {
                    ProcessStartInfo proc = new ProcessStartInfo();
                    proc.UseShellExecute = true;
                    proc.FileName = Process.GetCurrentProcess().MainModule.FileName;
                    proc.Verb = "runas";
                    Process.Start(proc);
                    Environment.Exit(0);
                }
                catch (Exception ex)
                {
                    Logger.Error($"Không thể elevate: {ex.Message}");
                    System.Windows.Forms.MessageBox.Show("Server cần quyền Administrator để chạy tất cả các tính năng.\n\nLỗi: " + ex.Message, "Yêu cầu quyền", System.Windows.Forms.MessageBoxButtons.OK, System.Windows.Forms.MessageBoxIcon.Warning);
                    Environment.Exit(1);
                }
            }

            try {
                Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            } catch { }

            try {
                SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
            } catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "RCS Agent Core - Port 8181";

            // 1. Khởi chạy Server (WebSocket chạy ngầm, không chặn luồng chính)
            try
            {
                // Start the WebSocket server loop in ServerCore (runs in background threads).
                ServerCore.Start("ws://0.0.0.0:8181");
            }
            catch (Exception ex)
            {
                Logger.Error($"Lỗi khởi tạo Server: {ex.Message}");
                Logger.Info("Kiểm tra xem file ServerCore.cs đã đúng namespace chưa.");
                Console.ReadLine();
                return;
            }

            // 3. Giữ ứng dụng luôn chạy (Message Loop)
            // Lệnh này giúp Keylogger hoạt động và Server không bị tắt
            Application.Run();
        }
    }
}