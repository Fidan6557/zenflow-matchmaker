$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$recordPath = Join-Path $projectRoot '.zen-flow\processes.json'
if (-not (Test-Path -LiteralPath $recordPath)) { Write-Output 'No processes started by scripts/start.ps1 were recorded.'; exit 0 }
$records = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $recordedProcess = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($recordedProcess -and ($recordedProcess.StartTime.ToUniversalTime().ToString('o') -eq $record.started)) {
        # The Windows virtual-environment Python launcher can have a child
        # interpreter. Stop only this verified recorded process and its tree.
        & taskkill.exe /PID $recordedProcess.Id /T /F | Out-Null
        Write-Output ('Stopped demo process ' + $recordedProcess.Id)
    }
}
Remove-Item -LiteralPath $recordPath
