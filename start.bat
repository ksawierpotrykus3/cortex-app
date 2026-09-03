@echo off
cd /d "%~dp0"

rem === 1. Uruchom proxy DeepSeek w tle (cichy start, port 8790) ===
echo [CORTEX] Uruchamiam proxy DeepSeek (port 8790)...
start "DeepSeek Proxy" /min cmd /c "python -u server.py --port 8790" ^
  /d "%~dp0..\deepseek-proxy-clean"

rem === 2. Uruchom Cortex ===
echo Uruchamiam Cortex...
npm run dev