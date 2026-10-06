# 쿡매치 PC 전원 — 정해진 시각까지 컴퓨터가 **스스로 잠들지 않게** 붙잡는다.
#
# 사용자 요청(2026-10-06): 매일 07:00~19:30 은 계속 깨어 있어야 한다 — 낮에 회사 컴퓨터·폰으로 들어와 일하는데
# 예전 스케줄(배치 끝나면 바로 절전, 평일 16시에 다시 깨움)로는 낮·주말에 꺼져 있을 때가 많았다.
#
# 왜 붙잡아야 하나: 예약 작업이 깨운 컴퓨터는 아무도 안 만지면 윈도우가 「무인 깨어남」으로 보고 몇 분 만에
# 다시 재운다(10-04 일요일: 07:03 깨어남 → 배치 시작 전 07:05 다시 잠듦). 이 스크립트가 도는 동안은
# SetThreadExecutionState(ES_SYSTEM_REQUIRED) 로 그걸 막는다. 화면은 꺼져도 된다(ES_DISPLAY_REQUIRED 안 씀).
#
# run_daily_chain.bat 이 07시에 맨 먼저 띄운다. 19:25 CookMatch-EveningSleep(sleep_when_idle.ps1)이 재운다.
# 기록: daily_chain.log
param([string]$Until = '19:25')

$log = 'C:\Users\user\Desktop\RefrigeratorCode\daily_chain.log'
function Log($msg) { Add-Content -Path $log -Encoding UTF8 -Value ("[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $msg) }

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CookMatchAwake {
    [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);
}
'@
$ES_CONTINUOUS = [uint32]'0x80000000'
$ES_SYSTEM_REQUIRED = [uint32]'0x00000001'

$end = [datetime]::ParseExact($Until, 'HH:mm', $null)
if ((Get-Date) -ge $end) { exit 0 }

Log ("{0} 까지 잠들지 않게 붙잡음" -f $Until)
[void][CookMatchAwake]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
while ((Get-Date) -lt $end) {
    Start-Sleep -Seconds 60
}
[void][CookMatchAwake]::SetThreadExecutionState($ES_CONTINUOUS)
