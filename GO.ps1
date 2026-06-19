Set-Location -LiteralPath $PSScriptRoot
node .\scripts\contract-go.js @args
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[LOI] OmniSuite chua khoi dong duoc. Thu chay: .\GO.ps1 --repair" -ForegroundColor Red
  Read-Host "Nhan Enter de thoat"
}
