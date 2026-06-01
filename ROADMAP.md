# Roadmap -- Sistema Clínico Aplic & Go

## Prontuário -- completude essencial ✅ (parcial)
- [x] Faixa de alerta de segurança (alergias em vermelho + comorbidades) sempre visível no header
- [x] Contexto no header: próximo retorno, última evolução, médico, nutri
- [x] Prescrição imprimível (janela de impressão / salvar PDF com cabeçalho da clínica, paciente, itens, assinatura)
- [ ] Anexos de exames/documentos/fotos (precisa storage -- S3/R2 ou disco VPS) -- PENDENTE decisão do Matheus
- [ ] Assinatura/travamento de evolução (compliance CFM) -- Onda 2
- [ ] Resultado de exame estruturado + análise -- Onda 2
- [ ] Impressão do prontuário completo -- Onda 2


Tarefas mapeadas a partir do PRD §3-§7 e da Aula 05/29 (Jornada do Paciente).
Ordem dos combos: do mais simples ao mais complexo. Cada combo entrega valor sozinho.

---

## Combos da Jornada do Paciente (05/29) -- iniciando

### Combo A · Multi-cargo + estrutura de permissões (fundação) -- EM PROGRESSO
- [x] Schema: `ClinCargo`, `ClinPermissao`, `ClinCargoPermissao`, `UserClinCargo` (N:N)
- [x] /api/clinico/me devolve `cargos[]` e `permissoes[]`
- [x] Helper backend `temPermissao(req, slug)` + middleware `requirePermissao`
- [ ] SQL com 7 cargos + ~40 permissões granulares + migração de users existentes

### Combo B · Aba ADMIN -- white label de permissões ✅ FEITO
- [x] Sidebar "Administração" (só visível pra quem tem `admin.gerenciar_permissoes` / `admin.gerenciar_usuarios` / `admin.gerenciar_cargos`)
- [x] Matriz cargos × permissões editável em checkboxes, agrupada pelos 11 grupos
- [x] Toggle "marcar/desmarcar todos" por grupo
- [x] Botão "Salvar mudanças" aparece só quando há alteração não salva (estado dirty)
- [x] Modal de criar/editar cargo (nome, slug, cor, ícone, ordem, descrição, ativo)
- [x] Inativar cargo (soft delete, mantém histórico)
- [x] Tela "Usuários" com lista de todos + cargos atuais como pills
- [x] Modal de toggle de cargos por usuário (multi-cargo)
- [x] Endpoints admin: GET/POST/PUT/DELETE cargos, GET permissoes, PUT cargos/permissoes, GET usuarios, PUT usuarios/cargos

### Combo C · Permissões aplicadas no frontend ✅ FEITO
- [x] Helper global `temPermissao(slug)` + `temPermissaoExpr(perm1|perm2)`
- [x] `aplicarPermissoesNaUI()` percorre todo `[data-perm]` e esconde quem não passa
- [x] Sidebar items com `data-perm`: Pacientes, Agenda, Prontuário, Aplicações, Estoque, Auditoria, Financeiro
- [x] Grupos da sidebar se escondem quando todos os itens estão ocultos
- [x] Botões "Novo paciente", "Novo agendamento", "Bloquear", "Nova evolução", "Nova prescrição", "Solicitar exames" com `data-perm`
- [x] `trocarView` bloqueia view sem permissão -- redireciona pra Visão Geral

### Tarefas Combo C -- pra depois
- [ ] Chip colorido com os cargos do user no topbar/userpill
- [ ] "Editar paciente" com permissão `paciente.editar`
- [ ] "Bloquear" dentro do modal de agendamento checar permissão
- [ ] Botão "Nova bioimpedância" com `prontuario.bioimpedancia.registrar`
- [ ] Mensagem "Sem permissão" quando entra em URL/view bloqueada
- [ ] Hot-reload do `/me` sem precisar logout (fetch ao trocar de aba)

### Combo D · Onboarding do paciente (Aula Cap 3) ✅ FEITO
- [x] Schema `ClinPatientOnboarding` 1:1 com paciente, com timestamps + "por quem" pra cada check
- [x] Botão "Onboarding" no detalhe do paciente (ao lado de Editar/Abrir prontuário)
- [x] Modal com 6 checks (3 essenciais: kit, contrato_assinado, termo_assinado)
- [x] Cada item tem botão "Marcar"/"Desfazer" com timestamp automático
- [x] Barra de progresso visual com % e contagem
- [x] Datas opcionais: cronograma (consulta médica, nutri, 1ª aplicação)
- [x] Campos opcionais: número do contrato, programa fechado em, observações
- [x] Botão "Finalizar onboarding" só habilita quando os 3 essenciais estão marcados
- [x] Auto-promoção: ao finalizar, paciente INCOMPLETO/PRE_PROGRAMA vira ATIVO automático
- [x] Endpoints: GET /:id/onboarding, PUT /:id/onboarding, GET /onboarding/pendencias
- [x] Audit log em cada finalização

### Tarefas Combo D -- pra depois
- [ ] Atribuir médico/nutri direto pelo modal (hoje precisa abrir Editar)
- [ ] Vincular agendamentos: criar realmente o evento de agenda ao preencher datas
- [ ] Upload do PDF do contrato e termo (anexar no documento do paciente)
- [ ] Notificação WhatsApp pro paciente em cada milestone

### Combo E · Cards por profissional no prontuário (Aula Cap 5) ✅ FEITO
- [x] 3 cards no topo do prontuário: Médica (azul), Nutricional (verde), Enfermagem (laranja)
- [x] Cada card mostra a **última evolução** do profissional do tipo correspondente
- [x] Resumo com profissional, data/hora, badge do template, sinais vitais (peso/PA/FC) e primeiros 280 chars do conteúdo
- [x] Botão "+ Nova" dentro do card só aparece pra quem tem `prontuario.evolucao_*.criar`
- [x] Cards recolhíveis (estado individual por tipo)
- [x] Histórico completo agora em seção recolhível abaixo dos cards
- [x] Atalho `prAbrirNovaEvolTipo()` pré-seleciona o tipo no modal de evolução
- [x] Botão "Abrir / Editar" em cada card vai direto na evolução
- [x] Bonus extra: ação de Onboarding atalho no modal de status da agenda

### Combo Dev · Painel do Desenvolvedor ✅ FEITO
- [x] Novo cargo `desenvolvedor` + permissão `dev.acesso`
- [x] Backend `/api/clinico/dev/overview` retorna snapshot completo (sistema, memória, DB, audit, env, cargos)
- [x] Endpoint extra `/dev/audit` paginado + `/dev/ping` healthcheck
- [x] Frontend nova view com 6 cards de stats: Sistema, Memória, Banco, Usuários, Audit 24h, Env vars (mascarado)
- [x] Tabela com tamanho por tabela + barras visuais
- [x] Tabela de cargos clínicos com contadores
- [x] Tabela de últimas 50 ações do audit log (pílulas coloridas por ação)
- [x] Auto-refresh a cada 60s
- [x] Mascaramento de senhas em DATABASE_URL e JWT_SECRET
- [x] Sidebar item "Desenvolvedor" visível com data-perm

### Combo F · Painel de pendências da Recepção (Aula Cap 6) ✅ FEITO
- [x] Aba "Pendências" no sidebar (visível com `onboarding.ver_pendencias`)
- [x] 5 cards de stats: kits pendentes, contratos não assinados, termos, cronogramas, parados 7+ dias
- [x] Lista de pacientes com:
  * Nome, código, status, telefone, unidade
  * Pills coloridas de cada check (verde = feito, laranja = essencial faltando, cinza = faltando)
  * Barra de progresso visual com %
  * Indicador de dias parados (amarelo > 7 dias, vermelho > 15 dias) com borda lateral colorida no card
- [x] Filtros: por tipo de pendência (kit/contrato/termo/cronograma) e por dias parados (7+/15+/30+)
- [x] Ordenação automática pelos mais parados primeiro
- [x] Botão "Onboarding" em cada card abre o checklist direto
- [x] Auto-recarrega após finalizar onboarding pra remover paciente da lista

---

## Combo 1 -- Refinamentos do cabeçalho ✅ FEITO

- [x] Renomear/expandir enum de status (PRE_PROGRAMA, CONCLUIDO, INATIVO, REATIVAVEL)
- [x] Programa, fase, persona, momento de vida no cadastro
- [x] Início e duração em semanas → cálculo automático "Semana N de M"
- [x] Status clínico manual (Estável/Atenção/Urgência)
- [x] Observações imutáveis do médico (campo + destaque visual)
- [x] Atividade física estruturada (modalidade + frequência + duração)
- [x] Badges expandidos no header rico do prontuário

### Tarefas Combo 1 -- pra depois

- [ ] Bloqueio de edição de "Observações imutáveis" depois da primeira gravação
- [ ] Bloqueio por role: só médico edita obs imutáveis
- [ ] Migração de pacientes existentes: INCOMPLETO → PRE_PROGRAMA, FINALIZADO → CONCLUIDO

---

## Combo 2 -- Card clínico fixo (3 blocos) ✅ FEITO

- [x] Nova tabela `ClinMedicacaoAtual` (paciente, tipo: injetavel/oral/suplemento, dose, frequência, desde quando, ativa)
- [x] **Bloco A** -- Injetável atual: molécula, dose atual, dose anterior, próxima dose prevista
- [x] **Bloco B** -- Medicações orais + Suplementação Take & Go (Start/Burn/Build/Slim) + Aplic PLUS + outros
- [x] **Bloco C** -- Idade, gênero, comorbidades, atividade física (resumo imutável)
- [x] Modal pra adicionar/editar medicação ativa
- [x] Card visível abaixo do header rico do prontuário
- [x] Soft-delete via flag `ativa` (mantém histórico)

### Tarefas Combo 2 -- pra depois

- [ ] Estoque do lote em uso no Bloco A (depende do Combo 4/5)
- [ ] Dose semana anterior auto-preenchida pelo registro da enfermagem (Combo 4)
- [ ] Auto-incluir suplementos Take & Go vinculados ao programa do paciente
- [ ] Auto-marcar semana atual do Aplic PLUS

---

## Combo 3 -- Bioimpedância manual + gráfico de evolução ✅ FEITO

- [x] Modal rápido pra enfermagem digitar (peso, % gordura, massa gordura, massa magra, massa muscular, TMB, gordura visceral)
- [x] Schema `ClinBioimpedance` expandido com `massaGorduraKg`, `massaMuscularKg`
- [x] 5 circunferências antropométricas adicionadas (cintura, quadril, abdômen, braço D, coxa D)
- [x] Gráfico de evolução corporal com SVG nativo (sem dependência)
- [x] 4 séries plotáveis com toggle on/off: peso, massa muscular, massa gordura, % gordura
- [x] Tooltip ao passar mouse nos pontos
- [x] Botão "Nova bioimpedância" no header do gráfico
- [x] IMC calculado automaticamente quando altura preenchida
- [x] Hidratação opcional (total/intracelular/extracelular)
- [x] Novo endpoint GET /aplicacoes/bio/patient/:id/serie -- timeseries enxuto pro gráfico

### Tarefas Combo 3 -- pra depois

- [ ] Marcadores de transição de fase no gráfico (BURN_1 → BURN_2 etc)
- [ ] Marcadores de aplicação no gráfico (cada bioimpedância pode ser em dia de aplicação)
- [ ] Comparação entre 2 datas (delta percentual de cada métrica)
- [ ] Gráfico de circunferências (linha por circunferência)
- [ ] Sync InBody automático (Onda 2)

---

## Combo 4 -- Modal de aplicação da enfermagem (PRD §7)

- [ ] Modal com os 12 campos exatos:
  1. Medicação em uso (auto-preenchido da prescrição vigente)
  2. Dose dessa sessão (mg)
  3. Dose anterior (read-only ao lado, cross-check)
  4. Lote (scanner QR câmera ou manual)
  5. Validade do lote (auto, bloqueia se vencido)
  6. Efeitos colaterais (checklist + intensidade + texto)
  7. Controle de fome (alta/sob controle/zerada)
  8. Adesão à dieta declarada (alta/baixa)
  9. Atividade física na semana (0/1/2/3/4+)
  10. Satisfação do paciente (sim/parcial/não)
  11. Conduta próxima dose (manter/aumentar/reduzir)
  12. Logística próxima dose (paciente leva/enviar/deixar/agendar viagem)
- [ ] Campos opcionais: antecipar N doses, observação, foto frente/lado/costas
- [ ] Bloqueio: sem lote escaneado, salvar bloqueia
- [ ] Bloqueio: lote vencido, salvar bloqueia
- [ ] 9 eventos automáticos ao salvar:
  - Cria registro `application`
  - Cria `inventory_movement` SAIDA
  - Atualiza cabeçalho do prontuário (dose atual, última aplicação)
  - Notifica paciente (placeholder ainda)
  - Atualiza Radar de Risco (entra no Combo 5)
  - Atualiza ranking enfermeira (entra futuro)
  - Pendência médica se efeito colateral moderado/severo
  - Pendência médica se "Reduzir dose"
  - Audit log com before/after

---

## Combo 5 -- Prescrição de injetáveis + fluxo recepção/enfermagem (PRD §5)

- [ ] Schema da prescrição ganha: `protocolo` (Aplic PLUS / Lipedema / NAD+ / etc), `duracao_semanas`, `frequencia` (semanal/quinzenal/mensal), `observacoes_tecnicas_enfermagem`, **`incluso_no_protocolo`** (bool)
- [ ] Nova tabela `ClinProtocoloPacote` -- N sessões vinculadas à prescrição, consome 1 por aplicação
- [ ] **Fluxo "Incluso"**: notificação direta na enfermagem, alerta piscante no painel
- [ ] **Fluxo "Não incluso"**: pendência pra recepção orçar → após pagamento, libera pra enfermagem
- [ ] Pula automaticamente a semana 6 do Aplic PLUS (SOP 4.2.3.a)
- [ ] Nova tabela `ClinNotificacao` (destinatário, tipo, alerta visual, lida em)

---

## Combo 6 -- Anamnese estruturada + tela pública

- [ ] JSON-schema dos 17 grupos da anamnese médica
- [ ] JSON-schema das 8 seções da anamnese nutricional
- [ ] Tela pública `/anamnese/<token>` mobile-first
- [ ] Backend recebe respostas e mergeia no perfil do paciente
- [ ] Roda da Vida (componente visual)
- [ ] TCLEs digitais (anexos)

---

## Tarefas pra depois -- não cabe nos combos

### Anamnese conectada ao WhatsApp
- [ ] Integração com WhatsApp Business API (oficial ou Twilio/Zenvia)
- [ ] Envio automático do link de anamnese
- [ ] Recepção de respostas via webhook

### IA e automações
- [ ] Plano alimentar IA (definir LLM + revisão obrigatória da nutri)
- [ ] IA Clínica que analisa exames anexados
- [ ] Mini-relatório IA pós-bioimpedância pro paciente
- [ ] Reagendamento autônomo (M16)

### Onda 2 -- Bioimpedância automatizada
- [ ] Agente local (rclone ou Syncthing) na clínica → bucket S3
- [ ] Parser InBody com 3 planos cascata (ID externo / nome+data+unidade / OCR)
- [ ] S3 event → parser → registro automático em <60s
- [ ] Alerta "Bioimpedância não atribuída" pra gerência quando os 3 planos falham

### Comercial / Pagamentos
- [ ] Calculadora Aplic (programa, valor, comissão por persona)
- [ ] Contrato assinado digitalmente (Clicksign / D4Sign / ITI)
- [ ] Lançamento de pagamentos (recepção) + confirmação (gerência)
- [ ] Reposição de suplemento + ranking + alerta P128 (venda sem indicação)

### Radar de Risco automático
- [ ] Definir todos os triggers (perda <70% por 2 semanas → +3, efeitos severos → +N, ...)
- [ ] Fórmula consolidada de score → status clínico (Estável/Atenção/Urgência)
- [ ] Reavalia automaticamente a cada evento da enfermagem
- [ ] Notificação pra coord clínica quando passa de Atenção pra Urgência

### App do paciente
- [ ] Plano do Paciente (metas conjuntas com badge "Definido pela equipe")
- [ ] Recebe notificações pós-aplicação ("Sua aplicação foi registrada: ...")
- [ ] Anexa fotos próprias e exames

### PDFs e documentos
- [ ] Prescrição em PDF com assinatura digital
- [ ] Plano alimentar em PDF
- [ ] TCLEs assinados anexados no perfil

### Logística avançada
- [ ] Modal "Enviar dose" -- fluxo de envio quando paciente está fora
- [ ] Antecipação de N doses (viagem)
- [ ] Notificação ANVISA cruzada em <15 min em caso de recall

### Gerência / BI
- [ ] Ranking de enfermeiras (M23)
- [ ] Painel de pendências
- [ ] Dashboard de Radar de Risco agregado
- [ ] Relatórios de retenção por persona / programa / fase
