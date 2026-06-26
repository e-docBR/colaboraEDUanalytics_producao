---
name: colaboraedu-ops
description: Automação de tarefas operacionais, gerenciamento de banco de dados, execução de builds e deploy local para VPS no projeto colaboraEDU Analytics.
---

# 🛠️ Skill colaboraedu-ops | Automações e Operações do Projeto

Esta skill orienta o agente de IA a gerenciar o ciclo de desenvolvimento, banco de dados e deploy do **colaboraEDU Analytics**.

---

## 💻 1. Execução de Auditorias e Builds Locais

Antes de qualquer entrega ou deploy, você **DEVE** garantir a integridade do código rodando a sequência de validação:

### A. Executar o Linter
Valida padrões estéticos e possíveis bugs de sintaxe:
```bash
npm run lint
```

### B. Validar Tipos TypeScript
Garante que não existem inconsistências de tipagem ou exportações incorretas:
```bash
npx tsc --noEmit
```

### C. Build de Teste Local
Garante que o build de produção (Next.js standalone) compila com sucesso:
```bash
npm run build
```

---

## 🗄️ 2. Gerenciamento do Banco de Dados (Prisma ORM)

Qualquer alteração no arquivo `prisma/schema.prisma` exige a execução das operações abaixo.

### A. Atualizar o Prisma Client
Sempre rode isso após puxar alterações do repositório ou alterar o schema:
```bash
npm run db:generate
```

### B. Aplicar Schema em Ambiente de Desenvolvimento (Push)
Aplica as mudanças de schema diretamente no banco local SQLite sem criar migrations (ideal para testes rápidos):
```bash
npm run db:push
```

### C. Criar e Aplicar Migrations (Migrate)
Para criar migrações incrementais versionadas (necessário antes de deploys de produção):
```bash
npm run db:migrate
```

### D. Resetar o Banco Local
Limpa todas as tabelas e recria o banco SQLite do zero:
```bash
npm run db:reset
```

---

## 🌱 3. Criar Administrador Inicial (Seed/Bootstrap)

Se o banco de dados for reiniciado ou estiver vazio, você pode criar o administrador inicial realizando uma chamada HTTP ao endpoint `/api/auth/seed` passando o token definido nas variáveis de ambiente.

### Chamada Local via curl:
```bash
curl -X POST http://localhost:3000/api/auth/seed \
  -H "Content-Type: application/json" \
  -H "x-seed-token: SEU_SEED_ADMIN_TOKEN_DEFINIDO_NO_ENV"
```

A rota lerá as variáveis `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` do seu arquivo `.env` para criar a conta.

---

## 🚀 4. Deploy Automatizado para VPS

O deploy do sistema na VPS (`185.187.170.35`) é feito executando o script local sob `deploy/deploy-to-vps.sh` da máquina de desenvolvimento. Ele se conecta via SSH, sincroniza os arquivos via `rsync`, instala dependências remota, atualiza o banco Prisma, gera o build standalone e reinicia o Caddy e o systemd.

### Comando para Deploy:
```bash
./deploy/deploy-to-vps.sh
```

### Comandos Úteis de Monitoramento Remoto (na VPS):

Para debugar ou verificar se o serviço está saudável na VPS, conecte via SSH e utilize:

- **Ver logs do servidor Next.js:**
  ```bash
  sudo journalctl -u analytics-colaboraedu -f
  ```

- **Verificar status do serviço systemd:**
  ```bash
  sudo systemctl status analytics-colaboraedu
  ```

- **Reiniciar o servidor manualmente:**
  ```bash
  sudo systemctl restart analytics-colaboraedu
  ```

- **Testar conectividade local:**
  ```bash
  curl -I http://127.0.0.1:3005
  ```
