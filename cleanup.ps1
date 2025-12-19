# =================================================================
# SCRIPT DỌN DẸP PROJECT - ComputerNetworkingProj
# Tác giả: Gemini Code Assist
# Chức năng: Tìm và xóa các file tài liệu (.md) và file backup
#            dư thừa để làm sạch cây thư mục project.
# PHIÊN BẢN SỬA LỖI: Cải thiện logic tìm kiếm và đảm bảo cú pháp.
 #=================================================================

# Lấy đường dẫn thư mục gốc của project (nơi script này được chạy)
$projectRoot = $PSScriptRoot

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  🚀 Bắt đầu dọn dẹp project tại:" -ForegroundColor Cyan
Write-Host "  $projectRoot"
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# --- DANH SÁCH CÁC FILE CẦN XÓA ---

# 1. Các file tài liệu Markdown cụ thể đã được xác định là dư thừa
$redundantDocs = @(
    "CONSOLE_LOGGING_IMPROVEMENTS.md",
    "FILE_MANAGER_FEATURES.md",
    "LOGGING_GUIDE.md",
    "LOGGER_QUICK_REFERENCE.md",
    "RESTORATION_PLAN.md"
    # Thêm các file .md cụ thể khác vào đây nếu cần
)

# 2. Các file theo mẫu (pattern) - ví dụ: các file backup và các file log phụ
$redundantPatterns = @(
    "*.backup_*",          # Các file backup tạo bởi script apply-quick-fixes.ps1
    "LOGGING_*.md",        # Các file tài liệu phụ về logging
    "CONSOLE_OUTPUT_DEMO.md",
    "DOCUMENTATION_INDEX.md"
)

# --- TÌM KIẾM FILE (LOGIC ĐÃ CẢI TIẾN) ---

Write-Host "[1/3] 🔍 Đang tìm kiếm các file dư thừa..." -ForegroundColor Yellow

$filesToDelete = New-Object System.Collections.Generic.List[System.IO.FileInfo]
$allPatternsToSearch = $redundantDocs + $redundantPatterns

# Gộp 2 vòng lặp tìm kiếm thành một để code gọn hơn
foreach ($pattern in $allPatternsToSearch) {
    $foundFiles = Get-ChildItem -Path $projectRoot -Filter $pattern -Recurse -ErrorAction SilentlyContinue
    if ($null -ne $foundFiles) {
        $filesToDelete.AddRange($foundFiles)
    }
}

# Loại bỏ các file trùng lặp nếu có
$uniqueFilesToDelete = $filesToDelete | Sort-Object -Property FullName -Unique

Write-Host ""

# --- XÁC NHẬN VÀ XÓA ---

# Đảm bảo biến là mảng để đếm chính xác
$filesToDeleteArray = @($uniqueFilesToDelete)

if ($filesToDeleteArray.Count -eq 0) {
    Write-Host "[2/3] ✅ Không tìm thấy file dư thừa nào. Project của bạn đã sạch!" -ForegroundColor Green
    exit
}

Write-Host "[2/3] ❗ Đã tìm thấy $($filesToDeleteArray.Count) file sau đây để xóa:" -ForegroundColor Yellow

# Liệt kê các file sẽ bị xóa
foreach ($file in $filesToDeleteArray) {
    $relativePath = $file.FullName.Replace($projectRoot, '.\')
    Write-Host "  - $relativePath" -ForegroundColor Gray
}

Write-Host ""
$confirmation = Read-Host "❓ Bạn có chắc chắn muốn xóa tất cả các file này không? (Y/N)"

if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host ""
    Write-Host "[3/3] 🛑 Đã hủy bỏ. Không có file nào bị xóa." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "[3/3] 🗑️ Đang tiến hành xóa..." -ForegroundColor Yellow

foreach ($file in $filesToDeleteArray) {
    try {
        Remove-Item -Path $file.FullName -Force -ErrorAction Stop
        Write-Host "  [✓] Đã xóa: $($file.Name)" -ForegroundColor Green
    } catch {
        Write-Host "  [✗] Lỗi khi xóa: $($file.Name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Hoàn tất! Đã dọn dẹp thành công." -ForegroundColor Green

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Script dọn dẹp đã kết thúc." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan