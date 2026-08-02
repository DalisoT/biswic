# Find any process holding dev.db using CIM file handles (Win32 only)
$target = "dev.db"
$candidates = Get-CimInstance Win32_Process -Filter "Name like '%node%' or Name like '%pnpm%' or Name like '%next%'"
foreach ($p in $candidates) {
  Write-Host ("PID {0,6} {1}" -f $p.ProcessId, $p.Name)
}
Write-Host "---"
# Alternative: check if dev.db is in any known process' working set
$folder = "C:\Users\PATRICIA\Desktop\Projects\biswic\prisma"
Write-Host "Processes with CWD under prisma/:"
Get-CimInstance Win32_Process -Filter "Name like '%node%'" | Where-Object {
  $_.CommandLine -like "*biswic*" -or $_.CommandLine -like "*prisma*"
} | Select-Object ProcessId, Name, CommandLine | Format-Table -AutoSize -Wrap
