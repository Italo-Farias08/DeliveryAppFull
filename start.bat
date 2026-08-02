@echo off
cd /d "%~dp0"

echo Subindo banco de dados e backend (Docker)...
docker compose up -d --build db backend

echo Aguardando backend responder em http://localhost:3333/health ...
:wait
curl -s http://localhost:3333/health >nul 2>&1
if errorlevel 1 (
  timeout /t 1 >nul
  goto wait
)
echo Backend no ar.

if not exist "frontend\node_modules" (
  echo Instalando dependencias do frontend...
  cd frontend
  call npm install
  cd ..
)

echo Subindo o frontend (Expo)...
cd frontend
call npm start
