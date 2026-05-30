# Planejamento de Producao - colaboraEDU Analytics

Data do checkpoint: 2026-05-29

Este arquivo registra o estado atual do endurecimento para producao, as decisoes tomadas e os proximos passos recomendados para continuar futuramente.

## Estado Atual

O sistema foi revisado e recebeu correcoes prioritarias de seguranca, validacao e build. O objetivo desta etapa foi tirar o projeto do estado "nao publicar" e aproximar de uma base operacional defensavel.

Validacoes executadas neste checkpoint:

```bash
npm run lint
npx tsc --noEmit
npm audit --audit-level=moderate
npm run build
```

Resultado:

- `npm run lint`: passou
- `npx tsc --noEmit`: passou
- `npm audit --audit-level=moderate`: passou com 0 vulnerabilidades
- `npm run build`: passou com validacao TypeScript ativa

Servidor de producao local iniciado para teste:

```text
http://localhost:3003
```

Testes HTTP feitos:

- `/login`: respondeu 200
- `/api/users` sem sessao: respondeu 401
- `/api/auth/seed` sem token: respondeu 403

## Decisoes Ja Implementadas

### Autenticacao e Sessao

- Criado `src/lib/session.ts`.
- Sessao antiga `base64(userId:timestamp)` foi substituida por token assinado com HMAC SHA-256.
- `SESSION_SECRET` passou a ser obrigatorio em producao.
- Middleware valida assinatura e expiracao do token.
- `/api/auth/me` usa a camada comum de autenticacao.

Arquivos principais:

- `src/lib/session.ts`
- `src/lib/api-auth.ts`
- `src/middleware.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/logout/route.ts`

### Seed de Super Admin

- `/api/auth/seed` agora exige header `x-seed-token`.
- A senha fixa `admin123` foi removida.
- A rota nao retorna mais credenciais na resposta.
- Bootstrap usa variaveis de ambiente:
  - `SEED_ADMIN_TOKEN`
  - `INITIAL_ADMIN_EMAIL`
  - `INITIAL_ADMIN_PASSWORD`

Arquivo principal:

- `src/app/api/auth/seed/route.ts`

### Autorizacao e Escopo por Escola

- Criado `src/lib/api-auth.ts` com helpers:
  - `requireUser`
  - `requireRoles`
  - `ensureSchoolAccess`
  - `ensureClassAccess`
  - `ensureStudentAccess`
  - `buildStudentWhereForUser`
  - `buildClassWhereForUser`
  - `buildSchoolWhereForUser`

- Rotas administrativas de usuarios e escolas agora exigem perfis admin.
- Rotas de dados agora filtram por escolas vinculadas ao usuario, quando ele nao e admin global.

Areas cobertas:

- Usuarios
- Escolas
- Turmas
- Dashboards
- Relatorios
- Exportacoes
- Inconsistencias
- Uploads

### Uploads

- Upload de PDF agora exige perfil com permissao de escrita.
- Validacoes adicionadas:
  - limite de arquivos por requisicao
  - limite de tamanho por PDF
  - extensao `.pdf`
  - MIME `application/pdf`
  - assinatura inicial `%PDF-`

Arquivos principais:

- `src/app/api/uploads/route.ts`
- `src/app/api/uploads/[id]/process/route.ts`

### Exportacao Excel

- Dependencia vulneravel `xlsx` foi removida.
- Exportador XLSX foi reimplementado com XML OpenXML minimo compactado via `fflate`.
- Celulas de CSV/XLSX agora neutralizam valores iniciados por `=`, `+`, `-` ou `@` para reduzir risco de formula injection.

Arquivo principal:

- `src/app/api/exports/excel/route.ts`

### Dependencias

Removidas dependencias nao usadas e vulneraveis:

- `next-auth`
- `next-intl`
- `react-syntax-highlighter`
- `xlsx`

Adicionada dependencia direta:

- `fflate`

Adicionado override:

- `postcss: 8.5.10`

Resultado final:

```bash
npm audit --audit-level=moderate
# found 0 vulnerabilities
```

### Build e TypeScript

- Removido `ignoreBuildErrors` de `next.config.ts`.
- `tsconfig.json` passou a excluir `examples`.
- Build agora falha caso TypeScript falhe.

Arquivos principais:

- `next.config.ts`
- `tsconfig.json`

### Infra

- `Caddyfile` teve proxy dinamico por query removido.
- `.env.example` foi atualizado com variaveis obrigatorias de producao.
- `README.md` foi atualizado com fluxo de seed e validacoes.

## Variaveis de Ambiente Necessarias

Exemplo sem segredos reais:

```env
DATABASE_URL="file:./db/custom.db"
PYTHON_BIN="python3"
SESSION_SECRET="gere-com-openssl-rand-hex-32"
SEED_ADMIN_TOKEN="gere-com-openssl-rand-hex-24-ou-maior"
INITIAL_ADMIN_EMAIL="superadmin@atas.com"
INITIAL_ADMIN_PASSWORD="senha-forte-com-12-ou-mais-caracteres"
```

Geracao recomendada:

```bash
openssl rand -hex 32
openssl rand -hex 24
```

Importante:

- Nao versionar `.env`.
- Trocar a senha inicial apos o primeiro login.
- Usar HTTPS em producao para cookies seguros.

## Proximos Passos Recomendados

### 1. Banco de Dados

Migrar SQLite para PostgreSQL antes de uso multiusuario real.

Tarefas sugeridas:

- Alterar provider Prisma para PostgreSQL.
- Criar migrations versionadas com `prisma migrate`.
- Usar `prisma migrate deploy` em producao.
- Configurar backup automatico e restore testado.

### 2. Processamento de PDF

O processamento ainda roda dentro da requisicao HTTP.

Melhorias recomendadas:

- Mover processamento para fila/background job.
- Adicionar timeout para parser Python.
- Envolver criacao/atualizacao de escola, turma, alunos, notas e inconsistencias em transacao.
- Registrar logs de processamento por upload.
- Evitar duplicacao de escola quando nao houver INEP.
- Criar rotina de limpeza de uploads antigos.

### 3. Auditoria e Logs

Adicionar trilha de auditoria para acoes sensiveis:

- Login bem-sucedido e falho.
- Criacao, edicao e remocao de usuarios.
- Alteracao de perfis.
- Upload e processamento de PDFs.
- Exportacoes de dados.

Cuidados:

- Nao logar senha, token, cookie ou dados sensiveis desnecessarios.
- Evitar `query log` em producao.

### 4. Controle Fino de Permissoes

A regra atual separa admin global e usuarios vinculados a escolas.

Refinamentos futuros:

- Matriz formal por papel (`DIRECAO`, `COORDINATOR`, `MANAGER`, `TEACHER`, `VIEWER`).
- Diferenciar leitura, upload, processamento, exportacao e administracao.
- Mostrar/ocultar itens de menu no frontend conforme permissoes reais.

### 5. CSRF e Rate Limit

Adicionar protecoes complementares:

- Rate limit no login.
- Rate limit em upload/processamento.
- Validacao de `Origin`/`Referer` em mutacoes com cookie.
- Opcional: token CSRF para `POST`, `PUT`, `DELETE`.

### 6. Headers de Seguranca

Adicionar headers em Next/Caddy:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `X-Frame-Options` ou `frame-ancestors` via CSP
- CSP adequada ao frontend

### 7. Operacao

Substituir scripts manuais por processo gerenciado:

- systemd, PM2 ou container Docker.
- Healthcheck.
- Rotacao de logs.
- Monitoramento de erro.
- Checklist de deploy.

O arquivo `keep-server-alive.sh` ainda aponta para caminho antigo (`/home/z/my-project`) e nao deve ser usado em producao sem revisao.

### 8. Next Middleware

O build avisa que a convencao `middleware.ts` esta depreciada em favor de `proxy`.

Tarefa futura:

- Migrar `src/middleware.ts` para o novo padrao recomendado pela versao atual do Next.
- Revalidar redirect de paginas e 401 de APIs.

## Checklist Para Retomar

1. Ler este arquivo.
2. Rodar:

```bash
npm run lint
npx tsc --noEmit
npm audit --audit-level=moderate
npm run build
```

3. Validar login e rotas protegidas:

```bash
curl -i http://localhost:3003/api/users
curl -i -X POST http://localhost:3003/api/auth/seed
```

4. Testar manualmente:

- Login com usuario admin.
- Listagem de escolas.
- Upload de PDF valido.
- Rejeicao de arquivo nao PDF.
- Exportacao CSV.
- Exportacao XLSX.
- Relatorios com usuario vinculado a uma escola.
- Tentativa de acessar dados de outra escola.

5. Antes de producao publica, priorizar:

- PostgreSQL
- fila para PDF
- auditoria
- rate limit
- headers de seguranca
- backup/restore

## Observacoes

- A pasta `.next` e artefato gerado.
- `server.log`, `dev.log`, bancos locais e uploads estao ignorados por `.gitignore`.
- Este checkpoint nao substitui teste de penetracao, mas remove os bloqueadores mais obvios encontrados na auditoria inicial.
