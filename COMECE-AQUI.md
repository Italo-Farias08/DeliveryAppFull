# Seu projeto completo

Este zip tem o projeto inteiro: `frontend/` (o app, agora com PWA já configurado) e
`backend/` (API + banco). `node_modules` e `.git` foram removidos pra caber no download —
reinstale as dependências depois de descompactar.

## Reinstalar dependências

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Rodar local pra testar

```bash
# na raiz do projeto
docker compose up      # sobe banco + backend
cd frontend && npx expo export -p web && npx serve dist   # gera e serve o front
```

(ou use o `start.sh` / `start.bat` que já vêm no projeto)

## A PWA já vive dentro do backend, em `/app`

Em vez de publicar o `frontend` separado (Netlify/Vercel), o build web do app já vem
pronto e embutido em `backend/public/app`, servido pelo próprio Express na rota `/app`.
Ou seja: subindo só o backend (`docker compose up` ou seu deploy normal), a PWA já fica
disponível em `https://vitoriadelivery.site/app` — instalável, funciona offline (via
`service-worker.js`) e chama a API relativa (`/api`, mesmo domínio), sem precisar
configurar URL nenhuma nem lidar com CORS entre dois domínios diferentes.

Como o domínio já tem HTTPS (seu `.env` aponta pra `https://vitoriadelivery.site/api`),
a instalação como app ("Adicionar à Tela de Início") já funciona direto.

### Como atualizar o build depois de mexer no `frontend/src`

Sempre que alterar o código do app, é preciso gerar o build de novo e recopiar pra dentro
do backend — os arquivos de `backend/public/app` são um build "congelado", não ficam
sincronizados automaticamente com `frontend/src`:

```bash
cd frontend
npm install
EXPO_PUBLIC_API_BASE_URL=/api npx expo export -p web --output-dir dist-app
```

Depois, dentro de `dist-app`, os caminhos precisam ficar prefixados com `/app/` (porque
o Expo sempre gera tudo assumindo que vai rodar na raiz do domínio `/`). O jeito mais
simples é pedir pro Claude regenerar isso — ele sabe reproduzir os mesmos ajustes feitos
aqui (prefixar `/assets`, `/_expo`, `manifest.json`, `service-worker.js`, etc. e copiar
pra `backend/public/app`).

### Por que não hospedar em Netlify/Vercel

Ainda é uma opção válida (e mais simples se você quiser escalar o front separado do
backend no futuro), mas manter tudo no mesmo domínio evita CORS, evita apontar/manter uma
segunda URL, e simplifica o certificado HTTPS (só um domínio pra cuidar). Se um dia quiser
migrar pra hospedagem separada, é só apontar `backend/public/app` pro serviço escolhido.
