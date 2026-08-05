# DeliveryApp Backend

API REST em Node.js + Express + PostgreSQL para o app de delivery (cliente, restaurante e entregador), com multi-tenancy: cada conta de restaurante (`tenant`) pode cadastrar vários restaurantes/unidades, e os dados de cardápio e pedidos ficam isolados por tenant via Row Level Security do Postgres.

## Setup

```bash
npm install
cp .env.example .env
# edite DATABASE_URL e JWT_SECRET no .env
npm run db:setup   # cria as tabelas (schema.sql)
psql "$DATABASE_URL" -f src/db/seed.sql   # opcional: categorias iniciais
npm run dev
```

Requer PostgreSQL 13+ (usa `gen_random_uuid()` da extensão `pgcrypto`, criada automaticamente pelo schema).

> Importante: o usuário/role usada na `DATABASE_URL` não pode ser superuser/dono com bypass de RLS. Crie um role de aplicação sem privilégio de `BYPASSRLS` para que o isolamento por tenant funcione de verdade.

## Como o multi-tenant funciona

- `tenants`: uma conta de restaurante. Um tenant pode ter vários `restaurants` (unidades/filiais).
- Usuários com `role = 'restaurant'` sempre têm `tenant_id`.
- Rotas em `/api/tenant/*` exigem login como `restaurant` e passam por um middleware (`tenantContext`) que abre uma transação e executa `SET LOCAL app.current_tenant`, ativando as policies de RLS das tabelas `restaurants` e `menu_items` — mesmo com um bug de aplicação, o Postgres impede um tenant de escrever em dados de outro.
- Leitura de `restaurants` e `menu_items` é pública (catálogo do marketplace); escrita (INSERT/UPDATE/DELETE) é restrita ao tenant dono via RLS.
- `orders` guarda `tenant_id`, `client_id` e `deliverer_id`; o isolamento é reforçado nas queries de cada módulo (cliente só vê os próprios pedidos, restaurante só vê pedidos do seu tenant, entregador só vê os que aceitou).

## Endpoints principais

### Auth
- `POST /api/auth/register` — `{ name, email, password, role: 'client'|'restaurant'|'deliverer', businessName?, document? }`
- `POST /api/auth/login` — `{ email, password }`

### Público (marketplace)
- `GET /api/categories`
- `GET /api/restaurants?categoryId=`
- `GET /api/restaurants/search?q=`
- `GET /api/restaurants/:id`

### Cliente (Bearer token, role client)
- `GET/POST /api/addresses`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`

### Restaurante / tenant (Bearer token, role restaurant)
- `GET/POST /api/tenant/restaurants`
- `PUT /api/tenant/restaurants/:id`
- `POST /api/tenant/restaurants/:id/logo` — upload da logo (multipart/form-data, campo `logo`)
- `POST /api/tenant/restaurants/:id/banner` — upload do banner/capa (multipart/form-data, campo `banner`)
- `GET/POST /api/tenant/restaurants/:restaurantId/menu-items`
- `PUT/DELETE /api/tenant/menu-items/:menuItemId`
- `POST /api/tenant/menu-items/:menuItemId/image` — upload da foto do item (multipart/form-data, campo `image`)
- `GET /api/tenant/orders`
- `PATCH /api/tenant/orders/:orderId/status`

## Upload de imagens (logo, banner, foto dos itens)

As imagens **não** ficam no banco de dados (nada de base64/blob no Postgres,
pra não pesar) e **não** exigem que o restaurante tenha uma URL https pronta.
O restaurante escolhe um arquivo (jpg/png/webp/gif, até 5MB) direto do app, o
backend salva em disco em `backend/uploads/<tipo>/<arquivo>` e devolve a URL
pública pronta (`/uploads/...`), que fica salva na coluna `image`/`banner` do
restaurante ou do item. As rotas acima fazem exatamente isso:

1. `logo` e `banner` do restaurante são independentes — pode enviar um sem o
   outro, e cada envio não afeta o resto do cadastro do restaurante.
2. A foto de um item do cardápio é enviada depois do item já existir (crie o
   item primeiro, depois chame `POST /menu-items/:menuItemId/image`).

> **Atenção ao publicar (Railway/Render/etc.):** se o serviço não tiver um
> volume persistente, o disco é apagado a cada novo deploy e as imagens
> enviadas se perdem. Configure um *volume* apontando para `/app/uploads` (o
> mesmo caminho usado pelo `Dockerfile`) para as fotos sobreviverem aos
> deploys.

### Entregador (Bearer token, role deliverer)
- `GET /api/deliverer/orders/available`
- `GET /api/deliverer/orders/mine`
- `PATCH /api/deliverer/orders/:id/accept`
- `PATCH /api/deliverer/orders/:id/status`

## Conectando o front-end

No `src/services/api.ts` do app, troque `API_BASE_URL` pela URL desta API e `USE_MOCK` para `false`. Os formatos de resposta (`Category`, `Restaurant`, `MenuItem`, `Order`) já foram desenhados para bater com `src/types/index.ts` do front.
