# restart-backfill.ps1
#
# Runs every 5 minutes via Windows Task Scheduler.
# Logic:
#   1. If backfill is already running  → exit (nothing to do)
#   2. If no resume-state.json         → backfill complete, disable self and exit
#   3. If ALL 3 Groq keys are maxed    → hold until 01:00 on the next calendar day
#   4. Otherwise                       → (re)start backfill

$backfillDir  = "d:\job-classifier\backend-job-sync"
$statusFile   = "$backfillDir\logs\sync-status.json"
$resumeFile   = "$backfillDir\logs\resume-state.json"
$logFile      = "$backfillDir\logs\restart-watcher.log"
$taskName     = "AppWhere-BackfillWatcher"

function Write-Log($msg) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "$ts  $msg"
    $line | Add-Content -Path $logFile
    Write-Host $line
}

# ── 1. Backfill complete? ──────────────────────────────────────────────────────
if (-not (Test-Path $resumeFile)) {
    Write-Log "resume-state.json not found — backfill is COMPLETE. Disabling watcher task."
    schtasks /Change /TN $taskName /DISABLE | Out-Null
    exit 0
}

# ── Parse sync-status (may not exist on very first run) ───────────────────────
$status = $null
if (Test-Path $statusFile) {
    try { $status = Get-Content $statusFile -Raw | ConvertFrom-Json }
    catch { Write-Log "WARNING: Could not parse sync-status.json: $_" }
}

# ── 2. Already running? ───────────────────────────────────────────────────────
if ($status -and $status.is_running -eq $true) {
    Write-Log "Already running (fetched=$($status.emails_fetched), classified=$($status.emails_classified), tokens=$($status.tokens_used_today)/$($status.tokens_day_limit)). Skipping."
    exit 0
}

# ── 3. Are ALL 3 Groq keys exhausted for today? ───────────────────────────────
$allKeysExhausted = $false
if ($status -and $status.key_rate_limited) {
    $limited = @($status.key_rate_limited)
    # "All exhausted" = every key is rate-limited, OR total token budget is spent
    $tokensBurned     = ($status.tokens_used_today -ge $status.tokens_day_limit)
    $allLimited       = ($limited.Count -gt 0) -and (($limited | Where-Object { $_ -eq $false }).Count -eq 0)
    $allKeysExhausted = $tokensBurned -or $allLimited
}

if ($allKeysExhausted) {
    $now      = Get-Date
    $limitDay = [datetime]::ParseExact($status.tokens_day_started, "yyyy-MM-dd", $null)

    # Allow restart only after 01:00 on a new calendar day (Groq resets at midnight)
    $isDifferentDay = ($now.Date -gt $limitDay.Date)
    $pastResetHour  = ($now.Hour -ge 1)

    if ($isDifferentDay -and $pastResetHour) {
        Write-Log "New day ($($status.tokens_day_started) → $($now.ToString('yyyy-MM-dd'))) and past 01:00 — keys reset. Restarting backfill."
        # Fall through to spawn block below
    } else {
        $nextWindow = $limitDay.AddDays(1).Date.AddHours(1)
        Write-Log "All 3 keys exhausted for $($status.tokens_day_started) (tokens=$($status.tokens_used_today)/$($status.tokens_day_limit), key_rate_limited=$($limited -join ',')).  Next attempt after $($nextWindow.ToString('yyyy-MM-dd HH:mm'))."
        exit 0
    }
}

# ── 4. (Re)start backfill ─────────────────────────────────────────────────────
$reason = if (-not $status) { "first run" } elseif ($allKeysExhausted) { "new day / keys reset" } else { "process stopped unexpectedly" }
Write-Log "Launching backfill ($reason)..."

try {
    $npmPath = (Get-Command npm -ErrorAction Stop).Source
    $proc = Start-Process -FilePath $npmPath `
                          -ArgumentList "run", "backfill" `
                          -WorkingDirectory $backfillDir `
                          -PassThru `
                          -NoNewWindow
    Write-Log "Spawned backfill (PID $($proc.Id))."
} catch {
    Write-Log "ERROR spawning backfill: $_"
    exit 1
}
