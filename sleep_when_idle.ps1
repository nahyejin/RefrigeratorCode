# 쿡매치 PC 전원 — 「안 쓰고 있을 때」 절전(대기 모드 S3)으로 보낸다.
#
# 깨어 있는 시간: **매일 07:00~19:30**(2026-10-06 사용자 요청). 낮에 회사 컴퓨터·폰으로 이 컴퓨터에 들어와
# 일하는데, 예전 스케줄(09-29: 배치 끝나면 10시 이후 바로 절전, 평일 16시에만 다시 깨움)로는 낮·주말에
# 꺼져 있을 때가 많았다. 잠든 컴퓨터는 원격(구글 원격 데스크톱·Claude Remote Control)으로 깨울 수 없다.
#
#   07:00  CookMatch-DailyChain 이 깨워 배치 → 끝나면 이 스크립트(-FromChain): 재우지 않고
#          keep_awake_until.ps1 을 띄워 19:25 까지 붙잡는다(아무도 안 만지면 윈도우가 「무인 깨어남」으로 보고 다시 재움)
#   16:00  CookMatch-EveningWake — 혹시 잠들어 있으면 깨운다(평일, 예전 스케줄의 안전망으로 남겨 둠)
#   19:25  CookMatch-EveningSleep → 이 스크립트: 5분 알림 뒤 19:30 에 잠든다
#
# 최대 절전(shutdown /h) 대신 대기 모드(S3): 최대 절전은 깨는 데 3~6분 걸려 07:00 예약이 「놓친 작업」으로 밀려
# 07:10 에야 배치가 시작됐고, 그 사이 윈도우가 2분 만에 다시 재운 날이 있었다(10-04 일 07:03 깸 → 07:05 잠듦,
# 배치는 사용자가 켠 11:52 에야 돔). 대기 모드는 몇 초 만에 깬다. 전기는 밤사이 몇 W 더 쓴다.
#
# 잠들기 전 확인:
#   · no_shutdown.flag 가 있으면 잠들지 않는다(그날 늦게까지 쓸 때)
#   · 아침 배치가 아직 돌고 있으면 끝날 때까지 기다린다(-FromChain 이 아닐 때)
#   · 최근 15분 안에 마우스·키보드 입력이 있으면(원격 데스크톱으로 쓰는 것 포함) 쓰는 중으로 보고 10분 뒤 다시 본다
#   · **Claude Code 가 작업 중이면**(최근 10분 안에 대화 기록 ~/.claude/projects/**/*.jsonl 이 바뀜) 10분 뒤 다시 본다 —
#     폰에서 원격 조작(claude.ai)으로 일을 시키면 마우스·키보드 입력이 없어서 위 규칙으로는 작업 도중에 잠들었다(2026-09-29 요청)
#   · 5분 알림 동안 누가 만지면 잠들지 않는다
#   · 최대 6시간 기다려도 계속 쓰고 있으면 그날은 포기한다
# 기록: daily_chain.log
param(
    [string]$NotBefore = '',
    [switch]$FromChain,
    [int]$IdleMinutes = 15,
    [int]$MaxWaitMinutes = 360
)

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\user\Desktop\RefrigeratorCode'
$log = Join-Path $root 'daily_chain.log'
function Log($msg) {
    Add-Content -Path $log -Encoding UTF8 -Value ("[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $msg)
}

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CookMatchIdle {
    [StructLayout(LayoutKind.Sequential)]
    struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    public static double IdleMinutes() {
        var li = new LASTINPUTINFO(); li.cbSize = (uint)Marshal.SizeOf(li);
        GetLastInputInfo(ref li);
        return ((uint)Environment.TickCount - li.dwTime) / 60000.0;
    }
}
'@

# Claude Code 는 메시지·도구 실행마다 대화 기록(jsonl)을 덧붙인다 — 최근에 바뀌었으면 작업 중으로 본다
function ClaudeBusyMinutesAgo {
    $dir = Join-Path $env:USERPROFILE '.claude\projects'
    if (-not (Test-Path $dir)) { return 1e9 }
    $f = Get-ChildItem $dir -Recurse -Filter *.jsonl -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $f) { return 1e9 }
    return ((Get-Date) - $f.LastWriteTime).TotalMinutes
}

function ChainRunning {
    $t = Get-ScheduledTask -TaskName 'CookMatch-DailyChain' -ErrorAction SilentlyContinue
    return ($t -and $t.State -eq 'Running')
}

# 아침 배치 끝: 재우지 않고 19:25 까지 깨어 있게 붙잡는다(2026-10-06)
if ($FromChain) {
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'keep_awake_until.ps1'), '-Until', '19:25')
    exit 0
}

$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)

# 출근길이 끝나기 전이면 기다린다
if ($NotBefore) {
    $until = [datetime]::ParseExact($NotBefore, 'HH:mm', $null)
    if ((Get-Date) -lt $until) {
        Log ("절전은 {0} 이후 — 그때까지 깨어 있음" -f $NotBefore)
        Start-Sleep -Seconds ([int]($until - (Get-Date)).TotalSeconds)
        $deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
    }
}

while ($true) {
    if (Test-Path (Join-Path $root 'no_shutdown.flag')) { Log 'no_shutdown.flag 가 있어 절전하지 않음'; exit 0 }
    if ((Get-Date) -gt $deadline) { Log ("{0}분 동안 계속 쓰는 중이라 오늘은 절전하지 않음" -f $MaxWaitMinutes); exit 0 }

    if (-not $FromChain -and (ChainRunning)) {
        Log '아침 배치가 아직 도는 중 — 10분 뒤 다시 확인'
        Start-Sleep -Seconds 600; continue
    }
    $claude = ClaudeBusyMinutesAgo
    if ($claude -lt 10) {
        Log ("Claude Code 가 작업 중({0:N0}분 전 기록) — 10분 뒤 다시 확인" -f $claude)
        Start-Sleep -Seconds 600; continue
    }
    $idle = [CookMatchIdle]::IdleMinutes()
    if ($idle -lt $IdleMinutes) {
        Log ("최근 {0:N0}분 전에 입력이 있어 쓰는 중으로 봄 — 10분 뒤 다시 확인" -f $idle)
        Start-Sleep -Seconds 600; continue
    }

    & msg.exe * /time:300 '쿡매치: 5분 뒤 컴퓨터가 절전 모드로 들어갑니다. 계속 쓰면(마우스·키보드) 잠들지 않아요.' 2>$null
    Start-Sleep -Seconds 300
    if ([CookMatchIdle]::IdleMinutes() -lt 5 -or (ClaudeBusyMinutesAgo) -lt 5) {
        Log '알림 중에 입력 또는 Claude 작업이 있어 절전 취소 — 10분 뒤 다시 확인'
        Start-Sleep -Seconds 600; continue
    }
    if (Test-Path (Join-Path $root 'no_shutdown.flag')) { Log 'no_shutdown.flag 가 있어 절전하지 않음'; exit 0 }

    Log '절전(대기 모드)으로 들어감'
    # SetSuspendState(hibernate=false): 최대 절전이 아니라 대기 모드(S3) — 깨는 데 몇 초
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)
    exit 0
}
