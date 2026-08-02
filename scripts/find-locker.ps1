$target = "C:\Users\PATRICIA\Desktop\Projects\biswic\prisma\dev.db"
Get-Process | Where-Object {
  try {
    $_.Modules.FileName | Where-Object { $_ -like "*prisma*" -or $_ -like "*node*" }
  } catch { $false }
} | Select-Object Id, ProcessName, @{N='CmdLine';E={(Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine}} | Format-Table -AutoSize -Wrap
