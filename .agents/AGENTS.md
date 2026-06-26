# 🌌 DIRETRIZES DO AGENTE (AGENTS.md) | colaboraEDU Analytics

Este arquivo serve como o mapa de navegação e restrições de comportamento para qualquer agente de Inteligência Artificial que colabore neste repositório.

---

## 🔁 Ciclo de Vida do Contexto

> [!IMPORTANT]
> **LEITURA OBRIGATÓRIA NO INÍCIO DO CHAT:**
> Toda vez que uma nova sessão de interação ou tarefa for iniciada neste repositório, você **DEVE** ler este arquivo (`.agents/AGENTS.md`) e os documentos técnicos na pasta `docs/` para se sintonizar com a arquitetura atual, decisões de projeto e estado técnico das tarefas.

### Diretriz de Atualização Contínua
Sempre que você realizar mudanças estruturais significativas no projeto — como:
- Alterações em schemas de banco de dados (`prisma/schema.prisma`).
- Mudanças nas rotas de API críticas ou comportamento do middleware de autenticação.
- Modificações no fluxo ou regras do parser de PDF (`scripts/parse_ata.py`).
- Alterações nos processos de deploy ou dependências do sistema.

Você **DEVE** atualizar a documentação correspondente em `docs/PRD.md` e `docs/ARCHITECTURE.md`, assim como revisar as regras deste arquivo (`.agents/AGENTS.md`) e as automações descritas na skill customizada `.agents/skills/colaboraedu-ops/SKILL.md`.

---

## 🎯 Arquitetura & Fluxo Técnico Resumido

- **Frontend SPA (Single Page Application):** O frontend é renderizado na raiz `/` (através de `src/app/page.tsx`) e é controlado de forma dinâmica por um estado global no Zustand (`src/store/useAppStore.ts`) por meio da propriedade `activeView`. Não crie novas rotas de página Next.js a menos que seja explicitamente solicitado; em vez disso, estenda o `ActiveView` no Zustand e crie um componente sob `src/components/`.
- **Backend API Handlers:** Rotas de API localizadas in `src/app/api/` processam requisições, gerenciam autenticação de sessão e interagem com o banco de dados.
- **Banco de Dados:** O sistema utiliza SQLite local em desenvolvimento e produção atual, mapeado pelo Prisma ORM (`prisma/schema.prisma`). Existe um plano ativo de migração futura para PostgreSQL.
- **Parser de PDF (Python + pdfplumber):** O backend Next.js invoca via subprocesso (`execFileSync`) o script Python `scripts/parse_ata.py` para extrair os dados textuais e tabulares estruturados dos PDFs das atas de notas escolares.

---

## 🔒 Padrões de Código e Diretrizes de Segurança

- **Autenticação e Sessões:** As APIs exigem autenticação protegida por cookies com tokens assinados digitalmente via HMAC SHA-256 (`src/lib/session.ts`). O middleware (`src/middleware.ts`) intercepta as rotas protegidas. Não faça bypass desta segurança.
- **Multi-tenancy por Escola:** Toda consulta a dados de alunos, turmas ou relatórios deve ser escopada e validada para a(s) escola(s) às quais o usuário autenticado tem acesso, a menos que ele seja um `SUPER_ADMIN` ou `ADMIN`. Utilize os helpers de escopo localizados em `src/lib/api-auth.ts`.
- **Segurança de Planilhas (CSV/XLSX):** O exportador de Excel foi reimplementado usando OpenXML básico compactado via `fflate` para evitar bibliotecas externas pesadas e vulneráveis. Qualquer exportação de dados em CSV ou planilha deve passar pela higienização de injeção de fórmulas, limpando ou neutralizando os prefixos `=`, `+`, `-` ou `@`.
- **Validação de Arquivos de PDF:** Uploads de PDF devem ser checados no backend quanto ao tamanho máximo (20MB), extensão (`.pdf`), tipo MIME (`application/pdf`) e a assinatura mágica de cabeçalho (`%PDF-`).

---

## 🛠️ Utilização de Skills Customizadas

> [!TIP]
> Este projeto possui uma Skill Customizada que documenta e automatiza tarefas operacionais repetitivas (como migrações de banco de dados, geração do Prisma Client, builds locais, auditorias e deploys na VPS).
> 
> Antes de executar tarefas de operações no terminal, você **DEVE** ler as instruções em:
> - [.agents/skills/colaboraedu-ops/SKILL.md](file:///home/suporte/colaboraEDUanalytics/.agents/skills/colaboraedu-ops/SKILL.md)

Siga rigorosamente as diretrizes operacionais lá contidas para evitar falhas ou inconsistências de build em produção.
