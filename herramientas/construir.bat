@echo off
cd /d "%~dp0\.."
node herramientas\construir.js %*
pause
