const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8141';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1000, height: 820 } });
  const p = await b.newPage();
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1400));
  await p.evaluate(async () => {
    window.pacApi = async (url) => {
      if (url === '/api/clinico/units') return { ok: true, data: { ok: true, unidades: [{ id: 'unit-itu', nome: 'Ituiutaba', cidade: 'Ituiutaba' }, { id: 'unit-ube', nome: 'Uberlândia', cidade: 'Uberlândia' }] } };
      return { ok: true, data: { ok: true } };
    };
    window.homeToast = () => {};
    document.getElementById('auth-overlay').style.display = 'none';
    // u3 tem uma unidade INATIVA ainda vinculada (Unidade Antiga) além da primária ativa — a tela
    // tem que mostrá-la marcada como "inativa" pra dar pra limpar.
    admState.usuarios = [{ id: 'u3', nome: 'Teste Recp 2 Ituiutaba', email: 'recp2.ituiutaba@teste.aplicgo.com', role_tecnico: 'recepcao', unidades: [{ id: 'unit-morta', nome: 'Unidade Antiga', cidade: 'Prata', primaria: false }, { id: 'unit-itu', nome: 'Ituiutaba', cidade: 'Ituiutaba', primaria: true }] }];
    await admEditarUnidadesUser('u3');
  });
  await new Promise((r) => setTimeout(r, 300));
  await p.screenshot({ path: 'shots/adm_unidades_modal.png' });
  await b.close();
  console.log('shot ok');
})().catch((e) => { console.error(e.message); process.exit(1); });
