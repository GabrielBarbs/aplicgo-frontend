// Prescrição do medicamento base: quando a frequência é "Dose única", a Duração some (é 1 aplicação só) e
// o salvar manda titulacao [{semanas:1}] sem exigir duração. Roda de total/: node shots/pbase-dose-unica.js <porta>
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

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {}; window.rxFechar = () => {}; window.prCarregarTimeline = () => {};
    pbaseState.medicamentos = [{ slug: 'tirzepatida', nome: 'Tirzepatida', frequenciasPermitidas: ['semanal', '2x_semana', 'quinzenal', 'dose_unica'], frequenciaPadrao: 'semanal', dosesMg: [1.25, 2.5, 5], doseInicialPadrao: 1.25, alertas: [] }];
    pbaseState.patientId = 'p1';

    // monta o form + popula droga/freq (como o pbaseMontarInline faz)
    const host = document.createElement('div'); host.innerHTML = pbaseFormHtml(); document.body.appendChild(host);
    pbasePopularDrogas();
    pbaseDrogaMudou();

    const freqEl = document.getElementById('pbase-freq');
    const durField = document.getElementById('pbase-dur-field');
    r.opcao_dose_unica_existe = /value="dose_unica"/.test(freqEl.innerHTML) && /Dose única/.test(freqEl.innerHTML);

    // semanal -> duração VISÍVEL
    freqEl.value = 'semanal'; pbaseDurAtualizarUnid();
    r.dur_visivel_semanal = durField.style.display !== 'none';

    // dose única -> duração OCULTA
    freqEl.value = 'dose_unica'; pbaseDurAtualizarUnid();
    r.dur_oculta_unica = durField.style.display === 'none';

    // voltar pra quinzenal -> visível de novo + rótulo "quinzenas"
    freqEl.value = 'quinzenal'; pbaseDurAtualizarUnid();
    r.volta_visivel = durField.style.display !== 'none' && document.getElementById('pbase-dur-unid').textContent === 'quinzenas';

    // salvar com DOSE ÚNICA -> POST titulacao [{semanas:1}], sem erro de duração
    let body = null, url = null;
    window.pacApi = async (u, opts) => {
      if (/prescricoes-base$/.test(u)) { url = u; body = JSON.parse(opts.body); return { ok: true, data: { prescricao: { id: 'pb1' } } }; }
      return { ok: true, data: {} };
    };
    freqEl.value = 'dose_unica'; pbaseDurAtualizarUnid();
    document.getElementById('pbase-dose1').value = '';   // só prescrever
    await pbaseSalvar();
    await new Promise(x => setTimeout(x, 40));
    const erroVisivel = document.getElementById('pbase-erro').style.display === 'block';
    r.salvou_unica = !!body && body.frequencia === 'dose_unica' && Array.isArray(body.titulacao)
      && body.titulacao.length === 1 && body.titulacao[0].semanas === 1 && !erroVisivel;

    // salvar SEMANAL com duração 12 -> titulacao [{semanas:12}] (não regrediu)
    body = null;
    freqEl.value = 'semanal'; pbaseDurAtualizarUnid();
    document.getElementById('pbase-dur').value = '12';
    document.getElementById('pbase-dose1').value = '';
    await pbaseSalvar();
    await new Promise(x => setTimeout(x, 40));
    r.salvou_semanal = !!body && body.frequencia === 'semanal' && body.titulacao[0].semanas === 12;

    return r;
  });

  const ok = (n, c) => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n);
  console.log('--- dose única esconde a duração ---');
  ok('opção "Dose única" no seletor', out.opcao_dose_unica_existe);
  ok('semanal -> duração visível', out.dur_visivel_semanal);
  ok('dose única -> duração OCULTA', out.dur_oculta_unica);
  ok('voltar pra quinzenal -> visível + rótulo "quinzenas"', out.volta_visivel);
  console.log('\n--- salvar ---');
  ok('dose única -> titulacao [{semanas:1}] sem erro de duração', out.salvou_unica);
  ok('semanal 12 -> titulacao [{semanas:12}] (sem regressão)', out.salvou_semanal);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = out.opcao_dose_unica_existe && out.dur_visivel_semanal && out.dur_oculta_unica && out.volta_visivel
    && out.salvou_unica && out.salvou_semanal && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
