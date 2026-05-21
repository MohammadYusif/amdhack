# Mihan Demo — start backend + frontend
# Run from: C:\Users\Psycho\Downloads\tester\mihan\

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting Mihan backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$root\backend'; python -m uvicorn main:app --reload --port 9000"

Start-Sleep -Seconds 2

Write-Host "Starting Mihan frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Mihan is starting up:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:9000" -ForegroundColor White
Write-Host "  API docs: http://localhost:9000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop." -ForegroundColor Gray
