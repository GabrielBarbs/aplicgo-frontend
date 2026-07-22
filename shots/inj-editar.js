// Editar prescrição de injetáveis: botão "editar" só antes de qualquer ação, reabre a tela de criação
// preenchida (GET /:id -> builder) e salva por cima (PUT). Roda de total/: node shots/inj-editar.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1000, height: 1200 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    window.temPermissao = () => true;

    // Prescrição editável (nada aplicado/agendado/cobrado) e uma NÃO editável (item aplicado) + cancelada.
    // i1 é coberto pelo plano (incluso=true) MAS a política original é 'depende_plano' — a hidratação tem
    // que trazer 'depende_plano' (não congelar como 'incluso'). editavel vem do servidor.
    const prEditavel = { id: 'pr1', patient_id: 'p1', status: 'prescrito', origem_inclusao: 'parcial', data: new Date().toISOString(), observacoes: 'obs antiga', editavel: true, itens: [
      { id: 'i1', sku_ativo: 'SORO_X', semana: 1, dose: '10ml', dose_mcg: null, via: 'EV', incluso: true, incluso_padrao: 'depende_plano', status_item: 'liberado', observacao: 'infusão lenta' },
      { id: 'i2', sku_ativo: 'SORO_X', semana: 2, dose: '10ml', dose_mcg: null, via: 'EV', incluso: false, incluso_padrao: 'depende_plano', status_item: 'pendente_orcamento', observacao: '' },
    ] };
    const prAplicada = { id: 'pr2', patient_id: 'p1', status: 'prescrito', origem_inclusao: 'nao_incluso', data: new Date().toISOString(), editavel: false, itens: [
      { id: 'j1', sku_ativo: 'SORO_X', semana: 1, dose: '10ml', via: 'EV', incluso: false, status_item: 'aplicado' },
    ] };
    const prCancelada = { id: 'pr3', patient_id: 'p1', status: 'cancelado', origem_inclusao: 'nao_incluso', data: new Date().toISOString(), editavel: false, itens: [
      { id: 'k1', sku_ativo: 'SORO_X', semana: 1, dose: '10ml', via: 'EV', incluso: false, status_item: 'cancelado' },
    ] };
    // Prescrição já PAGA: itens 'liberado' (nenhum status "de ação"), mas o servidor sabe que houve orçamento
    // -> editavel:false. O heurístico do cliente mostraria "editar"; o flag do servidor tem que esconder.
    const prPaga = { id: 'pr4', patient_id: 'p1', status: 'liberado', origem_inclusao: 'nao_incluso', data: new Date().toISOString(), editavel: false, itens: [
      { id: 'm1', sku_ativo: 'SORO_X', semana: 1, dose: '10ml', via: 'EV', incluso: false, status_item: 'liberado' },
    ] };

    // Estado do módulo: paciente + catálogo/profs/protocolos preсet (pra injBuilderInit não buscar na API).
    injState.patient = { id: 'p1', nome: 'Paciente Teste', codigo: 'P-1' };
    injState.prescEl = 'inj-conteudo';
    injState.catalogo = [{ sku: 'SORO_X', produto: 'Soro X', categoria: 'soro' }];
    injState.profs = []; injState.protocolos = [];
    injState.builder = null; injState.editId = null; injState.editObs = null;

    let putBody = null, putUrl = null;
    window.pacApi = async (url, opts) => {
      if (opts && opts.method === 'PUT' && /\/prescricoes-inj\/pr1$/.test(url)) { putUrl = url; putBody = JSON.parse(opts.body); return { ok: true, data: { prescricao: { ...prEditavel, observacoes: putBody.observacoes, itens: prEditavel.itens } } }; }
      if (/\/prescricoes-inj\/pr1$/.test(url)) return { ok: true, data: { prescricao: prEditavel } };            // GET /:id
      if (/\/prescricoes-inj\?patient_id=/.test(url)) return { ok: true, data: { prescricoes: [prEditavel] } };   // recentes
      if (/\/insumos\?ativo=true/.test(url)) return { ok: true, data: { itens: [{ sku: 'SORO_X', produto: 'Soro X', categoria: 'soro' }] } };
      return { ok: true, data: {} };
    };

    // A) o card mostra "editar" quando editável, e NÃO mostra quando aplicado/cancelado/pago (flag do servidor)
    r.editavel_tem_botao = /injEditar\('pr1'\)/.test(injPrescResumo(prEditavel)) && /editar/.test(injPrescResumo(prEditavel));
    r.aplicada_sem_botao = !/injEditar\(/.test(injPrescResumo(prAplicada));
    r.cancelada_sem_botao = !/injEditar\(/.test(injPrescResumo(prCancelada));
    r.paga_sem_botao = !/injEditar\(/.test(injPrescResumo(prPaga));   // servidor disse editavel:false apesar de itens 'liberado'

    // container da tela
    const host = document.createElement('div'); host.innerHTML = '<div id="inj-conteudo"></div>'; document.body.appendChild(host);

    // B) editar -> hidrata o builder + entra em modo edição
    await injEditar('pr1');
    await new Promise(x => setTimeout(x, 80));
    r.editId = injState.editId === 'pr1';
    r.editObs = injState.editObs === 'obs antiga';
    r.builder_2_itens = Array.isArray(injState.builder) && injState.builder.length === 2 && injState.builder[0].sku === 'SORO_X' && injState.builder[0].dose === '10ml';
    // hidratação usa a política ORIGINAL (depende_plano), não congela como 'incluso' o item coberto pelo plano
    r.hidrata_incluso_padrao = injState.builder[0].incluso_padrao === 'depende_plano';
    const tela = document.getElementById('inj-conteudo').textContent;
    r.tela_editando = /Editando prescrição/.test(tela);
    r.tela_botao_salvar = /Salvar alterações/.test(tela) && /Cancelar edição/.test(tela);

    // C) salvar -> PUT /prescricoes-inj/pr1 com itens_avulsos, e sai do modo edição
    await injPrescrever2();
    await new Promise(x => setTimeout(x, 80));
    r.put_chamado = putUrl && /\/prescricoes-inj\/pr1$/.test(putUrl);
    r.put_itens = putBody && Array.isArray(putBody.itens_avulsos) && putBody.itens_avulsos.length === 2 && putBody.itens_avulsos[0].sku_ativo === 'SORO_X' && !('patient_id' in putBody);
    r.put_obs = putBody && putBody.observacoes === 'obs antiga';
    r.saiu_edicao = !injState.editId;
    const tela2 = document.getElementById('inj-conteudo').textContent;
    r.voltou_criar = /Montar prescrição/.test(tela2) && !/Editando prescrição/.test(tela2);

    // D) cancelar edição limpa o estado
    await injEditar('pr1'); await new Promise(x => setTimeout(x, 60));
    r.reentrou = injState.editId === 'pr1';
    injCancelarEdicao(); await new Promise(x => setTimeout(x, 60));
    r.cancelou = !injState.editId && !injState.editObs;

    return r;
  });

  const ok = (n, c) => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n);
  console.log('--- botão editar (condicional) ---');
  ok('editável mostra "editar"', out.editavel_tem_botao);
  ok('item aplicado -> sem editar', out.aplicada_sem_botao);
  ok('cancelada -> sem editar', out.cancelada_sem_botao);
  ok('paga (flag servidor) -> sem editar', out.paga_sem_botao);
  console.log('\n--- entrar em edição ---');
  ok('editId setado', out.editId);
  ok('observações carregadas', out.editObs);
  ok('builder hidratado (2 itens)', out.builder_2_itens);
  ok('incluso_padrao original preservado (depende_plano)', out.hidrata_incluso_padrao);
  ok('tela mostra "Editando prescrição"', out.tela_editando);
  ok('botões Salvar + Cancelar edição', out.tela_botao_salvar);
  console.log('\n--- salvar (PUT) ---');
  ok('PUT /prescricoes-inj/pr1', out.put_chamado);
  ok('body tem itens_avulsos (sem patient_id)', out.put_itens);
  ok('observações preservadas', out.put_obs);
  ok('saiu do modo edição', out.saiu_edicao);
  ok('tela voltou pro criar', out.voltou_criar);
  console.log('\n--- cancelar edição ---');
  ok('reentrou na edição', out.reentrou);
  ok('cancelar limpou o estado', out.cancelou);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = out.editavel_tem_botao && out.aplicada_sem_botao && out.cancelada_sem_botao && out.paga_sem_botao && out.editId && out.editObs
    && out.builder_2_itens && out.hidrata_incluso_padrao && out.tela_editando && out.tela_botao_salvar && out.put_chamado && out.put_itens && out.put_obs
    && out.saiu_edicao && out.voltou_criar && out.reentrou && out.cancelou && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
