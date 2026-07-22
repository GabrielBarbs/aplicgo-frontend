// Aba "Base" no card de ENFERMAGEM: medicamento base (GLP-1) + escada de dose, sem cobrança.
// Roda de total/: node shots/pr-base-aba.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8180';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    const cincoSemanas = new Date(Date.now() - 35 * 86400000).toISOString(); // 5 semanas atrás
    window.pacApi = async (url) => {
      if (/\/protocolos\/prescricoes-base\//.test(url)) return { ok: true, data: { prescricoes: [{
        id: 'pb1', patientId: 'p1', medicamentoBaseSlug: 'tirzepatida', doseInicialMg: 1.25, via: 'SC',
        frequencia: 'semanal', autoAdministrado: true, observacoes: 'Aplicar coxa/abdômen, rodar o local.',
        status: 'prescrita', createdAt: cincoSemanas,
        titulacao: [{ dose_mg: 1.25, semanas: 4 }, { dose_mg: 2.5, semanas: 4 }, { dose_mg: 5, semanas: null }],
      }] } };
      if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [
        { slug: 'tirzepatida', nome: 'Tirzepatida', classe: 'GLP-1/GIP', via: 'SC', alertas: ['Náusea comum no início', 'Contraindicado em CMT'] },
      ] } };
      return { ok: true, data: {} };
    };
    document.getElementById('auth-overlay').style.display = 'none';
    prState.pacienteAtual = { id: 'p1', nome: 'Paciente Teste' };
    prState.timeline = [];

    // A) o card de enfermagem tem a aba "Base"
    const enf = PROF_TIPOS.find(x => x.tipo === 'ENFERMAGEM');
    const htmlEnf = prRenderCardProfissional(enf, null, null, true, false);
    r.tem_aba_base = /prCardTrocarAba\('ENFERMAGEM', 'base'\)/.test(htmlEnf) && /Base/.test(htmlEnf);

    // B) carregar o box
    const host = document.createElement('div');
    host.innerHTML = '<div id="pr-base-box" class="pr-inj-box" style="max-width:470px;padding:14px;background:#0e1116;border-radius:12px"></div>';
    document.body.appendChild(host);
    await prBaseCarregar();
    await new Promise(x => setTimeout(x, 40));
    const box = document.getElementById('pr-base-box');
    const t = box.textContent;
    r.tem_droga = /Tirzepatida/.test(t) && /GLP-1\/GIP/.test(t);
    r.tem_inicial = /1,25 mg/.test(t) && /semanal/.test(t);
    r.tem_flags = /auto-aplicado/.test(t) && /sem cobrança/.test(t);
    r.tem_escada = /Escada de dose/.test(t);
    r.tem_manutencao = /manutenção/.test(t);
    r.tem_alertas = /Náusea/.test(t);
    r.sem_cobranca_de_verdade = !/Aplicar<\/button>/.test(box.innerHTML) && !box.querySelector('.pr-inj-btn');
    // degrau atual estimado: 5 semanas -> índice 1 (2,5 mg) marcado
    const degraus = [...box.querySelectorAll('.pr-base-degrau')];
    r.n_degraus = degraus.length;
    const atual = degraus.find(d => d.classList.contains('atual'));
    r.atual_marcado = !!atual && /2,5 mg/.test(atual.textContent) && /~ atual/.test(atual.textContent);

    // C) função da escada (unit): 5 semanas -> índice 1; 10 semanas -> manutenção (índice 2)
    const T = [{ dose_mg: 1.25, semanas: 4 }, { dose_mg: 2.5, semanas: 4 }, { dose_mg: 5, semanas: null }];
    r.escada5 = prBaseEscadaAtual(T, new Date(Date.now() - 35 * 86400000).toISOString()) === 1;
    r.escada10 = prBaseEscadaAtual(T, new Date(Date.now() - 70 * 86400000).toISOString()) === 2;

    // D) sem prescrição base -> vazio honesto
    window.pacApi = async (url) => {
      if (/\/protocolos\/prescricoes-base\//.test(url)) return { ok: true, data: { prescricoes: [] } };
      if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [] } };
      return { ok: true, data: {} };
    };
    prState.baseCache = null;
    await prBaseCarregar(); await new Promise(x => setTimeout(x, 40));
    r.vazio_honesto = /Sem medicamento base prescrito/.test(document.getElementById('pr-base-box').textContent);
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- aba Base ---');
  ok('card tem a aba "Base"', out.tem_aba_base);
  console.log('\n--- conteúdo ---');
  ok('droga base + classe (do catálogo)', out.tem_droga);
  ok('dose inicial + frequência', out.tem_inicial);
  ok('flags auto-aplicado + sem cobrança', out.tem_flags);
  ok('escada de dose + manutenção', out.tem_escada && out.tem_manutencao);
  ok('alertas do catálogo', out.tem_alertas);
  ok('NÃO tem botão de aplicar/cobrar', out.sem_cobranca_de_verdade);
  console.log('\n--- escada ---');
  ok('3 degraus', out.n_degraus === 3, String(out.n_degraus));
  ok('degrau atual estimado (5 sem -> 2,5 mg)', out.atual_marcado);
  ok('cálculo da escada: 5 sem -> índice 1', out.escada5);
  ok('cálculo da escada: 10 sem -> manutenção (2)', out.escada10);
  console.log('\n--- vazio ---');
  ok('sem base -> mensagem honesta', out.vazio_honesto);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  await p.evaluate(async () => { prState.baseCache = null; window.pacApi = async (url) => {
    if (/\/protocolos\/prescricoes-base\//.test(url)) return { ok: true, data: { prescricoes: [{ id: 'pb1', medicamentoBaseSlug: 'tirzepatida', doseInicialMg: 1.25, via: 'SC', frequencia: 'semanal', autoAdministrado: true, observacoes: 'Aplicar coxa/abdômen, rodar o local.', status: 'prescrita', createdAt: new Date(Date.now() - 35 * 86400000).toISOString(), titulacao: [{ dose_mg: 1.25, semanas: 4 }, { dose_mg: 2.5, semanas: 4 }, { dose_mg: 5, semanas: null }] }] } };
    if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [{ slug: 'tirzepatida', nome: 'Tirzepatida', classe: 'GLP-1/GIP', via: 'SC', alertas: ['Náusea comum no início'] }] } };
    return { ok: true, data: {} };
  }; await prBaseCarregar(); await new Promise(x => setTimeout(x, 60)); });
  const el = await p.$('#pr-base-box'); if (el) { await el.screenshot({ path: 'shots/pr_base_aba.png' }); console.log('screenshot: shots/pr_base_aba.png'); }

  const tudo = out.tem_aba_base && out.tem_droga && out.tem_inicial && out.tem_flags && out.tem_escada && out.tem_manutencao
    && out.tem_alertas && out.sem_cobranca_de_verdade && out.n_degraus === 3 && out.atual_marcado && out.escada5 && out.escada10 && out.vazio_honesto && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
