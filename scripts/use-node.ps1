# Dot-source this file to use the project's portable Node in the current shell only:
#   . .\scripts\use-node.ps1
# Nothing is installed system-wide. The npm cache also stays inside .tools.
$root = Split-Path -Parent $PSScriptRoot
$env:Path = (Join-Path $root '.tools\node-v24.22.3-win-x64') + ';' + $env:Path
$env:npm_config_cache = Join-Path $root '.tools\npm-cache'
Write-Host "Using portable Node $(node --version) from .tools"
