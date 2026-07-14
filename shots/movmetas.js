// Renderiza o painel "Metas de Movimento" (#view-dev) com a API stubbada, pra conferir o visual
// sem backend/login. Roda de total/: node shots/movmetas.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8120';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CFG_PADRAO = {
  niveis: {
    1: { nome: 'Sedentário', passosDia: 5000, exercicioSemana: 120 },
    2: { nome: 'Ativo', passosDia: 8000, exercicioSemana: 180 },
    3: { nome: 'Performance', passosDia: 10000, exercicioSemana: 240 },
    4: { nome: 'Alta Performance', passosDia: 12000, exercicioSemana: 300 },
  },
  nivelPadrao: 2,
  aderenciaPassosDiaAtivo: 6000,
  padraoConfigurado: false,
};

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 1280, height: 1200, deviceScaleFactor: 2 },
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 160)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);

  // stuba a API e força só a view dev (sem login/backend)
  const resp = await p.evaluate(async (cfgPadrao) => {
    window.pacApi = async (path, opts) => {
      if (path.includes('/dev/metas-movimento') && (!opts || !opts.method || opts.method === 'GET')) {
        return { ok: true, data: { ok: true, config: cfgPadrao, padrao: cfgPadrao, pacientes_com_nivel_prescrito: 0, total_pacientes: 12 } };
      }
      return { ok: true, data: { ok: true } };
    };
    const ov = document.getElementById('auth-overlay');
    if (ov) ov.style.display = 'none'; // sem backend não dá pra logar; o painel é o que interessa
    document.querySelectorAll('.view').forEach((v) => (v.style.display = 'none'));
    const dev = document.getElementById('view-dev');
    dev.style.display = 'block';
    dev.classList.add('active');
    await window.movmCarregar();
    const el = document.getElementById('dev-movmetas');
    return { html: !!el && el.innerHTML.length > 200, texto: el ? el.innerText.slice(0, 900) : '(sem elemento)' };
  }, CFG_PADRAO);

  console.log('renderizou:', resp.html);
  console.log('---- TEXTO DO PAINEL ----');
  console.log(resp.texto);
  const el = await p.$('#dev-movmetas');
  if (el) await el.screenshot({ path: OUT + 'movmetas.png' });
  console.log('ERROS:', errs.length ? errs.slice(0, 3).join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
