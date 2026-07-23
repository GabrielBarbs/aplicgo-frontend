// O campo tipo "data" (ex.: "Próxima consulta recomendada") no formulário de evolução vira um date picker
// e grava a data em respostas. Roda de total/: node shots/evol-campo-data.js <porta>
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
    // container que o prEvolRenderForm usa
    const host = document.createElement('div'); host.innerHTML = '<div id="pr-evol-form"></div>'; document.body.appendChild(host);
    prEvolFormState = {
      campos: [
        { slug: 'condutas', label: 'Condutas', tipo: 'texto_longo', secao: 'Plano e condutas' },
        { slug: 'proxima_consulta_recomendada', label: 'Próxima consulta recomendada', tipo: 'data', secao: 'Plano e condutas' },
      ],
      respostas: { proxima_consulta_recomendada: '2026-09-01' },
      origens: {},
    };
    prEvolRenderForm();
    const wrap = document.getElementById('pr-evol-form');
    const inp = document.getElementById('pr-evol-campo-proxima_consulta_recomendada');
    r.tem_input = !!inp;
    r.eh_date = inp && inp.type === 'date';
    r.valor_carregado = inp && inp.value === '2026-09-01';
    r.label_visivel = /Próxima consulta recomendada/.test(wrap.textContent);
    // grava ao mudar
    if (inp) { inp.value = '2026-10-15'; inp.dispatchEvent(new Event('change')); }
    r.grava_resposta = prEvolFormState.respostas.proxima_consulta_recomendada === '2026-10-15';
    // o campo texto_longo continua textarea (não regrediu)
    const inpTxt = document.getElementById('pr-evol-campo-condutas');
    r.txt_ok = inpTxt && inpTxt.tagName === 'TEXTAREA';
    return r;
  });

  const ok = (n, c) => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n);
  ok('campo "data" renderiza um input', out.tem_input);
  ok('input type="date" (date picker)', out.eh_date);
  ok('carrega o valor salvo (2026-09-01)', out.valor_carregado);
  ok('label aparece', out.label_visivel);
  ok('mudar a data grava em respostas', out.grava_resposta);
  ok('texto_longo segue textarea (sem regressão)', out.txt_ok);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = out.tem_input && out.eh_date && out.valor_carregado && out.label_visivel && out.grava_resposta && out.txt_ok && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
