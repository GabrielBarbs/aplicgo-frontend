# Roadmap -- Sistema Clínico Aplic & Go

Tarefas mapeadas a partir do PRD §3, §4, §5, §6, §7 que ainda não foram implementadas.
Ordem dos combos: do mais simples ao mais complexo. Cada combo entrega valor sozinho.

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
