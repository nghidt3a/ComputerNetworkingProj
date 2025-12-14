# ============================================
# QUICK FIX SCRIPT FOR TESTNEWWEB
# Áp dụng các fixes cần thiết để khôi phục chức năng
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TestNewWeb Quick Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = "d:\Documents\HCMUS-Lecture\Computer Networking\Project\Final_Project\TestNewWeb"
$clientPath = "$projectPath\Client"

# Function to backup file
function Backup-File {
    param($filePath)
    if (Test-Path $filePath) {
        $backupPath = "$filePath.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $filePath $backupPath
        Write-Host "  [✓] Backed up: $filePath" -ForegroundColor Green
        return $true
    }
    return $false
}

# Function to check if line exists in file
function Test-LineInFile {
    param($filePath, $searchText)
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        return $content -like "*$searchText*"
    }
    return $false
}

Write-Host "[1/5] Checking files..." -ForegroundColor Yellow
Write-Host ""

# Check if files exist
$indexPath = "$clientPath\index.html"
$mainJsPath = "$clientPath\js\main.js"
$fixesCssPath = "$clientPath\css\fixes.css"
$simpleNavPath = "$clientPath\js\navigation-simple.js"

if (-not (Test-Path $indexPath)) {
    Write-Host "  [✗] index.html not found!" -ForegroundColor Red
    exit
}

if (-not (Test-Path $mainJsPath)) {
    Write-Host "  [✗] main.js not found!" -ForegroundColor Red
    exit
}

Write-Host "  [✓] Core files found" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 1: Add fixes.css to index.html
# ============================================
Write-Host "[2/5] Adding fixes.css to index.html..." -ForegroundColor Yellow

if (Test-LineInFile $indexPath "fixes.css") {
    Write-Host "  [!] fixes.css already linked in index.html" -ForegroundColor Yellow
} else {
    Backup-File $indexPath
    
    $indexContent = Get-Content $indexPath -Raw
    
    # Find the line with soft-ui-base.css and add fixes.css after it
    $pattern = '(<link rel="stylesheet" href="css/soft-ui-base\.css" />)'
    $replacement = '$1' + "`n    <link rel=`"stylesheet`" href=`"css/fixes.css`" />"
    
    $newContent = $indexContent -replace $pattern, $replacement
    
    if ($newContent -ne $indexContent) {
        Set-Content $indexPath $newContent -NoNewline
        Write-Host "  [✓] fixes.css linked successfully" -ForegroundColor Green
    } else {
        Write-Host "  [!] Could not auto-link fixes.css. Add manually after soft-ui-base.css" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# STEP 2: Create main.js backup and add debug
# ============================================
Write-Host "[3/5] Preparing main.js debug version..." -ForegroundColor Yellow

Backup-File $mainJsPath

Write-Host "  [✓] main.js backed up" -ForegroundColor Green
Write-Host "  [!] You need to manually edit main.js to:" -ForegroundColor Yellow
Write-Host "      1. Import navigation-simple.js" -ForegroundColor Gray
Write-Host "      2. Replace setupNavigation() with setupSimpleNavigation()" -ForegroundColor Gray
Write-Host "      3. Or add console.log statements to debug" -ForegroundColor Gray
Write-Host ""

# ============================================
# STEP 3: Verify fixes.css exists
# ============================================
Write-Host "[4/5] Verifying fixes.css..." -ForegroundColor Yellow

if (Test-Path $fixesCssPath) {
    $fileSize = (Get-Item $fixesCssPath).Length
    Write-Host "  [✓] fixes.css exists ($fileSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  [✗] fixes.css not found!" -ForegroundColor Red
    Write-Host "      Please ensure fixes.css is in Client/css/ folder" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# STEP 4: Verify navigation-simple.js exists
# ============================================
Write-Host "[5/5] Verifying navigation-simple.js..." -ForegroundColor Yellow

if (Test-Path $simpleNavPath) {
    $fileSize = (Get-Item $simpleNavPath).Length
    Write-Host "  [✓] navigation-simple.js exists ($fileSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  [✗] navigation-simple.js not found!" -ForegroundColor Red
    Write-Host "      Please ensure navigation-simple.js is in Client/js/ folder" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# SUMMARY & NEXT STEPS
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Application Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Files Created/Modified:" -ForegroundColor White
Write-Host "  ✓ Client/css/fixes.css" -ForegroundColor Green
Write-Host "  ✓ Client/js/navigation-simple.js" -ForegroundColor Green
Write-Host "  ✓ Client/index.html (fixes.css linked)" -ForegroundColor Green
Write-Host "  ✓ Backups created for modified files" -ForegroundColor Green
Write-Host ""

Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Edit Client/js/main.js:" -ForegroundColor White
Write-Host "   Add at top:" -ForegroundColor Gray
Write-Host "   import { setupSimpleNavigation } from './navigation-simple.js';" -ForegroundColor Cyan
Write-Host ""
Write-Host "   In DOMContentLoaded, replace:" -ForegroundColor Gray
Write-Host "   setupNavigation();" -ForegroundColor Red
Write-Host "   with:" -ForegroundColor Gray
Write-Host "   setupSimpleNavigation();" -ForegroundColor Green
Write-Host ""

Write-Host "2. Test the application:" -ForegroundColor White
Write-Host "   - Open Client/index.html in browser" -ForegroundColor Gray
Write-Host "   - Open Developer Console (F12)" -ForegroundColor Gray
Write-Host "   - Connect to server" -ForegroundColor Gray
Write-Host "   - Check console for debug messages" -ForegroundColor Gray
Write-Host "   - Test navigation between tabs" -ForegroundColor Gray
Write-Host ""

Write-Host "3. If navigation works:" -ForegroundColor White
Write-Host "   Problem was animations → Keep simple navigation" -ForegroundColor Gray
Write-Host ""

Write-Host "4. If navigation still broken:" -ForegroundColor White
Write-Host "   Run in console: window.debugNavigation()" -ForegroundColor Gray
Write-Host "   Check RESTORATION_PLAN.md for deeper fixes" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Additional Resources" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📄 Full Plan: RESTORATION_PLAN.md" -ForegroundColor White
Write-Host "🔧 CSS Fixes: Client/css/fixes.css" -ForegroundColor White
Write-Host "🔍 Debug Nav: Client/js/navigation-simple.js" -ForegroundColor White
Write-Host "💾 Backups: *.backup_* files" -ForegroundColor White
Write-Host ""

Write-Host "Good luck! 🍀" -ForegroundColor Green
Write-Host ""
