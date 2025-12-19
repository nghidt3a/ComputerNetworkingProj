using System;

namespace RemoteControlServer.Helpers
{
    /// <summary>
    /// Centralized logging for Server with consistent formatting and prefixes
    /// </summary>
    public static class Logger
    {
        private const string SERVER_PREFIX = "[⚙️  SERVER]";
        private const string CLIENT_PREFIX = "[🖥️  CLIENT]";
        private const string SUCCESS_SYMBOL = "✅";
        private const string ERROR_SYMBOL = "❌";
        private const string WARNING_SYMBOL = "⚠️";
        private const string INFO_SYMBOL = "ℹ️";
        private const string ARROW_SYMBOL = "→";

        /// <summary>Log informational message from Server</summary>
        public static void Info(string message)
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"{SERVER_PREFIX} {INFO_SYMBOL} {message}");
            Console.ResetColor();
        }

        /// <summary>Log success message</summary>
        public static void Success(string message)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"{SERVER_PREFIX} {SUCCESS_SYMBOL} {message}");
            Console.ResetColor();
        }

        /// <summary>Log error message</summary>
        public static void Error(string message)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"{SERVER_PREFIX} {ERROR_SYMBOL} {message}");
            Console.ResetColor();
        }

        /// <summary>Log warning message</summary>
        public static void Warning(string message)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"{SERVER_PREFIX} {WARNING_SYMBOL} {message}");
            Console.ResetColor();
        }

        /// <summary>Log Client action/connection (for server logs about client activity)</summary>
        public static void ClientAction(string message)
        {
            Console.ForegroundColor = ConsoleColor.Magenta;
            Console.WriteLine($"{CLIENT_PREFIX} {ARROW_SYMBOL} {message}");
            Console.ResetColor();
        }

        /// <summary>Log command being processed</summary>
        public static void Command(string command, string param = "")
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            string paramStr = string.IsNullOrEmpty(param) ? "" : $" | {param}";
            Console.WriteLine($"{SERVER_PREFIX} 🔧 [CMD] {command}{paramStr}");
            Console.ResetColor();
        }

        /// <summary>Log file operation</summary>
        public static void FileOperation(string operation, string path)
        {
            Console.ForegroundColor = ConsoleColor.Blue;
            Console.WriteLine($"{SERVER_PREFIX} 📁 {operation}: {path}");
            Console.ResetColor();
        }

        /// <summary>Log video/audio operation</summary>
        public static void MediaOperation(string operation, string details = "")
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            string detailsStr = string.IsNullOrEmpty(details) ? "" : $" - {details}";
            Console.WriteLine($"{SERVER_PREFIX} 🎬 {operation}{detailsStr}");
            Console.ResetColor();
        }

        /// <summary>Log network operation</summary>
        public static void Network(string message)
        {
            Console.ForegroundColor = ConsoleColor.DarkCyan;
            Console.WriteLine($"{SERVER_PREFIX} 🌐 {message}");
            Console.ResetColor();
        }

        /// <summary>Log important separator line</summary>
        public static void Separator()
        {
            Console.WriteLine("═════════════════════════════════════════════════════");
        }

        /// <summary>Log header with important information</summary>
        public static void Header(string title)
        {
            Console.ForegroundColor = ConsoleColor.White;
            Console.WriteLine();
            Separator();
            Console.WriteLine($"   {title}");
            Separator();
            Console.ResetColor();
        }
    }
}
