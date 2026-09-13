param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("start", "stop", "status")]
  [string]$Action
)
$serviceName = "postgresql-nossoalbum18"
$service = Get-Service -Name $serviceName -ErrorAction Stop
if ($Action -eq "start" -and $service.Status -ne "Running") {
  try { Start-Service -Name $serviceName -ErrorAction Stop }
  catch { Start-Process -FilePath "$env:WINDIR\System32\sc.exe" -ArgumentList @("start", $serviceName) -Verb RunAs -WindowStyle Hidden -Wait }
  (Get-Service -Name $serviceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
}
if ($Action -eq "stop" -and $service.Status -ne "Stopped") {
  try { Stop-Service -Name $serviceName -ErrorAction Stop }
  catch { Start-Process -FilePath "$env:WINDIR\System32\sc.exe" -ArgumentList @("stop", $serviceName) -Verb RunAs -WindowStyle Hidden -Wait }
  (Get-Service -Name $serviceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
}
Get-Service -Name $serviceName | Select-Object Name, Status, StartType
