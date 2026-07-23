const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 620, height: 640 } });
  const p = await b.newPage();
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await p.evaluate(async () => {
    window.homeToast = () => {};
    prState.pacienteAtual = { id: 'p1', nome: 'Paciente Teste' };
    const mes = new Date(Date.now() - 180 * 60000).toISOString().slice(0, 7);
    window.pacApi = async () => ({ ok: true, data: { metas: [
      { id: 'm1', mes, descricao: 'Beber 2L de água por dia', concluida: true, concluida_por: 'Ana' },
      { id: 'm2', mes, descricao: 'Caminhar 3x na semana', concluida: true, concluida_por: 'Você' },
      { id: 'm3', mes, descricao: 'Dormir 8 horas', concluida: false, concluida_por: null },
      { id: 'm4', mes, descricao: 'Registrar as refeições no app', concluida: false, concluida_por: null },
    ] } });
    document.getElementById('auth-overlay').style.display = 'none';
    await prAbrirMetasMes();
    await new Promise(x => setTimeout(x, 80));
  });
  await new Promise((r) => setTimeout(r, 250));
  const el = await p.$('#pr-metas-modal .pac-modal');
  if (el) { await el.screenshot({ path: 'shots/metas_mensais.png' }); console.log('shots/metas_mensais.png'); }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
