// Edição de série recorrente: prova que a caixa abre preenchida, que só reescreve a série quando a
// recorrência MUDOU, e que uma série legada (14 dias) não é silenciosamente virada em semanal.
// Roda de total/ com o arquivo servido: node shots/ag-editar-recor.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8130';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 700, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const chamadas = [];
    const AG = {
      id: 'ap-1', status: 'AGENDADO',
      patient: { id: 'pac-1', codigo: 'AP0042', nomeCompleto: 'Maria Silva', telefone1: '34999887766' },
      professional: { id: 'p1' }, unit: { id: 'u1' }, type: { id: 't1' },
      startAt: new Date(2026, 6, 13, 14, 0).toISOString(), endAt: new Date(2026, 6, 13, 14, 30).toISOString(),
      online: false, observacoes: null,
      recurrenceId: 'serie-1', recurrencePattern: 'WEEKLY', recurrenceUntil: '2026-09-30',
    };
    window.pacApi = async (path, opts) => {
      chamadas.push((opts && opts.method || 'GET') + ' ' + path);
      if (path.match(/\/appointments\/ap-1$/) && (!opts || opts.method === 'GET')) return { ok: true, data: { ok: true, agendamento: AG } };
      if (opts && opts.method === 'PUT') return { ok: true, data: { ok: true, criados: 5, apagados: 4 } };
      return { ok: true, data: { tipos: [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }], agendamentos: [], blocos: [], itens: [] } };
    };
    window.pacCarregarApoio = async () => {};
    window.agCarregar = async () => {};
    window.confirm = () => true;
    window.homeToast = () => {};
    pacState.unidades = [{ id: 'u1', nome: 'Aplic Ituiutaba', primaria: true }];
    pacState.profissionais = [{ id: 'p1', nome: 'Matheus', role: 'medico' }];
    agState.tipos = [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }];
    meData = { permissoes: ['agenda.criar'] }; authUser = { role: 'medico' };
    document.getElementById('auth-overlay').style.display = 'none';
    agPreencherSelects();

    const r = {};
    // 1) abre a série -> caixa editável e preenchida
    await agAbrirEditarModal('ap-1');
    r.caixa_visivel = document.getElementById('ag-recorrencia-box').style.display !== 'none';
    r.toggle_marcado = document.getElementById('ag-recorrente-toggle').checked;
    r.pattern_preenchido = document.getElementById('ag-recor-pattern').value;
    r.until_preenchido = document.getElementById('ag-recor-until').value;
    r.info = document.getElementById('ag-recor-info-text').textContent.slice(0, 120);

    // 2) salvar SEM mexer na recorrência -> PUT simples, NÃO reescreve a série
    chamadas.length = 0;
    document.getElementById('ag-observacoes').value = 'só uma nota';
    await agSalvar();
    r.rota_sem_mudanca = chamadas.filter((c) => c.startsWith('PUT'));

    // 3) muda o padrão -> rota de recorrência
    await agAbrirEditarModal('ap-1');
    chamadas.length = 0;
    document.getElementById('ag-recor-pattern').value = 'EVERY_15_DAYS';
    await agSalvar();
    r.rota_com_mudanca = chamadas.filter((c) => c.startsWith('PUT'));

    // 4) tira a recorrência -> rota de recorrência, sem pattern
    await agAbrirEditarModal('ap-1');
    chamadas.length = 0;
    document.getElementById('ag-recorrente-toggle').checked = false;
    agToggleRecorrencia();
    await agSalvar();
    r.rota_sem_recor = chamadas.filter((c) => c.startsWith('PUT'));

    // 5) série LEGADA (14 dias): o select não pode cair calado em Semanal
    AG.recurrencePattern = 'BIWEEKLY';
    await agAbrirEditarModal('ap-1');
    const sel = document.getElementById('ag-recor-pattern');
    r.legado_value = sel.value;
    r.legado_label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '(nenhuma)';
    chamadas.length = 0;
    await agSalvar(); // salvar sem tocar em nada
    r.legado_rota = chamadas.filter((c) => c.startsWith('PUT'));
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- abrir série recorrente ---');
  ok('caixa de recorrência visível na edição', out.caixa_visivel);
  ok('toggle vem marcado', out.toggle_marcado);
  ok('padrão preenchido com o da série', out.pattern_preenchido === 'WEEKLY', out.pattern_preenchido);
  ok('"até" preenchido', out.until_preenchido === '2026-09-30', out.until_preenchido);
  console.log('  info:', out.info);
  console.log('\n--- roteamento ---');
  ok('sem mexer na recorrência => PUT simples', out.rota_sem_mudanca.length === 1 && !out.rota_sem_mudanca[0].includes('/recorrencia'), out.rota_sem_mudanca.join());
  ok('mudou o padrão => rota /recorrencia', out.rota_com_mudanca.some((c) => c.includes('/recorrencia')), out.rota_com_mudanca.join());
  ok('tirou a recorrência => rota /recorrencia', out.rota_sem_recor.some((c) => c.includes('/recorrencia')), out.rota_sem_recor.join());
  console.log('\n--- série legada (14 dias) ---');
  ok('select mantém o padrão legado', out.legado_value === 'BIWEEKLY', out.legado_value);
  ok('e mostra o passo real', /14 dias/.test(out.legado_label), out.legado_label);
  ok('salvar sem tocar NÃO reescreve a série', out.legado_rota.length === 1 && !out.legado_rota[0].includes('/recorrencia'), out.legado_rota.join());
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
