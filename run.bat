@echo off
cd /d "%~dp0"
title Servidor DVEEEyR - Salud Guanajuato

echo ======================================================================
echo    DVEEEyR - SECRETARIA DE SALUD DE GUANAJUATO - ACTIVIDAD REE
echo ======================================================================
echo.

set "PY=python"
if exist "C:\Users\Manuel\AppData\Local\Programs\Python\Python312\python.exe" set "PY=C:\Users\Manuel\AppData\Local\Programs\Python\Python312\python.exe"

echo Iniciando servidor en http://localhost:8000 ...
echo Tu navegador se abrira automaticamente.
echo No cierres esta ventana mientras utilices la actividad.
echo.

"%PY%" server.py

echo.
echo ======================================================================
echo El servidor se ha detenido.
echo Presione cualquier tecla para salir...
echo ======================================================================
pause
