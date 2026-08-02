#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Subindo banco de dados e backend (Docker)..."
docker compose up -d --build db backend

echo "Aguardando backend responder em http://localhost:3333/health ..."
until curl -s http://localhost:3333/health > /dev/null; do
  sleep 1
done
echo "Backend no ar."

if [ ! -d "frontend/node_modules" ]; then
  echo "Instalando dependências do frontend..."
  (cd frontend && npm install)
fi

echo "Subindo o frontend (Expo)..."
(cd frontend && npm start)
