// Regressões pegas na revisão: (1) editar série bisemanal matava o Salvar em silêncio (ancoras
// null); (2) a caixa mostrava o 2º dia CHUTADO (+3 dias) em vez do dia real da série.
// Roda de total/ com o arquivo servido: node shots/ag-editar-bisem.js <porta>
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
    const chamadas = []; let enviado = null;
    // Série REAL: segunda 14:00 + SEXTA 20:00. O chute antigo diria "quinta" (segunda + 3).
    const ANC = [new Date(2026, 6, 13, 14, 0).toISOString(), new Date(2026, 6, 17, 20, 0).toISOString()];
    const AG = {
      id: 'ap-1', status: 'AGENDADO',
      patient: { id: 'pac-1', codigo: 'AP0042', nomeCompleto: 'Maria Silva', telefone1: '34999887766' },
      professional: { id: 'p1' }, unit: { id: 'u1' }, type: { id: 't1' },
      startAt: new Date(2026, 6, 20, 14, 0).toISOString(), endAt: new Date(2026, 6, 20, 14, 30).toISOString(),
      online: false, observacoes: null,
      recurrenceId: 'serie-1', recurrencePattern: 'TWICE_WEEKLY', recurrenceUntil: '2026-09-30T00:00:00.000Z',
    };
    window.pacApi = async (path, opts) => {
      chamadas.push((opts && opts.method || 'GET') + ' ' + path);
      if (path.match(/\/appointments\/ap-1$/) && (!opts || opts.method === 'GET')) return { ok: true, data: { ok: true, agendamento: AG, serie_ancoras: ANC } };
      if (opts && opts.method === 'PUT') { enviado = JSON.parse(opts.body); return { ok: true, data: { ok: true, criados: 8, apagados: 6 } }; }
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
    await agAbrirEditarModal('ap-1');
    r.dia1 = document.getElementById('ag-bisem-dia1').value;
    r.hora1 = document.getElementById('ag-bisem-hora1').value;
    r.dia2 = document.getElementById('ag-bisem-dia2').value;
    r.hora2 = document.getElementById('ag-bisem-hora2').value;
    r.preview = document.getElementById('ag-bisem-prev').innerText.trim();

    // salvar SEM tocar em nada: não pode reescrever a série do paciente
    chamadas.length = 0; enviado = null;
    await agSalvar();
    r.rota_sem_mudanca = chamadas.filter((c) => c.startsWith('PUT'));
    r.erro_apos_salvar = document.getElementById('ag-modal-erro').innerText.trim();

    // mudar o 2º dia: aí sim reescreve
    await agAbrirEditarModal('ap-1');
    document.getElementById('ag-bisem-dia2').value = '3'; // quarta
    chamadas.length = 0; enviado = null;
    await agSalvar();
    r.rota_com_mudanca = chamadas.filter((c) => c.startsWith('PUT'));
    r.dias_enviados = enviado && enviado.recurrence_dias ? enviado.recurrence_dias.map((x) => new Date(x.start_at).getDay()) : null;
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- abrir série bisemanal (real: SEGUNDA 14:00 + SEXTA 20:00) ---');
  ok('1º dia = segunda (1)', out.dia1 === '1', out.dia1);
  ok('1º horário = 14:00', out.hora1 === '14:00', out.hora1);
  ok('2º dia = SEXTA (5), não o chute quinta (4)', out.dia2 === '5', out.dia2 + (out.dia2 === '4' ? '  <-- CHUTE!' : ''));
  ok('2º horário = 20:00 (não vazio)', out.hora2 === '20:00', JSON.stringify(out.hora2));
  console.log('  preview:', out.preview);
  console.log('\n--- salvar sem tocar em nada ---');
  ok('NÃO morreu calado (sem exceção)', true);
  ok('NÃO reescreveu a série', out.rota_sem_mudanca.length === 1 && !out.rota_sem_mudanca[0].includes('/recorrencia'), out.rota_sem_mudanca.join());
  ok('sem erro na tela', out.erro_apos_salvar === '', JSON.stringify(out.erro_apos_salvar));
  console.log('\n--- mudar o 2º dia pra quarta ---');
  ok('reescreve a série', out.rota_com_mudanca.some((c) => c.includes('/recorrencia')), out.rota_com_mudanca.join());
  ok('manda segunda(1) + quarta(3)', JSON.stringify(out.dias_enviados) === '[1,3]', JSON.stringify(out.dias_enviados));
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
