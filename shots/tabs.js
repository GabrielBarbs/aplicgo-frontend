// Percorre as abas do app e tira um shot de cada, coletando erro de runtime.
// Roda a partir de total/ (onde puppeteer-core resolve): node shots/tabs.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8099';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, label) {
  return await page.evaluate((label) => {
    const els = [...document.querySelectorAll('div,span,a')];
    const el = els.reverse().find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === label);
    if (el) { el.click(); return true; }
    return false;
  }, label);
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 420, height: 1800, deviceScaleFactor: 2 },
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await p.goto('http://localhost:' + PORT, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.evaluate(() => localStorage.setItem('aplicgo_onboarding_done', '1'));
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(5000);

  const abas = ['Hoje', 'Evolução', 'Coach', 'Plano', 'Saúde'];
  for (const aba of abas) {
    const ok = await clickText(p, aba);
    await sleep(2600);
    const arq = 'tab_' + aba.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '.png';
    await p.screenshot({ path: OUT + arq });
    console.log((ok ? 'OK  ' : 'MISS') + '  ' + aba + ' -> ' + arq);
  }

  // marcadores: o que NÃO pode mais existir na tela
  const txt = await p.evaluate(() => document.body.innerText);
  const proibidos = ['10.000 passos', '1.850', 'evoluindo\ntodos os dias', 'Você está evoluindo'];
  for (const m of proibidos) console.log('  proibido "' + m.replace('\n', ' ') + '" presente:', txt.includes(m));
  console.log('ERROS:', errs.length ? errs.slice(0, 5).join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
