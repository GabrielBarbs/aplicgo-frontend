// A aba "Bloquear horário" saiu da janela de agendamento (fica escondida). O roteamento salvar vs
// bloquear e o fluxo de bloqueio pela barra da agenda têm que continuar funcionando.
// Roda de total/: node shots/ag-sem-bloqueio.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8170';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1100, height: 800 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    document.getElementById('auth-overlay').style.display = 'none';
    // stubs pra ver qual save o agSalvarTab chama, sem bater na API
    let chamou = '';
    window.agSalvar = () => { chamou = 'agendamento'; };
    window.agSalvarBloqueioTab = () => { chamou = 'bloqueio'; };
    window.agPopularSelectsBloqueio = () => {};

    const btnBloq = () => document.getElementById('ag-tab-btn-bloqueio');
    const vis = (el) => el && getComputedStyle(el).display !== 'none';

    // 1) abrir "Novo agendamento": a aba de bloqueio NÃO aparece
    agAbrirNovoModal();
    r.bloq_escondido_novo = !vis(btnBloq());
    r.agendamento_visivel = vis(document.getElementById('ag-tab-btn-agendamento'));
    r.corpo_agendamento = vis(document.getElementById('ag-tab-agendamento'));
    r.corpo_bloqueio_oculto = !vis(document.getElementById('ag-tab-bloqueio'));

    // 2) salvar no modo agendamento roteia pra agSalvar
    chamou = ''; agSalvarTab(); r.salvar_agendamento = chamou === 'agendamento';

    // 3) o botão da barra da agenda ainda abre o bloqueio (corpo + título), com a aba ainda escondida
    agAbrirModalBloqueio();
    r.bloq_escondido_barra = !vis(btnBloq());
    r.corpo_bloqueio_visivel = vis(document.getElementById('ag-tab-bloqueio'));
    r.titulo_bloqueio = document.getElementById('ag-modal-title').textContent.trim() === 'Bloquear horário';
    chamou = ''; agSalvarTab(); r.salvar_bloqueio = chamou === 'bloqueio';

    // 4) voltar a abrir agendamento normal -> aba segue escondida e roteia agendamento
    agAbrirNovoModal();
    r.bloq_escondido_de_novo = !vis(btnBloq());
    chamou = ''; agSalvarTab(); r.salvar_agendamento2 = chamou === 'agendamento';
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- janela de agendamento ---');
  ok('aba "Bloquear horário" escondida', out.bloq_escondido_novo);
  ok('aba "Novo agendamento" visível', out.agendamento_visivel);
  ok('corpo de agendamento mostrando', out.corpo_agendamento && out.corpo_bloqueio_oculto);
  ok('salvar roteia pra agendamento', out.salvar_agendamento);
  console.log('\n--- bloqueio pela barra da agenda (continua funcionando) ---');
  ok('abre o corpo do bloqueio', out.corpo_bloqueio_visivel);
  ok('título vira "Bloquear horário"', out.titulo_bloqueio);
  ok('aba continua escondida', out.bloq_escondido_barra);
  ok('salvar roteia pra bloqueio', out.salvar_bloqueio);
  console.log('\n--- reabrir agendamento ---');
  ok('aba segue escondida', out.bloq_escondido_de_novo);
  ok('salvar volta a rotear agendamento', out.salvar_agendamento2);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  const tudo = out.bloq_escondido_novo && out.agendamento_visivel && out.corpo_agendamento && out.corpo_bloqueio_oculto && out.salvar_agendamento
    && out.corpo_bloqueio_visivel && out.titulo_bloqueio && out.bloq_escondido_barra && out.salvar_bloqueio
    && out.bloq_escondido_de_novo && out.salvar_agendamento2 && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
