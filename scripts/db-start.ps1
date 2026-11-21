# Starts the project's local PostgreSQL 18 cluster on port 5433 (created during setup).
$bin = "C:\Program Files\PostgreSQL\18\bin"
$data = "$env:LOCALAPPDATA\ocr-pgdata"
& "$bin\pg_ctl.exe" -D $data status *> $null
if ($LASTEXITCODE -eq 0) { Write-Output "PostgreSQL already running on 5433"; exit 0 }
& "$bin\pg_ctl.exe" -D $data -o "-p 5433" -l "$data\server.log" start
