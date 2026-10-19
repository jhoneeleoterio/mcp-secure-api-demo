# Deploy

O GitHub Actions executa o build e os testes da branch `main` e publica as
imagens da API, do MCP e do frontend no GitHub Container Registry (GHCR).

Uma VM Oracle verifica periodicamente se existe uma nova versão em `main` com
build, testes e publicação concluídos. Então ela baixa as imagens e inicia a
API, o MCP e o Caddy com Docker Compose. O Caddy fornece HTTPS, serve o frontend
em `/app/` e encaminha as demais requisições para os serviços.
O PostgreSQL fica no Neon.

As configurações e credenciais de produção ficam somente na VM. O GitHub não
recebe uma chave SSH de acesso à máquina. O script de deploy verifica a API e
o MCP e o frontend após cada atualização e restaura a versão anterior se a verificação
falhar. Alterações no banco de dados exigem um procedimento próprio de backup
e reversão.

Os arquivos dessa configuração estão em [`deploy/`](../deploy/).
