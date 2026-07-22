const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 720, height: 900 } });
  const p = await b.newPage();
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await p.evaluate(async () => {
    window.homeToast = () => {}; window.temPermissao = () => true;
    const pr = { id: 'pr1', patient_id: 'p1', status: 'prescrito', origem_inclusao: 'nao_incluso', data: new Date().toISOString(), observacoes: 'Aplicar em jejum', itens: [
      { id: 'i1', sku_ativo: 'SORO_DETOX', semana: 1, dose: '10ml', dose_mcg: null, via: 'EV', incluso: false, status_item: 'pendente_orcamento', observacao: 'infusão lenta' },
      { id: 'i2', sku_ativo: 'SORO_DETOX', semana: 2, dose: '10ml', dose_mcg: null, via: 'EV', incluso: false, status_item: 'pendente_orcamento', observacao: '' },
    ] };
    injState.patient = { id: 'p1', nome: 'Maria Teste', codigo: 'P-1' };
    injState.prescEl = 'inj-conteudo';
    injState.catalogo = [{ sku: 'SORO_DETOX', produto: 'Soro Detox', categoria: 'soro' }];
    injState.profs = []; injState.protocolos = [];
    window.pacApi = async (url) => {
      if (/\/prescricoes-inj\/pr1$/.test(url)) return { ok: true, data: { prescricao: pr } };
      if (/\/prescricoes-inj\?patient_id=/.test(url)) return { ok: true, data: { prescricoes: [pr] } };
      return { ok: true, data: {} };
    };
    const host = document.createElement('div');
    host.style.cssText = 'max-width:680px;margin:16px auto;padding:16px;background:var(--bg1)';
    host.innerHTML = '<div id="inj-conteudo"></div>';
    document.body.innerHTML = ''; document.body.appendChild(host);
    await injEditar('pr1');
    await new Promise(x => setTimeout(x, 120));
  });
  await new Promise((r) => setTimeout(r, 300));
  const el = await p.$('#inj-conteudo');
  if (el) { await el.screenshot({ path: 'shots/inj_editar.png' }); console.log('shots/inj_editar.png'); }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
