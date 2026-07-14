// Confere o app publicado (produção, modo real). Roda de total/: node shots/prod.js
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 420, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 160)));
  await p.goto('https://aplicgo-app.expo.app', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 5000));
  console.log('PROD:', JSON.stringify((await p.evaluate(() => document.body.innerText)).slice(0, 180)));
  console.log('ERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await p.screenshot({ path: 'C:\\Users\\gabri\\Downloads\\total\\shots\\prod.png' });
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
