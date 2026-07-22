// Aba "Base" no card de ENFERMAGEM: medicamento base (GLP-1), UMA linha de aplicação por semana da
// escada + botão aplicar/desfazer + manutenção sob demanda. Sem cobrança.
// Roda de total/: node shots/pr-base-aba.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8180';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 1100 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    window.temPermissao = () => true; // enfermeira com permissão de aplicar
    const cincoSemanas = new Date(Date.now() - 35 * 86400000).toISOString();

    // GET expandido: 8 semanas finitas (4x1,25 + 4x2,5), semana 1 já aplicada; manutenção 5 mg sob demanda.
    const semanasMock = [
      { semana: 1, dose_mg: 1.25, aplicada: true, aplicacao_id: 'a1', data_aplicacao: cincoSemanas, enfermeiro: 'Ana Enf', baixa_estoque: true },
      { semana: 2, dose_mg: 1.25, aplicada: false },
      { semana: 3, dose_mg: 1.25, aplicada: false },
      { semana: 4, dose_mg: 1.25, aplicada: false },
      { semana: 5, dose_mg: 2.5, aplicada: false },
      { semana: 6, dose_mg: 2.5, aplicada: false },
      { semana: 7, dose_mg: 2.5, aplicada: false },
      { semana: 8, dose_mg: 2.5, aplicada: false },
    ];
    const baseResp = () => ({ ok: true, data: { prescricoes: [{
      id: 'pb1', patientId: 'p1', medicamentoBaseSlug: 'tirzepatida', doseInicialMg: 1.25, via: 'SC',
      frequencia: 'semanal', autoAdministrado: false, observacoes: 'Aplicar coxa/abdômen, rodar o local.',
      status: 'prescrita', createdAt: cincoSemanas, total_finito: 8,
      semanas: JSON.parse(JSON.stringify(semanasMock)),
      manutencao: { dose_mg: 5, aplicadas: [] },
    }] } });
    window.pacApi = async (url) => {
      if (/\/protocolos\/prescricoes-base\//.test(url)) return baseResp();
      if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [
        { slug: 'tirzepatida', nome: 'Tirzepatida', classe: 'glp1_gi', via: 'SC', alertas: ['glp1_gi', 'titular_lento', 'contraindicado_mtc_men2', 'pancreatite', 'contraindicado_gestacao'] },
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
    prState.baseCache = null;
    await prBaseCarregar();
    await new Promise(x => setTimeout(x, 40));
    const box = document.getElementById('pr-base-box');
    const t = box.textContent;
    r.tem_droga = /Tirzepatida/.test(t) && /GLP-1\/GIP/.test(t);
    r.tem_inicial = /1,25 mg/.test(t) && /semanal/.test(t);
    r.flag_clinica = /aplicado na clínica/.test(t) && !/auto-aplicado/.test(t) && /sem cobrança/.test(t);
    r.sem_escada_velha = !/Escada de dose/.test(t) && !box.querySelector('.pr-base-degrau') && !/~ atual/.test(t);
    r.sem_alerta = !box.querySelector('.pr-base-alerta') && !/contraindicad/i.test(t) && !/Titular a dose/.test(t) && !/pancreatite/i.test(t);

    // C) uma linha por semana (8), com dose por degrau
    const linhas = [...box.querySelectorAll('.pr-inj-lin')];
    r.n_linhas_sem = linhas.filter(l => /Semana \d/.test(l.textContent)).length; // 8 semanas
    r.tem_titulo_semanas = /Aplicações por semana/.test(t);
    // semana 1 aplicada -> mostra "aplicado" + enfermeiro + botão desfazer
    const l1 = linhas.find(l => /Semana 1\b/.test(l.textContent));
    r.sem1_aplicada = !!l1 && /aplicado/.test(l1.textContent) && /Ana Enf/.test(l1.textContent) && !!l1.querySelector('.pr-inj-btn.desfazer');
    // semana 2 pendente -> "não aplicado" + botão Aplicar
    const l2 = linhas.find(l => /Semana 2\b/.test(l.textContent));
    r.sem2_pendente = !!l2 && /não aplicado/.test(l2.textContent) && !!l2.querySelector('.pr-inj-btn.aplicar');
    // doses corretas por degrau
    r.doses_degrau = /Semana 5/.test(t) && [...linhas].some(l => /Semana 5/.test(l.textContent) && /2,5 mg/.test(l.textContent));

    // D) manutenção sob demanda
    r.tem_manut_sec = /Manutenção · 5 mg · contínua/.test(t);
    r.tem_btn_manut = /Registrar aplicação de manutenção/.test(box.innerHTML);

    // E) as funções existem
    r.fns = typeof prBaseAplicar === 'function' && typeof prBaseDesaplicar === 'function' && typeof prBaseAplicarManut === 'function';

    // F) clicar Aplicar na semana 2 -> POST /aplicar {semana:2}; e simular resposta ok
    let corpoEnviado = null, urlEnviada = null;
    window.pacApi = async (url, opts) => {
      if (/\/protocolos\/prescricoes-base\/pb1\/aplicar$/.test(url)) { urlEnviada = url; corpoEnviado = JSON.parse(opts.body); return { ok: true, data: { ok: true, semana: 2, baixa_estoque: true } }; }
      if (/\/protocolos\/prescricoes-base\//.test(url)) { const rr = baseResp(); rr.data.prescricoes[0].semanas[1].aplicada = true; rr.data.prescricoes[0].semanas[1].enfermeiro = 'Eu Mesmo'; rr.data.prescricoes[0].semanas[1].data_aplicacao = new Date().toISOString(); rr.data.prescricoes[0].semanas[1].baixa_estoque = true; return rr; }
      if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [{ slug: 'tirzepatida', nome: 'Tirzepatida', classe: 'glp1_gi', via: 'SC', alertas: [] }] } };
      return { ok: true, data: {} };
    };
    const btnAplicar = l2.querySelector('.pr-inj-btn.aplicar');
    await prBaseAplicar('pb1', 2, btnAplicar);
    await new Promise(x => setTimeout(x, 60));
    r.aplicar_chamou = urlEnviada && /\/aplicar$/.test(urlEnviada) && corpoEnviado && corpoEnviado.semana === 2;
    const box2 = document.getElementById('pr-base-box');
    const l2b = [...box2.querySelectorAll('.pr-inj-lin')].find(l => /Semana 2\b/.test(l.textContent));
    r.sem2_virou_aplicada = !!l2b && /aplicado/.test(l2b.textContent) && /Eu Mesmo/.test(l2b.textContent);

    // G) sem prescrição base -> vazio honesto
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
  ok('flag reflete autoAdministrado=false ("aplicado na clínica")', out.flag_clinica);
  ok('escada READ-ONLY antiga removida (sem degrau / ~atual)', out.sem_escada_velha);
  ok('SEM alerta de contraindicações', out.sem_alerta);
  console.log('\n--- semanas ---');
  ok('uma linha por semana (8 finitas)', out.n_linhas_sem === 8, String(out.n_linhas_sem));
  ok('título "Aplicações por semana"', out.tem_titulo_semanas);
  ok('semana 1 aplicada (enfermeiro + desfazer)', out.sem1_aplicada);
  ok('semana 2 pendente ("não aplicado" + Aplicar)', out.sem2_pendente);
  ok('dose por degrau (semana 5 -> 2,5 mg)', out.doses_degrau);
  console.log('\n--- manutenção ---');
  ok('seção de manutenção contínua', out.tem_manut_sec);
  ok('botão registrar manutenção', out.tem_btn_manut);
  console.log('\n--- ações ---');
  ok('funções prBaseAplicar/Desaplicar/AplicarManut', out.fns);
  ok('clicar Aplicar -> POST /aplicar {semana:2}', out.aplicar_chamou);
  ok('após aplicar, semana 2 vira "aplicado"', out.sem2_virou_aplicada);
  console.log('\n--- vazio ---');
  ok('sem base -> mensagem honesta', out.vazio_honesto);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  // screenshot do estado carregado
  await p.evaluate(async () => { prState.baseCache = null; window.temPermissao = () => true; window.homeToast = () => {};
    const cinco = new Date(Date.now() - 35 * 86400000).toISOString();
    window.pacApi = async (url) => {
      if (/\/protocolos\/prescricoes-base\//.test(url)) return { ok: true, data: { prescricoes: [{ id: 'pb1', medicamentoBaseSlug: 'tirzepatida', doseInicialMg: 1.25, via: 'SC', frequencia: 'semanal', autoAdministrado: false, observacoes: 'Aplicar coxa/abdômen, rodar o local.', status: 'prescrita', createdAt: cinco, total_finito: 8, semanas: [ { semana: 1, dose_mg: 1.25, aplicada: true, data_aplicacao: cinco, enfermeiro: 'Ana Enf', baixa_estoque: true }, { semana: 2, dose_mg: 1.25, aplicada: true, data_aplicacao: cinco, enfermeiro: 'Ana Enf', baixa_estoque: true }, { semana: 3, dose_mg: 1.25, aplicada: false }, { semana: 4, dose_mg: 1.25, aplicada: false }, { semana: 5, dose_mg: 2.5, aplicada: false }, { semana: 6, dose_mg: 2.5, aplicada: false }, { semana: 7, dose_mg: 2.5, aplicada: false }, { semana: 8, dose_mg: 2.5, aplicada: false } ], manutencao: { dose_mg: 5, aplicadas: [] } }] } };
      if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [{ slug: 'tirzepatida', nome: 'Tirzepatida', classe: 'glp1_gi', via: 'SC', alertas: [] }] } };
      return { ok: true, data: {} };
    }; await prBaseCarregar(); await new Promise(x => setTimeout(x, 60)); });
  const el = await p.$('#pr-base-box'); if (el) { await el.screenshot({ path: 'shots/pr_base_aba.png' }); console.log('screenshot: shots/pr_base_aba.png'); }

  const tudo = out.tem_aba_base && out.tem_droga && out.tem_inicial && out.flag_clinica && out.sem_escada_velha
    && out.sem_alerta && out.n_linhas_sem === 8 && out.tem_titulo_semanas && out.sem1_aplicada && out.sem2_pendente
    && out.doses_degrau && out.tem_manut_sec && out.tem_btn_manut && out.fns && out.aplicar_chamou && out.sem2_virou_aplicada
    && out.vazio_honesto && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
