@echo off
title Alcebo - Seguimiento y Automatizacion de Emails
echo ==========================================================
echo       ALCEBO CONTROL DE PLAGAS - SISTEMA DE CORREOS
echo ==========================================================
echo.
echo Iniciando el servidor...
echo.
echo [INFO] El navegador se abrira automaticamente en 3 segundos.
echo [INFO] No cierres esta ventana negra mientras uses la app.
echo.

:: Open browser automatically after 3 seconds to let the server start
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

:: Start the application
npm run dev
