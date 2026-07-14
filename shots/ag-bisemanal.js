// Dirige o modal de agendamento pra provar a bisemanal: escolhe seg 14:00 + sex 20:00,
// confere o preview e captura o payload que vai pro backend. API stubbada.
// Roda de total/ com o arquivo servido: node shots/ag-bisemanal.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8120';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'], defaultViewport: { width: 700, height: 1400, deviceScaleFactor: 2 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    let enviado = null;
    window.pacApi = async (path, opts) => {
      if (opts && opts.method === 'POST' && path.endsWith('/appointments')) { enviado = JSON.parse(opts.body); return { ok: true, data: { ok: true } }; }
      if (path.includes('/appointments/types')) return { ok: true, data: { tipos: [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }] } };
      return { ok: true, data: { agendamentos: [], blocos: [], itens: [] } };
    };
    window.pacCarregarApoio = async () => {};
    window.agCarregar = async () => {};
    pacState.unidades = [{ id: 'u1', nome: 'Aplic Ituiutaba', primaria: true }];
    pacState.profissionais = [{ id: 'p1', nome: 'Matheus Severino', role: 'medico' }];
    agState.tipos = [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }];
    meData = { permissoes: ['agenda.criar'] }; authUser = { role: 'medico' };
    document.getElementById('auth-overlay').style.display = 'none';
    agPreencherSelects();
    agAbrirNovoModal();
    agSelecionarPaciente({ id: 'pac-1', codigo: 'AP0042', nome: 'Maria Silva', telefone: '34999887766', status: 'ATIVO' });

    const r = {};
    // opções oferecidas
    r.opcoes = [...document.getElementById('ag-recor-pattern').options].map((o) => o.value + '=' + o.textContent);

    // série começando na segunda 13/07/2026
    document.getElementById('ag-data').value = '2026-07-13';
    document.getElementById('ag-type').value = 't1';
    document.getElementById('ag-prof').value = 'p1';
    document.getElementById('ag-duracao').value = '30';

    document.getElementById('ag-recorrente-toggle').checked = true;
    agToggleRecorrencia();
    document.getElementById('ag-recor-pattern').value = 'TWICE_WEEKLY';
    agRecorPatternMudou();

    r.caixa_bisem_visivel = document.getElementById('ag-bisem').style.display !== 'none';
    r.hora_topo_desativada = document.getElementById('ag-hora').disabled;
    r.label_hora = document.getElementById('ag-hora-label').innerText.trim();
    r.label_data = document.getElementById('ag-data-label').innerText.trim();
    r.dia1_default = document.getElementById('ag-bisem-dia1').value; // 1 = segunda (dia da data)

    // seg 14:00 + sex 20:00 (o exemplo do Matheus)
    document.getElementById('ag-bisem-dia1').value = '1';
    document.getElementById('ag-bisem-hora1').value = '14:00';
    document.getElementById('ag-bisem-dia2').value = '5';
    document.getElementById('ag-bisem-hora2').value = '20:00';
    agBisemPreview();
    r.preview = document.getElementById('ag-bisem-prev').innerText.trim();
    document.getElementById('ag-recor-until').value = '2026-08-09';

    // dois dias iguais => bloqueia
    document.getElementById('ag-bisem-dia2').value = '1';
    agBisemPreview();
    r.preview_dias_iguais = document.getElementById('ag-bisem-prev').innerText.trim();
    await agSalvar();
    r.erro_dias_iguais = document.getElementById('ag-modal-erro').innerText.trim();
    r.nao_enviou_com_dias_iguais = enviado === null;

    // volta pro caso bom e salva
    document.getElementById('ag-bisem-dia2').value = '5';
    agBisemPreview();
    await agSalvar();
    r.payload = enviado;
    return r;
  });

  console.log('OPÇÕES DO DROPDOWN:');
  out.opcoes.forEach((o) => console.log('   ' + o));
  console.log('\ncaixa bisemanal visível:', out.caixa_bisem_visivel);
  console.log('hora do topo desativada:', out.hora_topo_desativada, '| label:', JSON.stringify(out.label_hora));
  console.log('label da data:', JSON.stringify(out.label_data));
  console.log('1º dia default (1=segunda, veio da data):', out.dia1_default);
  console.log('\nPREVIEW:', out.preview);
  console.log('\nDois dias iguais -> preview:', out.preview_dias_iguais);
  console.log('                 -> erro:', JSON.stringify(out.erro_dias_iguais), '| bloqueou o envio:', out.nao_enviou_com_dias_iguais);
  console.log('\nPAYLOAD ENVIADO AO BACKEND:');
  console.log(JSON.stringify(out.payload, null, 1));
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  // o save fechou o modal: reabre pra fotografar a caixa preenchida
  await p.evaluate(() => {
    document.getElementById('ag-modal').classList.add('aberto');
    document.getElementById('ag-data').value = '2026-07-13';
    document.getElementById('ag-recorrente-toggle').checked = true;
    agToggleRecorrencia();
    document.getElementById('ag-recor-pattern').value = 'TWICE_WEEKLY';
    agRecorPatternMudou();
    document.getElementById('ag-bisem-dia1').value = '1';
    document.getElementById('ag-bisem-hora1').value = '14:00';
    document.getElementById('ag-bisem-dia2').value = '5';
    document.getElementById('ag-bisem-hora2').value = '20:00';
    agBisemPreview();
  });
  await new Promise((r) => setTimeout(r, 400));
  const box = await p.$('#ag-recorrencia-section');
  if (box) await box.screenshot({ path: OUT + 'ag_bisemanal.png' });
  console.log('shot: caixa de recorrência');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
