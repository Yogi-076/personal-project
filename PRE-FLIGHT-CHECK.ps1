# VajraScan Pre-Flight Check
# Verifies all system dependencies are installed and accessible in PATH.

$Tools = @(
    @{ Name = "Node.js"; Cmd = "node -v" },
    @{ Name = "Nmap"; Cmd = "nmap --version" },
    @{ Name = "Subfinder"; Cmd = "subfinder -version" },
    @{ Name = "Katana"; Cmd = "katana -version" },
    @{ Name = "Wapiti"; Cmd = "wapiti --version" },
    @{ Name = "Retire.js"; Cmd = "npx retire --version" }
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VajraScan Environment Diagnostics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$Missing = 0

foreach ($Tool in $Tools) {
    Write-Host "Checking $($Tool.Name)... " -NoNewline
    try {
        $out = Invoke-Expression $Tool.Cmd 2>&1
        if ($LASTEXITCODE -eq 0 -or $out -match "v\d+" -or $out -match "\d+\.\d+") {
            Write-Host "OK" -ForegroundColor Green
        }
        else {
            throw "Error"
        }
    }
    catch {
        # Fallback for Wapiti in local Python path
        if ($Tool.Name -eq "Wapiti") {
            $LocalWapiti = "C:\Users\$($env:USERNAME)\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\LocalCache\local-packages\Python311\Scripts\wapiti.exe"
            if (Test-Path $LocalWapiti) {
                Write-Host "OK (Local Path)" -ForegroundColor Green
                continue
            }
        }
        Write-Host "MISSING" -ForegroundColor Red
        $Missing++
    }
}

Write-Host "`n----------------------------------------"
if ($Missing -eq 0) {
    Write-Host "✅ All dependencies found. System is ready!" -ForegroundColor Green
}
else {
    Write-Host "⚠️ $Missing dependencies are missing or not in PATH." -ForegroundColor Yellow
    Write-Host "Please install them to ensure full scan coverage." -ForegroundColor Cyan
}
Write-Host "----------------------------------------`n"
