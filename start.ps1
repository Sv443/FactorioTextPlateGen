npm start

if ($LASTEXITCODE -ne 0) {
  Write-Host "`nApplication closed with error code $LASTEXITCODE" -ForegroundColor Red
  Write-Host "Press any key to exit..." -ForegroundColor Yellow
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
