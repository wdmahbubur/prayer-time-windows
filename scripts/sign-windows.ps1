param(
  [string]$BundleDir = "$env:LOCALAPPDATA\prayer-times-windows\cargo-target\release\bundle",
  [string]$Thumbprint = $env:WINDOWS_CERT_THUMBPRINT,
  [string]$TimestampUrl = $(if ($env:WINDOWS_TIMESTAMP_URL) { $env:WINDOWS_TIMESTAMP_URL } else { "http://timestamp.digicert.com" }),
  [string]$SignToolPath = $env:SIGNTOOL_PATH
)

$ErrorActionPreference = "Stop"

if (-not $Thumbprint) {
  throw "Set WINDOWS_CERT_THUMBPRINT to the SHA-1 thumbprint of a trusted code-signing certificate in Cert:\CurrentUser\My."
}

if (-not $SignToolPath) {
  $SignToolPath = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
    Where-Object { $_.FullName -match "\\x64\\signtool.exe$" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $SignToolPath -or -not (Test-Path -LiteralPath $SignToolPath)) {
  throw "signtool.exe was not found. Install the Windows SDK or set SIGNTOOL_PATH."
}

$assets = @(
  Get-ChildItem -Path $BundleDir -Recurse -File -Include "*.msi", "*.exe" -ErrorAction SilentlyContinue
) | Sort-Object FullName

if (-not $assets) {
  throw "No MSI or EXE installers found under $BundleDir. Run npm run tauri:build first."
}

foreach ($asset in $assets) {
  Write-Host "Signing $($asset.FullName)"
  & $SignToolPath sign `
    /sha1 $Thumbprint `
    /fd SHA256 `
    /tr $TimestampUrl `
    /td SHA256 `
    /v `
    $asset.FullName

  if ($LASTEXITCODE -ne 0) {
    throw "signtool failed for $($asset.FullName)"
  }

  & $SignToolPath verify /pa /v $asset.FullName
  if ($LASTEXITCODE -ne 0) {
    throw "signature verification failed for $($asset.FullName)"
  }
}

Write-Host "Signed $($assets.Count) installer asset(s)."
