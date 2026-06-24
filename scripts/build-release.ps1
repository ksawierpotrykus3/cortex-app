# NEXUS Release Build Script
# Usage: .\scripts\build-release.ps1
# Buduje release z wyborem sciezki instalacji (NSIS oneClick: false)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PythonPath = "C:\Users\Ksawier\AppData\Local\Programs\Python\Python313"

# Add Python to PATH and set node-gyp env vars
$env:PATH = "$PythonPath;$PythonPath\Scripts;$env:PATH"
$env:PYTHON = "$PythonPath\python.exe"
$env:npm_config_python = "$PythonPath\python.exe"

Write-Host "[NEXUS] Python: $env:PYTHON" -ForegroundColor Cyan
Write-Host "[NEXUS] Building release..." -ForegroundColor Cyan

Set-Location $ProjectRoot
npm run electron:build

Write-Host "[NEXUS] Done!" -ForegroundColor Green
