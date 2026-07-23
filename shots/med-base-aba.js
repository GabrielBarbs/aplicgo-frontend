// Confere que a aba "Aplicações"(Base) existe no card MÉDICO (não só enfermagem), renderiza o medicamento
// base e mostra os botões de aplicar (com permissão). Roda de total/: node shots/med-base-aba.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 1000 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    window.temPermissao = () => true;
    const cinco = new Date(Date.now() - 35 * 86400000).toISOString();
    window.pacApi = async (url) => {
      if (/\/protocolos\/prescricoes-base\//.test(url)) return { ok: true, data: { prescricoes: [{ id: 'pb1', medicamentoBaseSlug: 'tirzepatida', doseInicialMg: 1.25, via: 'SC', frequencia: 'semanal', autoAdministrado: false, status: 'prescrita', createdAt: cinco, total_finito: 8, semanas: [ { semana: 1, dose_mg: 1.25, aplicada: true, data_aplicacao: cinco, enfermeiro: 'Ana', baixa_estoque: true }, { semana: 2, dose_mg: 1.25, aplicada: false } ], manutencao: { dose_mg: 5, aplicadas: [] } }] } };
      if (/\/protocolos\/medicamentos-base$/.test(url)) return { ok: true, data: { medicamentos: [{ slug: 'tirzepatida', nome: 'Tirzepatida', classe: 'glp1_gi', via: 'SC', alertas: [] }] } };
      return { ok: true, data: {} };
    };
    document.getElementById('auth-overlay').style.display = 'none';
    prState.pacienteAtual = { id: 'p1', nome: 'Paciente Teste' };
    prState.timeline = [];
    prState.cardAba = { MEDICA: 'base' };

    const med = PROF_TIPOS.find(x => x.tipo === 'MEDICA');
    r.tem_prof_medica = !!med;
    const htmlMed = prRenderCardProfissional(med, null, null, true, false);
    // 1) o card MÉDICO tem o botão da aba Base ("Aplicações")
    r.med_tem_aba_base = /prCardTrocarAba\('MEDICA', 'base'\)/.test(htmlMed);
    // 2) com a aba base ativa, renderiza o box da base (classe pr-base-box)
    r.med_tem_box = /pr-base-box/.test(htmlMed);

    // 3) enfermagem também mantém a aba (não regrediu)
    const enf = PROF_TIPOS.find(x => x.tipo === 'ENFERMAGEM');
    prState.cardAba = { ENFERMAGEM: 'base' };
    const htmlEnf = prRenderCardProfissional(enf, null, null, true, false);
    r.enf_tem_aba_base = /prCardTrocarAba\('ENFERMAGEM', 'base'\)/.test(htmlEnf);

    // 4) montar o box do MÉDICO no DOM e carregar -> aparece a droga + botão Aplicar (permissão true)
    const host = document.createElement('div');
    host.innerHTML = '<div class="pr-inj-box pr-base-box" style="max-width:470px;padding:14px;background:#0e1116"></div>';
    document.body.appendChild(host);
    prState.baseCache = null;
    await prBaseCarregar();
    await new Promise(x => setTimeout(x, 50));
    const box = document.querySelector('.pr-base-box');
    const t = box.textContent;
    r.carregou_droga = /Tirzepatida/.test(t);
    r.tem_botao_aplicar = !!box.querySelector('.pr-inj-btn.aplicar') || /Aplicar/.test(box.innerHTML);
    r.semana1_aplicada = /aplicado/.test(t) && /Ana/.test(t);

    // 5) prBaseCarregar popula MÚLTIPLOS boxes (médico + enfermagem abertos ao mesmo tempo)
    const host2 = document.createElement('div');
    host2.innerHTML = '<div class="pr-inj-box pr-base-box" id="segundo-box"></div>';
    document.body.appendChild(host2);
    prState.baseCache = null;
    await prBaseCarregar();
    await new Promise(x => setTimeout(x, 50));
    r.popula_todos_os_boxes = /Tirzepatida/.test(document.getElementById('segundo-box').textContent);
    return r;
  });

  const ok = (n, c) => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n);
  console.log('--- aba Base no card MÉDICO ---');
  ok('existe PROF_TIPOS MEDICA', out.tem_prof_medica);
  ok('card médico tem o botão da aba Base', out.med_tem_aba_base);
  ok('card médico renderiza o box da base', out.med_tem_box);
  ok('enfermagem mantém a aba Base (sem regressão)', out.enf_tem_aba_base);
  console.log('\n--- funcional ---');
  ok('carrega a droga (Tirzepatida)', out.carregou_droga);
  ok('mostra botão Aplicar (com permissão)', out.tem_botao_aplicar);
  ok('semana 1 aplicada (quem + estado)', out.semana1_aplicada);
  ok('prBaseCarregar popula TODOS os boxes (médico + enf juntos)', out.popula_todos_os_boxes);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = out.tem_prof_medica && out.med_tem_aba_base && out.med_tem_box && out.enf_tem_aba_base
    && out.carregou_droga && out.tem_botao_aplicar && out.semana1_aplicada && out.popula_todos_os_boxes && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
