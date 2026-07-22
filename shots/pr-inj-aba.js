// Aba "Aplicações" no card de ENFERMAGEM do prontuário: medicamento base + próximas (com Aplicar) +
// histórico (dose, quem aplicou, data, Desfazer). Roda de total/: node shots/pr-inj-aba.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8170';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    const posts = [];
    window.homeToast = () => {};
    window.confirm = () => true;
    window.temPermissao = () => true; // enfermeira/gestor
    window.pacApi = async (url, opts) => {
      if (/\/itens\/.+\/aplicar$/.test(url) && opts) { posts.push(url); return { ok: true, data: { ok: true, baixa_estoque: true } }; }
      if (/\/itens\/.+\/desaplicar$/.test(url) && opts) { posts.push(url); return { ok: true, data: { ok: true, estornado: true } }; }
      if (url.indexOf('/prescricoes-inj?patient_id=') !== -1) return { ok: true, data: { ok: true, prescricoes: [{
        id: 'pr1', status: 'liberado', itens: [
          { id: 'it1', semana: 1, dose: '2,5 mg', dose_mcg: 2500, status_item: 'aplicado', enfermeiro: 'Ana Enfermeira', data_aplicacao: '2026-07-15T14:30:00Z' },
          { id: 'it2', semana: 2, dose: '5 mg', dose_mcg: 5000, status_item: 'liberado', enfermeiro: null, data_aplicacao: null },
          { id: 'it3', semana: 3, dose: '7,5 mg', dose_mcg: 7500, status_item: 'pendente_orcamento' },
        ],
      }] } };
      if (/\/patients\/.+\/medicacoes$/.test(url)) return { ok: true, data: { ok: true, injetaveis: [{ nome: 'Tirzepatida', dose: '5 mg', proxima_dose_prevista: '2026-07-30' }] } };
      return { ok: true, data: {} };
    };
    document.getElementById('auth-overlay').style.display = 'none';
    prState.pacienteAtual = { id: 'p1', nome: 'Paciente Teste' };
    prState.timeline = [];

    // A) o card de ENFERMAGEM tem a aba "Aplicações"; outros cards NÃO
    const enf = PROF_TIPOS.find(x => x.tipo === 'ENFERMAGEM');
    const med = PROF_TIPOS.find(x => x.tipo === 'MEDICA');
    const htmlEnf = prRenderCardProfissional(enf, null, null, true, false);
    const htmlMed = prRenderCardProfissional(med, null, null, true, false);
    r.enf_tem_aba = /prCardTrocarAba\('ENFERMAGEM', 'inj'\)/.test(htmlEnf) && /Aplicações/.test(htmlEnf);
    r.med_nao_tem_aba = !/'inj'/.test(htmlMed);

    // B) carregar o box
    const host = document.createElement('div');
    host.innerHTML = '<div id="pr-inj-box" class="pr-inj-box" style="max-width:470px;padding:14px;background:#0e1116;border-radius:12px"></div>';
    document.body.appendChild(host);
    await prInjCarregar();
    await new Promise(x => setTimeout(x, 40));
    const box = document.getElementById('pr-inj-box');
    const t = box.textContent;
    r.tem_droga = /Tirzepatida/.test(t) && /próxima/i.test(t);
    r.tem_secao_proximas = /Próximas aplicações/.test(t);
    r.tem_secao_historico = /Histórico de aplicações/.test(t);
    // próximas: semana 2 liberada com botão Aplicar; semana 3 é "aguardando cobrança" (obs)
    r.prox_tem_aplicar = !!box.querySelector('.pr-inj-btn.aplicar');
    r.prox_semana2 = /Semana 2/.test(t);
    r.aviso_cobranca = /aguardando cobrança/.test(t);
    // histórico: semana 1, dose, quem aplicou (Ana), data, botão desfazer
    r.hist_quem = /Ana Enfermeira/.test(t);
    r.hist_dose = /2,5 mg/.test(t);
    r.hist_desfazer = !!box.querySelector('.pr-inj-btn.desfazer');

    // C) clicar Aplicar -> POST /aplicar
    posts.length = 0;
    box.querySelector('.pr-inj-btn.aplicar').click();
    await new Promise(x => setTimeout(x, 120));
    r.aplicou_postou = posts.some(u => /\/itens\/it2\/aplicar$/.test(u));

    // D) sem permissão -> sem botões (só leitura)
    window.temPermissao = () => false;
    await prInjCarregar();
    await new Promise(x => setTimeout(x, 40));
    const box2 = document.getElementById('pr-inj-box');
    r.sem_perm_sem_botao = !box2.querySelector('.pr-inj-btn');
    r.sem_perm_ainda_mostra = /Tirzepatida/.test(box2.textContent) && /Ana Enfermeira/.test(box2.textContent);
    window.temPermissao = () => true;
    await prInjCarregar();

    // E) conserto do review: re-render da timeline não pode travar em "Carregando". O card usa o cache.
    prState.cardAba = { ENFERMAGEM: 'inj' };
    const htmlRe = prRenderCardProfissional(enf, null, null, true, false);
    r.cache_no_render = /Tirzepatida/.test(htmlRe) && !/Carregando aplicações/.test(htmlRe);
    r.cache_guardado = !!(prState.injCache && prState.injCache.pid === 'p1');
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- aba ---');
  ok('card de enfermagem tem "Aplicações"', out.enf_tem_aba);
  ok('outros cards NÃO têm', out.med_nao_tem_aba);
  console.log('\n--- conteúdo ---');
  ok('mostra o medicamento base (droga atual)', out.tem_droga);
  ok('seção Próximas aplicações', out.tem_secao_proximas);
  ok('seção Histórico de aplicações', out.tem_secao_historico);
  ok('próxima (semana 2) com botão Aplicar', out.prox_tem_aplicar && out.prox_semana2);
  ok('sessão não paga vira "aguardando cobrança"', out.aviso_cobranca);
  console.log('\n--- histórico ---');
  ok('mostra quem aplicou', out.hist_quem);
  ok('mostra a dose', out.hist_dose);
  ok('botão desfazer', out.hist_desfazer);
  console.log('\n--- ações ---');
  ok('Aplicar posta pro item certo', out.aplicou_postou);
  console.log('\n--- sem permissão (só leitura) ---');
  ok('sem botões de aplicar/desfazer', out.sem_perm_sem_botao);
  ok('ainda mostra droga + histórico', out.sem_perm_ainda_mostra);
  console.log('\n--- re-render não trava (conserto do review) ---');
  ok('cache guardado', out.cache_guardado);
  ok('re-render mostra o conteúdo (não "Carregando")', out.cache_no_render);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const el = await p.$('#pr-inj-box');
  if (el) { await el.screenshot({ path: 'shots/pr_inj_aba.png' }); console.log('screenshot: shots/pr_inj_aba.png'); }

  const tudo = out.enf_tem_aba && out.med_nao_tem_aba && out.tem_droga && out.tem_secao_proximas && out.tem_secao_historico
    && out.prox_tem_aplicar && out.prox_semana2 && out.aviso_cobranca && out.hist_quem && out.hist_dose && out.hist_desfazer
    && out.aplicou_postou && out.sem_perm_sem_botao && out.sem_perm_ainda_mostra && out.cache_guardado && out.cache_no_render && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
