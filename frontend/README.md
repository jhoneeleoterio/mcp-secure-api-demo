# Frontend AcmeCommerce

Aplicação Angular de consulta aos dados fictícios da API REST. O layout segue
as telas de início e busca de clientes do projeto AgentBridgeMcp no Stitch.

Com a API local em `http://localhost:5080`, execute `npm ci` e `npm start`.
Abra `http://localhost:4200/app/`. Para verificar, use `npm test -- --no-watch`
e `npm run build`.

As consultas REST são públicas. `AuthService`, guarda e interceptor estão
preparados para um fluxo de login futuro; nenhuma tela atual usa JWT.
Início, clientes, pedidos e estoque usam os endpoints REST do backend. A página
inicial consulta os registros da demo para mostrar números atuais; se a API
falhar, exibe erro e permite tentar novamente.

Os templates ficam em arquivos `.html` e os estilos em `.scss`. Cores e mixins
compartilhados estão em `src/styles/_theme.scss`. `src/app/ui/` reúne toolbar,
busca, botões, cartões, listas, feedback e o estado comum das consultas HTTP.
As páginas em `src/app/pages/` usam esses elementos com a API em
`src/app/core/commerce-api.ts`.
