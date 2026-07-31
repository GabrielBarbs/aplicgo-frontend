// Shots das reações da equipe na timeline de fotos (scroll via mouse.wheel — RN-web não usa window.scrollTo).
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8093';
const PREFIX = process.argv[3] || 'rc';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (p, label) => p.evaluate((label) => {
  const els = [...document.querySelectorAll('div,span')];
  const el = els.reverse().find((e) => e.childElementCount === 0 && (e.textContent || '').trim() === label);
  if (el) { el.click(); return true; }
  return false;
}, label);
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'], defaultViewport: { width: 420, height: 1500, deviceScaleFactor: 2 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.evaluate(() => localStorage.setItem('aplicgo_onboarding_done', '1'));
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(5000);
  console.log('evolucao:', await click(p, 'Evolução')); await sleep(3000);
  console.log('fotos:', await click(p, 'Fotos')); await sleep(2600);
  await p.mouse.move(210, 700);
  await p.mouse.wheel({ deltaY: 1250 }); await sleep(900);
  await p.screenshot({ path: OUT + PREFIX + '_1_timeline.png' });
  await p.mouse.wheel({ deltaY: 1400 }); await sleep(900);
  await p.screenshot({ path: OUT + PREFIX + '_2_feed.png' });
  await p.mouse.wheel({ deltaY: 1400 }); await sleep(900);
  await p.screenshot({ path: OUT + PREFIX + '_3_fim.png' });
  console.log('PAGEERRORS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
