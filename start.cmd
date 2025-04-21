@echo off

call npm start

IF %ERRORLEVEL% NEQ 0 (
  echo.
  echo Press any key to exit...
  pause >nul
)

@echo on
