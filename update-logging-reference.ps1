# Script to update Server logging calls
# This script will update various Console.WriteLine patterns to use Logger

$serverPath = "c:\Hoàng Nhật\Cơ sở ngành\MMT\Final\ComputerNetworkingProj\Server"

# Map of old patterns to new Logger calls
$replacements = @{
    'Console.WriteLine\(\$">> Client kết nối!"\)' = 'Logger.ClientAction("Client kết nối!")' 
    'Console.WriteLine\(\$">> Client ngắt kết nối!"\)' = 'Logger.ClientAction("Client ngắt kết nối!")'
    'Console.WriteLine\(\$">> (.*?)"\)' = 'Logger.Info("$1")'
    'Console.WriteLine\(">> (.*?)"\)' = 'Logger.Info("$1")'
    'Console.WriteLine\(\$"❌ (.*?)"\)' = 'Logger.Error("$1")'
    'Console.WriteLine\("❌ (.*?)"\)' = 'Logger.Error("$1")'
    'Console.WriteLine\(\$"✅ (.*?)"\)' = 'Logger.Success("$1")'
    'Console.WriteLine\("✅ (.*?)"\)' = 'Logger.Success("$1")'
    'Console.WriteLine\(\$"\[CMD\]: (.*?)"\)' = 'Logger.Command("$1")'
    'Console.WriteLine\("-> Client đăng nhập thành công!"\)' = 'Logger.Success("Client đăng nhập thành công!")'
    'Console.WriteLine\("-> Client sai mật khẩu!"\)' = 'Logger.Warning("Client sai mật khẩu!")'
}

Write-Host "This is a reference script for updating Logger calls"
Write-Host "Server files are located at: $serverPath"
Write-Host ""
Write-Host "Key Logger methods to use:"
Write-Host "  Logger.Info(message)          - ℹ️  Information"
Write-Host "  Logger.Success(message)       - ✅ Success"
Write-Host "  Logger.Error(message)         - ❌ Error"
Write-Host "  Logger.Warning(message)       - ⚠️  Warning"
Write-Host "  Logger.ClientAction(message)  - 🖥️  Client action"
Write-Host "  Logger.Command(command, param) - 🔧 Command"
Write-Host "  Logger.FileOperation(op, path) - 📁 File operations"
Write-Host "  Logger.MediaOperation(op, details) - 🎬 Media operations"
Write-Host "  Logger.Network(message)       - 🌐 Network operations"
