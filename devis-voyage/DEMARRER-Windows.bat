@echo off
title Devis Voyage - Graine de Voyageur
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js n'est pas installe sur cet ordinateur.
  echo   Installez-le depuis https://nodejs.org (version LTS^), puis relancez ce fichier.
  echo.
  pause
  exit /b
)

echo.
echo   Le logiciel demarre... la fenetre du navigateur s'ouvre toute seule.
echo   Laissez cette fenetre noire ouverte pendant que vous travaillez.
echo   Pour arreter le logiciel : fermez cette fenetre.
echo.

start /b "" powershell -NoProfile -Command "Start-Sleep 2; Start-Process 'http://localhost:3000'"
node server.js
pause
