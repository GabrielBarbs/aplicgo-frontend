// A aplicação do medicamento base SEM produto vinculado entra na timeline ("ver histórico completo")
// como item 'aplicacao' com vários campos null. Confere que prRenderItem não quebra e mostra o essencial.
// Roda de total/: node shots/pr-timeline-base.js <porta>
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
    // Item exatamente como o backend emite pra base sem ClinApplication.
    const itemBase = {
      tipo: 'aplicacao',
      data: new Date().toISOString(),
      titulo: 'Aplicação',
      icone: 'vaccine',
      cor: '#EF9F27',
      dados: {
        id: null, profissional: 'Ana Enf', produto: 'Tirzepatida', principio_ativo: null,
        lote: null, validade: null, dose: '1,25 mg', via: 'SUBCUTANEA', local: null,
        reacao_adversa: null, observacoes: 'Medicamento base (sem baixa de estoque)',
      },
    };
    // E o item "normal" (com produto de estoque) pra comparar.
    const itemItem = {
      tipo: 'aplicacao', data: new Date().toISOString(), titulo: 'Aplicação', icone: 'vaccine', cor: '#EF9F27',
      dados: { id: 'a1', profissional: 'Ana Enf', produto: 'Tirzepatida', principio_ativo: 'Tirzepatida',
        lote: 'LT-9', validade: '2027-01-01', dose: '2.5 mg', via: 'SUBCUTANEA', local: 'abdômen',
        reacao_adversa: null, observacoes: null },
    };
    let hBase = '', hItem = '';
    try { hBase = prRenderItem(itemBase); } catch (e) { r.erro_base = e.message; }
    try { hItem = prRenderItem(itemItem); } catch (e) { r.erro_item = e.message; }
    r.base_mostra_droga = /Tirzepatida/.test(hBase) && /1,25 mg/.test(hBase);
    r.base_sem_paren_redundante = !/\(Tirzepatida\)/.test(hBase);   // principio_ativo null -> sem "(Tirzepatida)"
    r.base_sem_null = !/>null</.test(hBase) && !/null mg/.test(hBase) && !/undefined/.test(hBase);
    r.base_sem_lote = !/Lote:/.test(hBase);                          // lote null -> não renderiza bloco de lote
    r.base_via = /subcutanea/i.test(hBase);
    r.item_mostra_lote = /Lote:/.test(hItem) && /LT-9/.test(hItem) && /\(Tirzepatida\)/.test(hItem); // item normal ainda ok
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- timeline: aplicação da base sem produto ---');
  ok('renderiza sem erro (base)', !out.erro_base, out.erro_base || '');
  ok('mostra droga + dose', out.base_mostra_droga);
  ok('sem "(Tirzepatida)" redundante (principio_ativo null)', out.base_sem_paren_redundante);
  ok('sem "null"/"undefined" no html', out.base_sem_null);
  ok('sem bloco de lote (lote null)', out.base_sem_lote);
  ok('mostra a via', out.base_via);
  console.log('--- item normal (com produto) segue ok ---');
  ok('renderiza sem erro (item)', !out.erro_item, out.erro_item || '');
  ok('mostra lote + principio ativo', out.item_mostra_lote);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = !out.erro_base && out.base_mostra_droga && out.base_sem_paren_redundante && out.base_sem_null
    && out.base_sem_lote && out.base_via && !out.erro_item && out.item_mostra_lote && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
