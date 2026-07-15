// Panorama de horários das enfermeiras (botão ao lado da Data no modal de agendamento).
// Prova: mostra livre/ocupado/bloqueio por enfermeira, ESTICA a grade pra não esconder compromisso
// fora do recorte, clicar num livre preenche hora+profissional, e erro != "tudo livre".
// Roda de total/ com o arquivo servido: node shots/ag-panorama.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8130';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'], defaultViewport: { width: 1050, height: 780, deviceScaleFactor: 2 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const iso = (h, m) => new Date(2026, 6, 16, h, m).toISOString();
    let queries = [];
    window.pacApi = async (path) => {
      queries.push(path);
      if (path.includes('/appointments/blocks/list')) {
        return { ok: true, data: { blocos: [
          { professional_id: 'e1', start_at: iso(12, 0), end_at: iso(13, 0), titulo: 'Almoço' },
          // Plantão às 21h: FORA do recorte padrão (07–20) — a grade tem que esticar, não esconder.
          { professional_id: 'e2', start_at: iso(21, 0), end_at: iso(22, 0), titulo: 'Plantão' },
        ] } };
      }
      if (path.includes('/appointments?')) {
        return { ok: true, data: { agendamentos: [
          { professional_id: 'e1', start_at: iso(9, 0), end_at: iso(9, 30), status: 'AGENDADO', patient: { nomeCompleto: 'Maria Silva' } },
          { professional_id: 'e1', start_at: iso(10, 0), end_at: iso(10, 30), status: 'CANCELADO', patient: { nomeCompleto: 'Cancelada Nao Conta' } },
          { professional_id: 'e2', start_at: iso(14, 0), end_at: iso(15, 0), status: 'CONFIRMADO', patient: { nomeCompleto: 'João Souza' } },
        ] } };
      }
      return { ok: true, data: { ok: true } };
    };
    window.homeToast = () => {};
    pacState.unidades = [{ id: 'u1', nome: 'Aplic Ituiutaba', primaria: true }];
    pacState.profissionais = [
      { id: 'e1', nome: 'Enf. Bia', role: 'enfermagem', ativo: true },
      { id: 'e2', nome: 'Enf. Carla', role: 'enfermagem', ativo: true },
      { id: 'm1', nome: 'Dr. Matheus', role: 'medico', ativo: true },
    ];
    agState.tipos = [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }];
    meData = { permissoes: ['agenda.criar'] }; authUser = { id: 'u9', role: 'recepcao' };
    document.getElementById('auth-overlay').style.display = 'none';
    agPreencherSelects();
    agAbrirNovoModal();
    document.getElementById('ag-data').value = '2026-07-16';
    document.getElementById('ag-unit').value = 'u1';

    const r = {};
    r.tem_botao = !!document.querySelector('.ag-pano-btn');
    queries = [];
    await agPanoAbrir();
    await new Promise((x) => setTimeout(x, 300));
    const body = document.getElementById('ag-pano-body');
    r.txt = (body ? body.innerText : '').replace(/\s+/g, ' ').trim();
    r.queries = queries;
    r.linhas = [...document.querySelectorAll('.agp-row:not(.head) .agp-nome')].map((x) => x.innerText.replace(/\s+/g, ' ').trim());
    // grade esticou até 22h por causa do plantão?
    r.horas = [...document.querySelectorAll('.agp-row.head .agp-h')].map((x) => x.textContent).filter(Boolean);
    r.cancelada_conta = /Cancelada/.test(body ? body.innerHTML : '');
    // clicar num livre preenche
    const livre = document.querySelector('.agp-cells .agp-c.livre');
    r.tem_livre = !!livre;
    if (livre) livre.click();
    r.hora_preenchida = document.getElementById('ag-hora').value;
    r.prof_preenchido = document.getElementById('ag-prof').value;
    r.fechou = !document.getElementById('ag-pano-ov');

    // erro != tudo livre
    window.pacApi = async () => { throw new Error('rede'); };
    await agPanoAbrir();
    await new Promise((x) => setTimeout(x, 200));
    r.erro_txt = (document.getElementById('ag-pano-body') || {}).innerText || '';
    r.erro_sem_grade = !document.querySelector('.agp-cells .agp-c.livre');
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('  botão existe ao lado da Data:', out.tem_botao);
  console.log('  linhas:', JSON.stringify(out.linhas));
  console.log('  horas na grade:', out.horas.join(' '));
  console.log('\n--- só enfermeiras, da unidade ---');
  ok('só as 2 enfermeiras (médico fora)', out.linhas.length === 2 && /Bia/.test(out.linhas[0]) && /Carla/.test(out.linhas[1]));
  ok('filtra pela unidade do formulário', out.queries.some((q) => q.includes('unit=u1')));
  ok('pede só as enfermeiras (?prof=e1,e2)', out.queries.some((q) => q.includes('prof=e1%2Ce2') || q.includes('prof=e1,e2')));
  console.log('\n--- honestidade da grade ---');
  ok('ESTICA até 22h (plantão fora do recorte não some)', out.horas.includes('21:00'), out.horas.slice(-3).join(' '));
  ok('agendamento CANCELADO não ocupa espaço', !out.cancelada_conta);
  console.log('\n--- clicar num livre ---');
  ok('preenche a hora', /^\d{2}:\d{2}$/.test(out.hora_preenchida), out.hora_preenchida);
  ok('preenche a enfermeira', out.prof_preenchido === 'e1', out.prof_preenchido);
  ok('fecha o panorama', out.fechou);
  console.log('\n--- erro ---');
  ok('erro NÃO vira grade toda livre', out.erro_sem_grade && /Não consegui carregar/.test(out.erro_txt), out.erro_txt.slice(0, 60));
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  await p.evaluate(async () => {
    const iso = (h, m) => new Date(2026, 6, 16, h, m).toISOString();
    window.pacApi = async (path) => {
      if (path.includes('/blocks/list')) return { ok: true, data: { blocos: [{ professional_id: 'e1', start_at: iso(12, 0), end_at: iso(13, 0), titulo: 'Almoço' }] } };
      if (path.includes('/appointments?')) return { ok: true, data: { agendamentos: [
        { professional_id: 'e1', start_at: iso(9, 0), end_at: iso(9, 30), status: 'AGENDADO', patient: { nomeCompleto: 'Maria Silva' } },
        { professional_id: 'e2', start_at: iso(14, 0), end_at: iso(15, 0), status: 'CONFIRMADO', patient: { nomeCompleto: 'João Souza' } },
        { professional_id: 'e2', start_at: iso(16, 30), end_at: iso(17, 0), status: 'AGENDADO', patient: { nomeCompleto: 'Ana Paula' } },
      ] } };
      return { ok: true, data: {} };
    };
    await agPanoAbrir();
  });
  await new Promise((r) => setTimeout(r, 500));
  const modal = await p.$('#ag-pano-ov .atn-modal');
  if (modal) await modal.screenshot({ path: OUT + 'ag_panorama.png' });
  console.log('shot: ag_panorama.png');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
