$ErrorActionPreference = "Continue"
$dir = "c:\Users\profs\Documents\Hermes\hermes-hub"
$tsx = "$dir\node_modules\.bin\tsx.cmd"

# Restart strategy:
#  - Backoff: 3s → 6s → 12s → 30s → 60s → 120s → 300s (cap)
#  - Crash tracking: if >20 crashes in 1 hour, pause 10 min and reset
#  - Healthy run: if process ran >60s, treat as recovered and reset backoff

Write-Host "[Hermes] Keep-alive watchdog started"
Set-Location $dir

$backoff = 3
$crashTimestamps = @()
$maxCrashesPerHour = 20

while ($true) {
    $startTime = Get-Date
    Write-Host "[Hermes] $(Get-Date -Format 'HH:mm:ss') Starting server..."

    & $tsx "$dir\server.ts"

    $runDuration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "[Hermes] $(Get-Date -Format 'HH:mm:ss') Server exited after $([int]$runDuration)s"

    # Healthy run resets backoff
    if ($runDuration -gt 60) {
        $backoff = 3
        Write-Host "[Hermes] Healthy run — backoff reset to 3s"
    }

    # Crash storm protection
    $crashTimestamps += (Get-Date)
    $crashTimestamps = $crashTimestamps | Where-Object { ((Get-Date) - $_).TotalHours -lt 1 }

    if ($crashTimestamps.Count -gt $maxCrashesPerHour) {
        Write-Host "[Hermes] CRASH STORM: $($crashTimestamps.Count) crashes in last hour. Pausing 10 minutes."
        Start-Sleep -Seconds 600
        $crashTimestamps = @()
        $backoff = 3
        continue
    }

    Write-Host "[Hermes] Restarting in $backoff seconds..."
    Start-Sleep -Seconds $backoff

    # Exponential backoff up to 5 minutes
    $backoff = [Math]::Min($backoff * 2, 300)
}
