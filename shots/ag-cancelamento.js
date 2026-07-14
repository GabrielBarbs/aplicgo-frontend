// Cancelamento: pela CLÍNICA apaga da agenda (nem aparece como cancelado); pelo PACIENTE fica
// registrado. E o card de "pacientes que cancelaram" na home do gestor.
// Roda de total/ com o arquivo servido: node shots/ag-cancelamento.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8130';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1100, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const chamadas = []; const corpos = [];
    window.pacApi = async (path, opts) => {
      chamadas.push((opts && opts.method || 'GET') + ' ' + path);
      if (opts && opts.body) corpos.push(JSON.parse(opts.body));
      return { ok: true, data: { ok: true, apagados: 1 } };
    };
    window.agCarregar = async () => {}; window.agCarregarMiniCal = async () => {};
    window.prompt = () => 'motivo qualquer';
    window.alert = () => {};
    window.confirm = () => true; // o confirm de "apaga de vez" agora existe: sem stub, trava o teste
    document.getElementById('auth-overlay').style.display = 'none';

    const r = {};
    // rótulo: cancelado sem origem é da clínica (é o que o sistema já assumia)
    r.label_clinica = agStatusLabel('CANCELADO', 'CLINICA');
    r.label_paciente = agStatusLabel('CANCELADO', 'PACIENTE');

    // --- avulso: clínica ---
    agState.agendamentos = [{ id: 'ap-1', recurrence_id: null }];
    agState.statusModalId = 'ap-1';
    chamadas.length = 0; corpos.length = 0;
    await agMudarStatusModal('CANCELADO', 'CLINICA');
    r.clinica_rota = chamadas.join();
    r.clinica_body = corpos[0];

    // --- avulso: paciente ---
    agState.statusModalId = 'ap-1';
    chamadas.length = 0; corpos.length = 0;
    await agMudarStatusModal('CANCELADO', 'PACIENTE');
    r.paciente_body = corpos[0];

    // --- recorrente: textos do modal mudam conforme a origem ---
    agState.agendamentos = [{ id: 'ap-2', recurrence_id: 'serie-1' }];
    agState.statusModalId = 'ap-2';
    await agMudarStatusModal('CANCELADO', 'CLINICA');
    r.modal_clinica = document.getElementById('ag-recur-cancel-desc').textContent.trim();
    r.sub_clinica = document.getElementById('ag-recur-cancel-sub2').textContent.trim();
    agFecharRecurCancel();

    agState.agendamentos = [{ id: 'ap-2', recurrence_id: 'serie-1' }];
    agState.statusModalId = 'ap-2';
    await agMudarStatusModal('CANCELADO', 'PACIENTE');
    r.modal_paciente = document.getElementById('ag-recur-cancel-desc').textContent.trim();
    r.sub_paciente = document.getElementById('ag-recur-cancel-sub2').textContent.trim();
    // e o cancelamento recorrente do paciente manda a origem?
    chamadas.length = 0; corpos.length = 0;
    await agConfirmarRecurCancel('future');
    r.recor_pac_body = corpos[0];
    r.recor_pac_rota = chamadas.join();

    // --- o botão "Cancelar" do modal de EDIÇÃO não pode cancelar sem perguntar a origem ---
    // (era o buraco: mandava sem origem, o backend apagava, e o cancelamento do paciente sumia)
    agState.edicaoRecurInfo = null;
    document.getElementById('ag-modal').classList.add('aberto');
    chamadas.length = 0; corpos.length = 0;
    await agMudarStatus('ap-9', 'CANCELADO');
    r.edicao_nao_cancelou_direto = chamadas.filter((c) => c.includes('/status')).length === 0;
    r.edicao_abriu_modal_origem = document.getElementById('ag-status-modal').classList.contains('aberto');

    // --- card do gestor ---
    r.card_com_dado = gstStatCancelPac({ pacientes: 3, cancelamentos: 5 }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    r.card_zero = gstStatCancelPac({ pacientes: 0, cancelamentos: 0 }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    r.card_sem_backend = gstStatCancelPac(undefined).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- rótulos ---');
  console.log('  clínica:', out.label_clinica, '| paciente:', out.label_paciente);
  console.log('\n--- avulso ---');
  ok('clínica manda origem CLINICA (backend apaga)', out.clinica_body && out.clinica_body.cancelado_por_origem === 'CLINICA', JSON.stringify(out.clinica_body));
  ok('paciente manda origem PACIENTE (backend mantém)', out.paciente_body && out.paciente_body.cancelado_por_origem === 'PACIENTE', JSON.stringify(out.paciente_body));
  console.log('\n--- recorrente: o modal fala a verdade? ---');
  ok('clínica: modal diz APAGA', /APAGA/.test(out.modal_clinica), out.sub_clinica);
  ok('paciente: modal diz fica registrado', /fica registrado/.test(out.modal_paciente), out.sub_paciente);
  ok('recorrente do paciente manda a origem', out.recor_pac_body && out.recor_pac_body.cancelado_por_origem === 'PACIENTE', JSON.stringify(out.recor_pac_body));
  console.log('  rota:', out.recor_pac_rota);
  console.log('\n--- card do gestor ---');
  console.log('  com dado :', out.card_com_dado);
  console.log('  zero     :', out.card_zero);
  console.log('  sem campo:', out.card_sem_backend);
  ok('card mostra a QUANTIDADE DE PACIENTES (3), não de cancelamentos (5)', /\b3\b/.test(out.card_com_dado) && /5 cancelamentos/.test(out.card_com_dado));
  ok('sem o campo do backend, não inventa zero', /—/.test(out.card_sem_backend));
  console.log('\n--- botão "Cancelar" do modal de edição (o buraco grave) ---');
  ok('NÃO cancela direto sem saber a origem', out.edicao_nao_cancelou_direto);
  ok('abre o modal que pergunta quem cancelou', out.edicao_abriu_modal_origem);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
