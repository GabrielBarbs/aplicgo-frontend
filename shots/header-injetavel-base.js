// Confere que o chip "Injetável" do header do prontuário mostra NOME da droga base + DOSE atual (não o
// "sdg" texto livre). O backend passou a mandar h.medicacoes.injetaveis = [{nome, dose(num), frequencia}].
// Roda de total/: node shots/header-injetavel-base.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  const out = await p.evaluate(() => {
    const r = {};
    // fmtDoseUnidade: número puro ganha "mg"
    r.fmt_num = fmtDoseUnidade('10') === '10mg' && fmtDoseUnidade('1,25') === '1,25mg' && fmtDoseUnidade('10mg') === '10mg';

    // Header com a forma NOVA (base): nome + dose numérica
    prState.headerData = {
      peso_inicial: 100, peso_atual: 90, meta_peso: 80,
      medicacoes: { injetaveis: [{ nome: 'Tirzepatida', dose: '10', frequencia: null }], orais: [], suplementos: [] },
    };
    let html = '';
    try { html = prRenderHeaderRico(); } catch (e) { r.erro = e.message; }
    // acha a linha do injetável
    r.mostra_nome = /Injetável:<\/span>\s*<span class="med-val">Tirzepatida/.test(html) || /Tirzepatida/.test(html);
    r.mostra_dose = /10mg/.test(html);
    r.nao_mostra_sdg = !/sdg/i.test(html);
    // caso vazio (sem base nem medicação): mostra "--", não quebra
    prState.headerData = { peso_inicial: 100, peso_atual: 90, meta_peso: 80, medicacoes: { injetaveis: [], orais: [], suplementos: [] } };
    let html2 = '';
    try { html2 = prRenderHeaderRico(); } catch (e) { r.erro2 = e.message; }
    r.vazio_ok = /Injetável:/.test(html2) && /--/.test(html2);

    // dose com vírgula (1,25) também
    prState.headerData = { peso_inicial: 100, peso_atual: 90, meta_peso: 80, medicacoes: { injetaveis: [{ nome: 'Semaglutida', dose: '1,25', frequencia: null }], orais: [], suplementos: [] } };
    let html3 = '';
    try { html3 = prRenderHeaderRico(); } catch (e) { r.erro3 = e.message; }
    r.dose_virgula = /Semaglutida/.test(html3) && /1,25mg/.test(html3);
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- chip Injetável do header ---');
  ok('fmtDoseUnidade número -> +mg', out.fmt_num);
  ok('renderiza sem erro', !out.erro, out.erro || '');
  ok('mostra o NOME da droga (Tirzepatida)', out.mostra_nome);
  ok('mostra a DOSE atual (10mg)', out.mostra_dose);
  ok('não mostra "sdg" (texto livre antigo)', out.nao_mostra_sdg);
  ok('dose com vírgula (1,25mg)', out.dose_virgula, out.erro3 || '');
  ok('sem injetável -> "--" sem quebrar', out.vazio_ok, out.erro2 || '');
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = out.fmt_num && !out.erro && out.mostra_nome && out.mostra_dose && out.nao_mostra_sdg && out.dose_virgula && out.vazio_ok && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
