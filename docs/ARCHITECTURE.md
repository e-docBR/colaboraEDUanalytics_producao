# 📐 Especificação Arquitetural | colaboraEDU Analytics

Este documento descreve a arquitetura técnica, modelo de dados, infraestrutura e fluxos de dados do colaboraEDU Analytics.

---

## 1. Visão Geral da Arquitetura

O sistema é construído como uma aplicação monolítica utilizando **Next.js 16** (React 19), com APIs no backend (*Route Handlers*) e uma interface de página única (*Single Page Application*) controlada por estado global no frontend. Para processamento pesado de extração de dados de PDFs, o backend Next.js interage de forma síncrona via subprocesso com um script **Python 3** independente.

```
┌─────────────────────────────────────────────────────────┐
│                    Navegador Web                        │
│   (Frontend SPA: React 19 + Zustand + Tailwind CSS)     │
└────────────┬─────────────────────────────▲──────────────┘
             │ Chamadas HTTP API           │ Respostas JSON
             ▼                             │
┌──────────────────────────────────────────┴──────────────┐
│                  Next.js API Handler                    │
│        (src/app/api/ e src/middleware.ts)               │
└────────────┬─────────────────────────────▲──────────────┘
             │                             │
             │ execFileSync                │ Retorna JSON
             ▼                             │
┌───────────────────────────┐ ┌────────────┴──────────────┐
│   Script Python Parser    │ │        Prisma ORM         │
│   (scripts/parse_ata.py)  │ │   (prisma/schema.prisma)  │
└────────────┬──────────────┘ └────────────┬──────────────┘
             │                             │
             ▼ pdfplumber                  ▼ SQL Queries
┌───────────────────────────┐ ┌───────────────────────────┐
│     Atas PDF em disco     │ │    Banco de Dados SQL     │
│       (uploads/)          │ │    (SQLite / Postgres)    │
└───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Fluxo de Dados: Processamento de PDF

O diagrama de sequência a seguir ilustra o ciclo completo de upload e ingestão de dados pedagógicos:

```mermaid
sequenceDiagram
    participant Front as Frontend (Zustand SPA)
    participant API as Next.js Route Handler (/api/uploads/[id]/process)
    participant DB as Banco SQLite (Prisma)
    participant Py as Script Python (parse_ata.py)
    participant FS as Disco Rígido (uploads/)

    Front->>API: Envia PDFs via multipart/form-data
    API->>FS: Grava o PDF em uploads/pdfs/[unique_name].pdf
    API->>DB: Cria registro de Upload (status: pending)
    API-->>Front: Retorna Upload ID
    Front->>API: Dispara processamento (/api/uploads/[id]/process)
    API->>DB: Atualiza Upload (status: processing)
    API->>Py: Executa subprocesso (python3 scripts/parse_ata.py <pdf_path>)
    Note over Py: Abre PDF via pdfplumber<br/>Extrai Escola, Turma, Alunos, Notas<br/>Gera avisos/warnings de inconsistências
    Py-->>API: Retorna JSON estruturado
    API->>DB: Upsert Escola (verifica por INEP ou Nome)
    API->>DB: Upsert Turma (verifica por Escola/Série/Turma/Ano)
    API->>DB: Upsert Disciplinas (Subjects)
    loop Para cada aluno extraído
        API->>DB: Upsert Aluno (verifica por nome e turma)
        loop Para cada nota do aluno
            API->>API: Calcula nota do período (cumulative - previous)
            API->>DB: Upsert Nota (Grade)
        end
    end
    API->>DB: Deleta inconsistências antigas daquela turma
    API->>DB: Cria novas inconsistências (warnings da ata)
    API->>DB: Atualiza Upload (status: processed)
    API-->>Front: Retorna resumo do processamento (sucesso/erro)
    Front->>Front: Dispara recarregamento da view (Zustand refreshTrigger)
```

---

## 3. Modelo de Dados (Relacionamento de Entidades)

O schema do banco de dados está modelado no Prisma e reflete a estrutura hierárquica escolar do Brasil, vinculando usuários a escolas de forma multinível e mantendo o histórico de notas e auditorias de inconsistências acadêmicas.

```mermaid
erDiagram
    User ||--o{ UserSchool : "vinculado a"
    School ||--o{ UserSchool : "vinculada a"
    School ||--o{ SchoolClass : "possui"
    School ||--o{ Upload : "recebeu"
    School ||--o{ Student : "matriculou"
    SchoolClass ||--o{ Upload : "associado"
    SchoolClass ||--o{ Student : "aloca"
    Upload ||--o{ Student : "importou"
    Upload ||--o{ Inconsistency : "gerou"
    Student ||--o{ Inconsistency : "possui"
    Student ||--o{ Grade : "recebe"
    Subject ||--o{ Grade : "pertence"

    User {
        string id PK
        string name
        string email
        string passwordHash
        string role
        boolean isActive
    }
    UserSchool {
        string id PK
        string userId FK
        string schoolId FK
        string role
    }
    School {
        string id PK
        string name
        string inep
        string city
        string state
    }
    SchoolClass {
        string id PK
        string schoolId FK
        string grade
        string name
        string shift
        float minimumAverage
        int year
    }
    Upload {
        string id PK
        string filename
        string originalName
        string period
        string status
        string schoolId FK
        string classId FK
    }
    Student {
        string id PK
        string name
        string birthDate
        string gender
        string finalResult
        string uploadId FK
        string schoolId FK
        string classId FK
    }
    Subject {
        string id PK
        string name
    }
    Grade {
        string id PK
        string studentId FK
        string subjectId FK
        float score
        string period
        float cumulativeScore
        float previousCumulativeScore
    }
    Inconsistency {
        string id PK
        string uploadId FK
        string type
        string message
        string studentId FK
    }
```

### Principais Entidades e Regras de Negócio:
1. **User e UserSchool:** Gerenciam permissões de escopo. Um usuário com perfil que não seja `SUPER_ADMIN` ou `ADMIN` só pode acessar dados pedagógicos se estiver associado à escola através da tabela intermediária `UserSchool`.
2. **SchoolClass:** Modela a turma escolar. A unicidade é garantida pela combinação de `[schoolId, grade, name, shift, year]`.
3. **Upload:** Controla a fila e o histórico de processamento dos arquivos. Cada processamento gera novos alunos ou atualiza alunos existentes.
4. **Grade:** Armazena as notas individuais. Guarda a nota líquida calculada para o período letivo (`score`) e as notas acumuladas (`cumulativeScore` e `previousCumulativeScore`) usadas para a lógica incremental.
5. **Inconsistency:** Tabela de auditoria que aponta os erros detectados pelo processador de PDF nas regras BNCC.

---

## 4. Infraestrutura de Deploy e Produção

O projeto está configurado para publicação em um servidor VPS Linux dedicado sob o domínio `https://analytics.colaboraedu.cloud` utilizando:

- **Cloudflare DNS & Proxy:** Encaminha requisições seguras HTTPS para a VPS com certificado SSL no modo *Full (strict)*.
- **Caddy (Reverse Proxy):** Escuta na porta `80` e `443` e atua como proxy reverso local, redirecionando o tráfego HTTP para o servidor Next.js standalone rodando na porta interna `3005`.
- **Systemd Service (`analytics-colaboraedu.service`):** Gerencia a inicialização, paradas e reinicializações automáticas do processo Node.js standalone do Next.js.
- **SQLite local (`db/custom.db`):** Banco relacional em arquivo local na VPS.

---

## 5. Mapeamento da Ingestão de Notas Incrementais

A nota pedagógica do conselho de classe ou do boletim é cumulativa por trimestre. O cálculo é feito dinamicamente no backend Next.js pela função `getScoreForUploadPeriod` localizada em [route.ts](file:///home/suporte/colaboraEDUanalytics/src/app/api/uploads/%5Bid%5D/process/route.ts):

- **1º Trimestre (`TRIMESTER_1`):** A nota do período é exatamente a nota que vem no PDF.
- **2º Trimestre (`TRIMESTER_2`):** Exige que o 1º Trimestre já esteja processado. Nota do Período = (Nota Acumulada do 2º Trimestre) - (Nota Acumulada do 1º Trimestre).
- **3º Trimestre (`TRIMESTER_3`):** Exige o 2º Trimestre processado. Nota do Período = (Nota Acumulada do 3º Trimestre) - (Nota Acumulada do 2º Trimestre).
- **Resultado Final (`FINAL_RESULT`):** Exige o 3º Trimestre processado. Nota do Período = (Nota Acumulada Final) - (Nota Acumulada do 3º Trimestre).
