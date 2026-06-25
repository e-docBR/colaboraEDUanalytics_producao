---
Task ID: 1
Agent: main
Task: Implement SUPER_ADMIN profile and login page for multi-tenancy system

Work Log:
- Analyzed existing codebase: Prisma schema, auth routes, user management components
- Updated Prisma schema role comment to include SUPER_ADMIN
- Updated seed route to create SUPER_ADMIN instead of ADMIN
- Created /api/auth/logout POST route
- Created /src/middleware.ts for authentication protection
- Created /app/login/page.tsx with Suspense wrapper + /app/login/LoginForm.tsx
- Updated Header component with user info dropdown and logout button
- Updated Sidebar to conditionally show admin section for SUPER_ADMIN/ADMIN
- Updated UserManagementView with SUPER_ADMIN role labels, colors, icons
- Updated /api/users POST to accept SUPER_ADMIN role
- Updated /api/users/[id] PUT to handle SUPER_ADMIN school linking
- Updated /api/users/[id] DELETE to protect last SUPER_ADMIN
- Updated layout metadata to match project branding
- Promoted existing admin@colaboraedu.cloud to SUPER_ADMIN in DB
- Rebuilt and tested all auth flows

Stage Summary:
- Login page at /login works with email/password
- Middleware protects all routes (redirect to /login if no session)
- API routes return 401 if no session token
- SUPER_ADMIN has full access, Admin section visible only to SUPER_ADMIN/ADMIN
- Login credentials: admin@colaboraedu.cloud / admin123
- All tests pass: 200 for login page, 307 redirect for protected, 200 with session, 401 for API without auth

---
Task ID: 2
Agent: Antigravity
Task: Adicionar gráfico de barras de disciplinas no PDF de Alunos Abaixo da Média

Work Log:
- Atualizada assinatura de `generateLowGradesOnlyPDF` em `src/lib/pdfGenerator.ts` para receber dados de `subjectAnalysis` e `threshold`.
- Habilitada lógica de posicionamento dinâmico do gráfico de disciplinas usando `lastAutoTable.finalY` após a tabela de alunos.
- Implementada quebra de página automática caso a folha A4 não tenha espaço suficiente para desenhar o gráfico completo (~72mm de altura útil).
- Desenho vetorial nativo do gráfico de barras de disciplinas no jsPDF com a cor laranja (#f97316).
- Adicionados rótulos estáticos de valores no topo de cada barra para legibilidade na impressão física.
- Ajustadas as legendas das disciplinas no eixo X para rotacionar a 315° (diagonal de cima para baixo, esquerda para a direita) com alinhamento à esquerda (`align: 'left'`) para impedir sobreposições.
- Integrado o botão "Exportar PDF" no frontend em `src/components/low-grades/LowGradesView.tsx` enviando os dados de disciplinas corretamente.
- Testado e verificado com sucesso no ambiente local de build e feito o deploy definitivo em produção na VPS.
