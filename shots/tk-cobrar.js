// Botão "Ir para a cobrança" da tarefa de contrato: sem permissão tem que AVISAR (antes ia pro
// painel em silêncio e parecia que o clique não fazia nada); com a permissão estreita tem que
// abrir a aba Cobrança sem exigir o Financeiro inteiro.
// Roda de total/ com o arquivo servido: node shots/tk-cobrar.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8130';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1100, height: 800 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const toasts = [];
    window.homeToast = (m) => toasts.push(m);
    window.pacApi = async () => ({ ok: true, data: { ok: true, fila: [], orcamentos: [] } });
    document.getElementById('auth-overlay').style.display = 'none';
    const r = {};
    const viewAtual = () => (document.querySelector('.view.active') || {}).id || '(nenhuma)';

    // 1) recepcionista SEM permissão de cobrar: tem que AVISAR, não sumir
    meData = { permissoes: ['agenda.criar', 'paciente.ver_lista'] }; authUser = { role: 'recepcao' };
    toasts.length = 0;
    homeTarefaCobrar('p1');
    r.sem_perm_toast = toasts.join(' | ');
    r.sem_perm_view = viewAtual();

    // 2) COM a permissão estreita: abre a view e a aba cobrança, SEM financeiro.ver
    meData = { permissoes: ['agenda.criar', 'prescricao_inj.cobrar'] }; authUser = { role: 'recepcao' };
    r.abas_com_estreita = injAllowed();
    r.ve_precos = injAllowed().includes('precos');
    toasts.length = 0;
    homeTarefaCobrar('p1');
    await new Promise((x) => setTimeout(x, 120));
    r.com_perm_view = viewAtual();
    r.com_perm_toast = toasts.join(' | ');
    r.aba_ativa = (document.querySelector('#view-injetaveis .pt-tab.active') || {}).dataset?.tab || '(nenhuma)';

    // 3) quem tem financeiro.ver continua com tudo (compat)
    meData = { permissoes: ['financeiro.ver'] }; authUser = { role: 'gestor' };
    r.abas_financeiro = injAllowed();
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- recepcionista SEM permissão de cobrar ---');
  ok('AVISA em vez de não fazer nada', /não tem permissão para cobrar/i.test(out.sem_perm_toast), out.sem_perm_toast);
  ok('não muda de tela em silêncio', out.sem_perm_view !== 'view-injetaveis', out.sem_perm_view);
  console.log('\n--- recepcionista COM prescricao_inj.cobrar (sem financeiro.ver) ---');
  ok('abre a view Injetáveis', out.com_perm_view === 'view-injetaveis', out.com_perm_view);
  ok('cai na aba Cobrança', out.aba_ativa === 'cobranca', out.aba_ativa);
  ok('sem toast de erro', out.com_perm_toast === '', JSON.stringify(out.com_perm_toast));
  ok('NÃO ganha a aba Preços (só cobra)', !out.ve_precos, JSON.stringify(out.abas_com_estreita));
  console.log('\n--- quem tem financeiro.ver ---');
  ok('continua vendo cobrança e preços', out.abas_financeiro.includes('cobranca') && out.abas_financeiro.includes('precos'), JSON.stringify(out.abas_financeiro));
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
