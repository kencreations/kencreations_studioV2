@echo off
setlocal

echo ========================================
echo        Git Auto-Push Script
echo ========================================
echo.

:: Show current status
git status -s
echo.

:: Prompt for a commit message
set /p commit_msg="Enter commit message (Leave blank for auto-timestamp): "

:: If no message is entered, use the current date and time
if "%commit_msg%"=="" (
    set commit_msg=Auto-commit: %date% %time%
)

:: Execute Git commands
echo.
echo [+] Adding changes...
git add .

echo [+] Committing...
git commit -m "%commit_msg%"

echo [+] Pushing to repository...
git push

echo.
echo ========================================
echo        Push Complete!
echo        Closing in 5 seconds...
echo ========================================
timeout /t 5