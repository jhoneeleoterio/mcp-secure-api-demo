# Frontend AcmeCommerce

Aplicação Angular de consulta aos dados fictícios da API REST. O visual é
provisório até a entrega do design no Stitch.

Com a API local em `http://localhost:5080`, execute `npm ci` e `npm start`.
Abra `http://localhost:4200/app/`. Para verificar, use `npm test -- --no-watch`
e `npm run build`.

As consultas REST são públicas. `AuthService`, guarda e interceptor estão
preparados para um fluxo de login futuro; nenhuma tela atual usa JWT.
