# colaboraEDU Analytics

Sistema de analytics escolar para importar atas em PDF, processar notas, acompanhar desempenho por aluno/turma/disciplina e gerar relatórios.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- shadcn/Radix UI
- Prisma 6
- SQLite
- Python 3 com `pdfplumber` para extração de dados de PDFs

## Requisitos

- Node.js 20+
- npm
- Python 3
- `pdfplumber` instalado no Python usado pelo sistema

## Configuração

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Configure o caminho do banco SQLite:

```env
DATABASE_URL="file:./db/custom.db"
```

Se o Python correto não estiver no PATH como `python3`, informe o binário:

```env
PYTHON_BIN="/usr/bin/python3"
```

Configure também os segredos obrigatórios para produção:

```env
SESSION_SECRET="gere-um-segredo-longo-com-openssl-rand-hex-32"
SEED_ADMIN_TOKEN="gere-um-token-longo-de-bootstrap"
INITIAL_ADMIN_EMAIL="superadmin@atas.com"
INITIAL_ADMIN_PASSWORD="senha-inicial-com-12-ou-mais-caracteres"
```

## Instalação

```bash
npm ci
npm run db:generate
npm run db:push
```

## Rodar o sistema

Desenvolvimento:

```bash
npm run dev
```

Produção local na porta 3003:

```bash
npm run build
PORT=3003 npm run start
```

Acesse:

```text
http://localhost:3003
```

## Usuário inicial

O sistema possui rota de seed em `/api/auth/seed` para criar o super administrador quando necessário. A rota exige o header `x-seed-token` com o valor de `SEED_ADMIN_TOKEN`.

Exemplo:

```bash
curl -X POST http://localhost:3003/api/auth/seed \
  -H "x-seed-token: $SEED_ADMIN_TOKEN"
```

Use senha forte em `INITIAL_ADMIN_PASSWORD` e troque-a após o primeiro acesso.

## Funcionalidades

- Upload de atas em PDF
- Processamento automático de turmas, alunos, notas, turno e resultado
- Filtros por escola, turma, turno, resultado e aluno
- Painel geral
- Perfil do aluno
- Perfil da turma
- Perfil da escola
- Ranking de alunos
- Comparativo entre turmas
- Análise por disciplina
- Mapa de calor
- Relatórios abaixo da média
- Exportação em PDF, CSV e Excel
- Gestão de escolas e usuários

## Perfis de usuário

Perfis disponíveis:

- `SUPER_ADMIN`: acesso administrativo total
- `ADMIN`: administração geral
- `DIRECAO`: direção escolar
- `COORDINATOR`: coordenação
- `ADVISOR`: orientação
- `MANAGER`: gestão
- `TEACHER`: professor
- `VIEWER`: observador

Usuários `SUPER_ADMIN`, `ADMIN` e `DIRECAO` vinculados a uma escola recebem vínculo escolar administrativo.

## Identidade visual

Os assets da marca ficam em:

```text
public/brand/
```

Arquivos principais:

- `logo-symbol.svg`
- `logo-horizontal.svg`
- `logo-horizontal-dark.svg`
- `logo-stacked.svg`

O favicon usa:

```text
public/logo.svg
```

## Uploads e dados locais

Os arquivos abaixo são dados locais de execução e não devem ser versionados:

- `.env`
- `.next/`
- `node_modules/`
- `db/*.db`
- `uploads/`
- `upload/`
- `public/uploads/`
- logs (`*.log`)

## Validação

Antes de publicar alterações:

```bash
npm run lint
npx tsc --noEmit
npm audit --audit-level=moderate
npm run build
```
