// Verifica a FIAÇÃO das fontes do template de enfermagem (sem banco): dado o `vars` que buildTemplateVars
// monta a partir das aplicações do medicamento base, cada campo de medicação resolve pro valor certo.
// Replica valorPorFonte + a ordem de resolução do render (fonte -> SLUG_CANONICO -> carry-forward).
// Roda de total/: node shots/enf-fontes-base.js

// --- réplica fiel do resolvedor do backend (clinico-prontuario.ts) ---
function valorPorFonte(fonte, vars) {
  if (!fonte) return '';
  const mapa = {
    peso_inicial_paciente: 'peso_inicial', peso_objetivo_paciente: 'peso_objetivo',
    health_medicacoes: 'medicacao_uso_continuo', health_ciclo: 'ciclo_menstrual',
    health_alcool: 'alcool', health_hidratacao: 'hidratacao', health_historico_familiar: 'historico_familiar',
    anamnesis_motivacao: 'motivacao', anamnesis_tentativas: 'tentativas_anteriores',
    atividade_fisica_estruturada: 'atividade_fisica',
    med_injetavel_dose: 'med_injetavel_dose', med_injetavel_dose_anterior: 'med_injetavel_dose_anterior',
    med_injetavel_nome: 'med_injetavel_nome', peso_atual_paciente: 'peso_atual',
    nome_paciente: 'nome', idade_paciente: 'idade', sexo_paciente: 'sexo',
  };
  const key = mapa[fonte] || fonte;
  return vars[key] || '';
}
const SLUG_CANONICO = { peso_atual: 'peso_atual', dose_atual: 'med_injetavel_dose', dose_anterior: 'med_injetavel_dose_anterior' };
function resolver(campos, vars, ultimoPorSlug = {}) {
  const out = {};
  for (const c of campos) {
    const vf = valorPorFonte(c.fonte, vars);
    if (vf) { out[c.slug] = { v: vf, origem: c.fonte }; continue; }
    if (SLUG_CANONICO[c.slug] && vars[SLUG_CANONICO[c.slug]]) { out[c.slug] = { v: vars[SLUG_CANONICO[c.slug]], origem: 'paciente' }; continue; }
    if (ultimoPorSlug[c.slug] != null) { out[c.slug] = { v: ultimoPorSlug[c.slug], origem: 'ultimo_acompanhamento' }; continue; }
    out[c.slug] = { v: '', origem: '' };
  }
  return out;
}

// --- campos de medicação do template evolucao-enfermagem (como ficam APÓS o seed novo) ---
const camposMed = [
  { slug: 'med_injetavel', label: 'Medicacao injetavel', fonte: 'med_injetavel_nome' },
  { slug: 'dose', label: 'Dose', fonte: 'med_injetavel_dose' },
  { slug: 'dose_anterior', label: 'Dose anterior', fonte: 'med_injetavel_dose_anterior' },
  { slug: 'dose_atual', label: 'Dose atual', fonte: 'med_injetavel_dose' },
];

let falhas = 0;
const ok = (n, c) => { console.log((c ? '  OK   ' : '  FALHA') + ' ' + n); if (!c) falhas++; };

// A) paciente COM aplicações de base: última 2,5 mg (atual), penúltima 1,25 mg (anterior), med Tirzepatida
const varsBase = { med_injetavel_nome: 'Tirzepatida', med_injetavel_dose: '2,5 mg', med_injetavel_dose_anterior: '1,25 mg' };
const r = resolver(camposMed, varsBase);
console.log('--- com aplicações de base ---');
ok('medicacao injetavel <- nome do medicamento base (Tirzepatida)', r.med_injetavel.v === 'Tirzepatida' && r.med_injetavel.origem === 'med_injetavel_nome');
ok('dose <- dose atual (2,5 mg)', r.dose.v === '2,5 mg');
ok('dose_atual <- dose atual (2,5 mg)', r.dose_atual.v === '2,5 mg' && r.dose_atual.origem === 'med_injetavel_dose');
ok('dose_anterior <- penúltima aplicação (1,25 mg)', r.dose_anterior.v === '1,25 mg' && r.dose_anterior.origem === 'med_injetavel_dose_anterior');

// B) primeira aplicação (só uma dose): atual preenche, anterior vazio
console.log('\n--- primeira aplicação (sem anterior) ---');
const r2 = resolver(camposMed, { med_injetavel_nome: 'Tirzepatida', med_injetavel_dose: '1,25 mg', med_injetavel_dose_anterior: '' });
ok('dose_atual = 1,25 mg', r2.dose_atual.v === '1,25 mg');
ok('dose_anterior fica vazio (não inventa)', r2.dose_anterior.v === '');
ok('medicacao injetavel = Tirzepatida', r2.med_injetavel.v === 'Tirzepatida');

// C) sem base: cai no carry-forward do último acompanhamento (não quebra)
console.log('\n--- sem base, com histórico ---');
const r3 = resolver(camposMed, { med_injetavel_nome: '', med_injetavel_dose: '', med_injetavel_dose_anterior: '' }, { med_injetavel: 'Semaglutida', dose: '0,5 mg' });
ok('medicacao injetavel <- último acompanhamento', r3.med_injetavel.v === 'Semaglutida' && r3.med_injetavel.origem === 'ultimo_acompanhamento');
ok('dose <- último acompanhamento', r3.dose.v === '0,5 mg');
ok('dose_atual vazio (sem base nem histórico do slug)', r3.dose_atual.v === '');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
process.exit(falhas ? 1 : 0);
