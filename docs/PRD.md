# 📄 PRD (Product Requirement Document) | colaboraEDU Analytics

Este documento descreve os requisitos de produto, escopo, usuários-alvo e o planejamento do sistema colaboraEDU Analytics.

---

## 1. Visão Geral do Produto

O **colaboraEDU Analytics** é uma plataforma analítica para gestão pedagógica e controle de consistência de dados escolares. O sistema centraliza a ingestão de dados de desempenho dos estudantes (a partir de atas escolares em PDF do conselho de classe/resultado final) e fornece visualizações interativas em tempo real. O principal diferencial da plataforma é a capacidade de realizar auditoria de dados acadêmicos com base nas regras estabelecidas pela Base Nacional Comum Curricular (BNCC), apontando inconsistências e anomalias pedagógicas de forma automatizada.

---

## 2. Usuários-Alvo (Persona)

1. **Super Admin / Administrador de TI (Rede de Ensino):** Responsável por gerenciar os acessos, realizar a ingestão primária de dados (seed) e configurar o ambiente para as escolas.
2. **Direção Escolar:** Acompanha os relatórios macro da instituição, analisa a evasão, médias globais e o ranking das turmas.
3. **Coordenação Pedagógica:** Usuário intensivo da plataforma que identifica inconsistências acadêmicas, disciplinas críticas com alta taxa de notas zeradas ou turmas com reprovação atípica, agindo preventivamente junto aos professores.
4. **Professores:** Visualizam o desempenho e o mapa de calor de suas respectivas turmas e disciplinas para ajuste de plano de aula.
5. **Secretaria Escolar:** Realiza os uploads das atas de notas pedagógicas no formato PDF.

---

## 3. Escopo Atual (Funcionalidades Implementadas)

### 3.1. Ingestão de Dados via Upload de PDFs
- **Validação de Segurança:** Aceita arquivos com tamanho máximo de 20MB, extensão `.pdf`, tipo MIME `application/pdf` e cabeçalho verificado `%PDF-` para mitigar uploads maliciosos.
- **Modo Batch:** Suporta o envio simultâneo de até 10 PDFs por requisição.
- **Gestão de Períodos:** O operador seleciona o período letivo correspondente (1º Trimestre, 2º Trimestre, 3º Trimestre ou Resultado Final).

### 3.2. Motor de Extração Pedagógica (Python Parser)
- Processa atas em formato PDF por meio da biblioteca `pdfplumber` no backend.
- **Extração de Metadados:**
  - **Escola:** Identifica nome, código INEP (chave única), cidade, estado, CNPJ e endereço.
  - **Turma:** Identifica série/ano (Ex: "6º ANO A"), turno (Matutino, Vespertino, Noturno, Integral), ano letivo e média mínima para aprovação.
  - **Alunos:** Nome do aluno, data de nascimento, gênero e resultado final.
  - **Notas:** Notas de 10 disciplinas padrão do currículo: *Língua Portuguesa, Arte, Educação Física, Língua Inglesa, Matemática, Ciências, Geografia, História, Ensino Religioso, Educação Financeira*.
- **Cálculo de Notas Periódicas (Incremental):** A ata extrai a nota cumulativa acumulada até o período correspondente. O backend calcula automaticamente a nota real do período subtraindo a nota acumulada anterior.
- **Evitação de Duplicidade:** Caso uma ata seja reenviada, os dados do aluno e as notas são sobrescritos e atualizados em vez de duplicados no banco.

### 3.3. Motor de Inconsistências (Auditoria de Dados)
- O parser detecta e registra em banco alertas automáticos do tipo:
  - `missing_grade`: Estudante sem nenhuma nota lançada no período.
  - `zero_grades`: Estudante com mais de 5 notas zeradas no mesmo período.
  - `class_all_failed`: Casos extremos onde todos os alunos de uma turma foram reprovados.
  - `critical_subject`: Disciplinas com mais de 70% de notas zero na turma.

### 3.4. Interface Analítica (SPA Dashboard)
- Painel reativo com carregamento dinâmico via Zustand, oferecendo:
  - **Filtros Globais:** Escola, Turma, Turno, Situação de Aprovação e campo de busca por nome de aluno.
  - **Módulos de Relatório:**
    - Dashboard de visão geral com KPIs de aprovação, médias e contagem de estudantes.
    - Comparativo de desempenho entre turmas e séries.
    - Ranking de alunos com base nas médias gerais.
    - Mapa de calor (*heatmap*) de notas por disciplina e turma.
    - Perfil consolidado da Escola e da Turma.
    - Perfil individual do estudante, detalhando seu histórico, notas e consistência de dados.

### 3.5. Exportação de Dados
- **Excel Customizado (Seguro):** Geração de planilhas `.xlsx` nativas a partir da estruturação direta de XML OpenXML compactados com `fflate`, eliminando dependências vulneráveis.
- **Prevenção de Formula Injection (CSV/Excel):** Sanitização e neutralização automática de valores que iniciam com `=`, `+`, `-` ou `@`.
- **Relatório PDF:** Exportador de relatórios configurável em formato PDF (`jspdf`/`jspdf-autotable`).

---

## 4. Planejamento de Funcionalidades Futuras (Backlog de Produto)

### 4.1. Escalabilidade de Infraestrutura e Processamento
- **Migração para PostgreSQL:** Substituir o SQLite para suportar simultaneidade multiusuário de grande porte.
- **Processamento Assíncrono:** Mover a extração de PDFs das requisições HTTP síncronas para uma fila de background jobs (Ex: BullMQ, Redis) para evitar timeouts.
- **Transação de Banco:** Agrupar a criação de escolas, turmas, alunos e notas em transações ACID para evitar dados órfãos caso o processamento do PDF quebre no meio do arquivo.

### 4.2. Segurança e Controle de Acesso
- **RBAC Formalizado (Matriz de Permissões):** Estabelecer regras claras por papel de usuário (SUPER_ADMIN, DIRECAO, COORDENADOR, PROFESSOR, VIEWER), ocultando elementos de interface e protegendo endpoints no backend com base nestes papéis.
- **Trilha de Auditoria (Audit Logs):** Registrar logs detalhados de mutações do sistema (login falho, alterações de permissão, exclusões, uploads e exportações).
- **Proteções de Rede e rate-limit:** Adicionar rate limits em logins e rotas de uploads de arquivos.
