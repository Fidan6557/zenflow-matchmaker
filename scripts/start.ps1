$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$nodePath = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Install the Python dependencies first; see README.md.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\vite\bin\vite.js'))) { throw 'Run npm ci first.' }

$listening = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(8000, 5173) })
if ($listening.Count -gt 0) {
    if (($listening.LocalPort -contains 8000) -and ($listening.LocalPort -contains 5173)) {
        Write-Output 'Both demo ports are already listening. Open http://127.0.0.1:5173 (API: http://127.0.0.1:8000/docs).'
        exit 0
    }
    throw 'Port 8000 or 5173 is already in use. Stop that server or use the two-terminal instructions in README.md.'
}

$logRoot = Join-Path $projectRoot '.zen-flow'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$backendProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'backend.app:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'backend.log') -RedirectStandardError (Join-Path $logRoot 'backend-error.log') -PassThru
try {
    $frontendProcess = Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'frontend.log') -RedirectStandardError (Join-Path $logRoot 'frontend-error.log') -PassThru
} catch {
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    throw
}
@($backendProcess, $frontendProcess) | ForEach-Object { @{ pid = $_.Id; started = $_.StartTime.ToUniversalTime().ToString('o') } } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'processes.json') -Encoding utf8
Write-Output 'Zen-Flow starting: http://127.0.0.1:5173'
Write-Output 'API documentation: http://127.0.0.1:8000/docs'
Write-Output 'Logs: .zen-flow/ | Stop with .\scripts\stop.ps1'
