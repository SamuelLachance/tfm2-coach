Set-Location $PSScriptRoot
python scripts/parse_champions.py
python scripts/compute_matchups.py
Write-Host ""
Write-Host "TFM2 Coach: http://localhost:8080" -ForegroundColor Green
Write-Host "Ctrl+C pour arreter" -ForegroundColor DarkGray
python -m http.server 8080 --directory public
