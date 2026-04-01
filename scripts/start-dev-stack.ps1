$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot "logs"
$backendEnvPath = Join-Path $repoRoot "backend\.env"
$backendPort = "5002"

if (-not (Test-Path $logsDir)) {
  New-Item -ItemType Directory -Path $logsDir | Out-Null
}

if (Test-Path $backendEnvPath) {
  $portLine = Get-Content $backendEnvPath | Where-Object { $_ -match "^PORT=" } | Select-Object -First 1
  if ($portLine) {
    $backendPort = ($portLine -replace "^PORT=", "").Trim()
  }
}

function Test-ServiceUrl {
  param(
    [string]$Url
  )

  try {
    Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-ServiceProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$FilePath,
    [string[]]$Arguments
  )

  $stdoutPath = Join-Path $logsDir "$Name.out.log"
  $stderrPath = Join-Path $logsDir "$Name.err.log"

  Start-Process `
    -FilePath $FilePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Minimized `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath | Out-Null
}

$services = @(
  @{
    Name = "backend"
    WorkingDirectory = (Join-Path $repoRoot "backend")
    HealthUrl = "http://localhost:$backendPort/api/health/app"
    FilePath = "C:\Program Files\nodejs\node.exe"
    Arguments = @(".\\src\\server.js")
  },
  @{
    Name = "web-public"
    WorkingDirectory = (Join-Path $repoRoot "web-public")
    HealthUrl = "http://localhost:5173"
    FilePath = "npm.cmd"
    Arguments = @("run", "dev")
  },
  @{
    Name = "web-worker"
    WorkingDirectory = (Join-Path $repoRoot "web-worker")
    HealthUrl = "http://localhost:5175"
    FilePath = "npm.cmd"
    Arguments = @("run", "dev")
  },
  @{
    Name = "web-admin"
    WorkingDirectory = (Join-Path $repoRoot "web-admin")
    HealthUrl = "http://localhost:5174"
    FilePath = "npm.cmd"
    Arguments = @("run", "dev")
  }
)

foreach ($service in $services) {
  if (Test-ServiceUrl -Url $service.HealthUrl) {
    Write-Host "$($service.Name) already running at $($service.HealthUrl)"
    continue
  }

  Start-ServiceProcess `
    -Name $service.Name `
    -WorkingDirectory $service.WorkingDirectory `
    -FilePath $service.FilePath `
    -Arguments $service.Arguments

  Write-Host "Started $($service.Name). Logs: logs/$($service.Name).out.log"
}
