# DeliveryApp — Front-end (React Native + Expo)

Front-end completo de um app de delivery estilo iFood/Uber Eats, com **3 perfis de login**
(cliente, restaurante, entregador) e telas funcionais, todo rodando **sem backend** por enquanto,
mas já estruturado para conectar numa API real depois.

## Como rodar

```bash
npm install
npx expo start
```

Abra no celular com o app **Expo Go** (escaneando o QR code) ou rode num emulador
(`npx expo start --ios` / `--android`).

Requisitos: Node.js 18+ instalado.

## O que já tem

- **Login com 3 perfis** (`src/screens/Auth/LoginScreen.tsx`): cliente, restaurante e entregador.
  Qualquer e-mail/senha entra (modo demonstração) e leva para o fluxo do perfil escolhido.
- **Cliente**: Início (categorias + restaurantes + busca), Busca, Detalhe do restaurante
  (cardápio + carrinho), Carrinho, Pedidos, Conta.
- **Restaurante**: painel com status aberto/fechado, estatísticas do dia e lista de pedidos.
- **Entregador**: painel com disponibilidade e corridas.
- Sessão persistida localmente (`AsyncStorage`) — fechar e abrir o app mantém o login.
- Design próprio (cores em `src/theme/colors.ts`), não é clone visual de nenhum app existente.

## Como conectar o backend depois

Toda a "ponte" com API já está pronta e isolada em `src/services/`:

- `src/services/api.ts` — instância do axios com `API_BASE_URL` e interceptors prontos
  para JWT (`Authorization: Bearer ...`). É só preencher a URL e trocar `USE_MOCK` para `false`.
- `src/services/authService.ts` — `login()` e `register()` já chamam `POST /auth/login` e
  `POST /auth/register` quando `USE_MOCK = false`.
- `src/services/restaurantService.ts` — `getCategories()`, `getRestaurants()`,
  `searchRestaurantsAndFoods()`, `getRestaurantById()`, todos já com o `fetch` real comentado
  ao lado do mock.

Nenhuma tela precisa mudar — elas só chamam essas funções, então trocar o mock pela API real
é uma mudança isolada nesses arquivos.

## Estrutura

```
App.tsx
src/
  theme/          cores e tipografia
  types/          tipos TypeScript (User, Restaurant, Order, etc.)
  context/        Auth, Cart, Order (estado global)
  services/       api.ts + mocks + services prontos para backend
  navigation/      Auth / Cliente (tabs) / Restaurante / Entregador
  screens/
    Auth/          Login
    Client/        Home, Search, RestaurantDetail, Cart, Orders, Account
    Restaurant/    painel do restaurante
    Deliverer/     painel do entregador
  components/      Button, SearchBar, CategoryPill, RestaurantCard, FoodCard
```

## Próximos passos sugeridos

1. Conectar um backend real (Node/NestJS, Firebase, Supabase — qualquer um funciona com
   a camada `services/` como está).
2. Tela de cadastro completa (hoje só existe o botão, o login já cobre o "criar usuário" mockado).
3. Endereços múltiplos e seleção de forma de pagamento.
4. Tracking em tempo real do entregador no mapa (react-native-maps).
5. Notificações push para status do pedido.
