// Botão "agenda" no modal de agendamento: agenda-do-dia das enfermeiras da unidade.
// Coluna "pool" (Enfermagem da unidade) com as aplicações + coluna por enfermeira. Regra de CAPACIDADE:
// um horário só fica livre se sobrar enfermeira (consultas + aplicações < nº de enfermeiras).
// Roda de total/: node shots/agenda-enf.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8160';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1200, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    // 2 enfermeiras. Às 10:00: Ana(n1) tem consulta + 1 aplicação (sem enfermeira) -> sobra 0 -> TUDO cheio.
    // Bia(n2) tem bloqueio 12:00-13:00. Às 09:00 ninguém ocupado -> sobra 2 -> livre.
    window.pacApi = async (url) => {
      if (url.indexOf('/appointments/blocks/list') !== -1) return { ok: true, data: { blocos: [{ professional: { id: 'n2' }, start_at: '2026-07-25T12:00:00', end_at: '2026-07-25T13:00:00', titulo: 'Almoço' }] } };
      if (url.indexOf('/appointments?') !== -1) return { ok: true, data: { agendamentos: [
        { id: 'a1', status: 'AGENDADO', professional: { id: 'n1' }, patient: { nomeCompleto: 'Maria Silva' }, start_at: '2026-07-25T10:00:00', end_at: '2026-07-25T10:30:00' },
        { id: 'a2', status: 'ATENDIDO', professional: null, professional_id: null, patient: { nomeCompleto: 'João Souza' }, start_at: '2026-07-25T10:00:00', end_at: '2026-07-25T10:30:00' },
        { id: 'a3', status: 'AGENDADO', professional: { id: 'm1' }, patient: { nomeCompleto: 'Dr paciente' }, start_at: '2026-07-25T14:00:00', end_at: '2026-07-25T14:30:00' },
      ] } };
      return { ok: true, data: {} };
    };
    document.getElementById('auth-overlay').style.display = 'none';
    pacState.unidades = [{ id: 'u1', nome: 'Aplic Ituiutaba' }];
    pacState.profissionais = [
      { id: 'n1', nome: 'Ana Enfermeira', role: 'enfermagem' },
      { id: 'n2', nome: 'Bia Enfermeira', role: 'enfermagem' },
      { id: 'm1', nome: 'Dr. Carlos', role: 'medico' },
    ];
    document.getElementById('ag-data').value = '2026-07-25';
    document.getElementById('ag-prof').innerHTML = '<option value="">—</option><option value="n1">Ana</option><option value="n2">Bia</option>';
    const hEl = document.getElementById('ag-hora'); if (hEl) hEl.disabled = false;

    await agPanoAbrir();
    await new Promise((x) => setTimeout(x, 60));

    r.overlay = !!document.getElementById('ag-pano-ov');
    r.tem_grid = !!document.querySelector('#ag-pano-body .agpd-grid');
    const cols = [...document.querySelectorAll('.agpd-col')];
    r.n_colunas = cols.length;                              // pool + 2 enfermeiras = 3
    r.tem_pool = document.querySelectorAll('.agpd-col.pool').length === 1;
    const heads = [...document.querySelectorAll('.agpd-chead .n')].map(e => e.textContent);
    r.heads = heads.join(' | ');
    r.tem_ana = heads.some(t => /Ana/.test(t));
    r.tem_bia = heads.some(t => /Bia/.test(t));
    r.tem_pool_head = heads.some(t => /Enfermagem/.test(t));
    r.nao_tem_medico_col = !heads.some(t => /Carlos/.test(t));   // médico não vira coluna
    r.tem_maria = [...document.querySelectorAll('.agpd-ev')].some(e => /Maria/.test(e.textContent));
    r.joao_no_pool = [...document.querySelectorAll('.agpd-col.pool .agpd-ev')].some(e => /João/.test(e.textContent)); // aplicação no pool
    r.dr_fora = ![...document.querySelectorAll('.agpd-ev')].some(e => /Dr paciente/.test(e.textContent)); // consulta de médico não entra
    r.tem_almoco = [...document.querySelectorAll('.agpd-ev.bl')].some(e => /Almoço/.test(e.textContent));

    // CAPACIDADE: livre num horário?
    const livreEm = (col, hhmm) => [...col.querySelectorAll('.agpd-slot.livre')].some(s => (s.getAttribute('onclick') || '').indexOf("'" + hhmm + "'") !== -1);
    const poolCol = document.querySelector('.agpd-col.pool');
    const biaCol = cols[2]; // ordem: pool, Ana(n1), Bia(n2)
    r.pool_livre_09 = livreEm(poolCol, '09:00');
    r.pool_cheio_10 = !livreEm(poolCol, '10:00');   // sobra 0 -> pool bloqueado
    r.bia_livre_09 = livreEm(biaCol, '09:00');
    r.bia_cheio_10 = !livreEm(biaCol, '10:00');     // Bia "livre" mas equipe cheia -> bloqueada (coração da regra)

    // clicar num slot livre da Bia às 09:00 preenche hora + a enfermeira
    const biaLivre09 = [...biaCol.querySelectorAll('.agpd-slot.livre')].find(s => (s.getAttribute('onclick') || '').indexOf("'09:00'") !== -1);
    if (biaLivre09) biaLivre09.click();
    r.hora_preenchida = document.getElementById('ag-hora').value === '09:00';
    r.prof_preenchido = document.getElementById('ag-prof').value === 'n2';
    r.fechou_ao_escolher = !document.getElementById('ag-pano-ov');
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- estrutura ---');
  ok('overlay abre', out.overlay);
  ok('tem a grade', out.tem_grid);
  ok('pool + 2 enfermeiras = 3 colunas', out.n_colunas === 3, String(out.n_colunas));
  ok('tem a coluna pool "Enfermagem"', out.tem_pool && out.tem_pool_head);
  ok('colunas das enfermeiras', out.tem_ana && out.tem_bia, out.heads);
  ok('médico não vira coluna nem bloco', out.nao_tem_medico_col && out.dr_fora);
  console.log('\n--- blocos ---');
  ok('consulta da Maria (enfermeira)', out.tem_maria);
  ok('aplicação do João no POOL', out.joao_no_pool);
  ok('bloqueio "Almoço" cinza', out.tem_almoco);
  console.log('\n--- capacidade (a regra que você escolheu) ---');
  ok('09h livre no pool (sobra enfermeira)', out.pool_livre_09);
  ok('10h CHEIO no pool (consulta+aplicação = 2 enfermeiras)', out.pool_cheio_10);
  ok('09h livre na Bia', out.bia_livre_09);
  ok('10h BLOQUEADO na Bia mesmo ela livre (equipe cheia)', out.bia_cheio_10);
  console.log('\n--- clicar preenche o form ---');
  ok('hora = 09:00', out.hora_preenchida);
  ok('enfermeira = a clicada (n2)', out.prof_preenchido);
  ok('fecha ao escolher', out.fechou_ao_escolher);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  await p.evaluate(async () => { document.getElementById('ag-hora').value = ''; await agPanoAbrir(); await new Promise(x => setTimeout(x, 80)); });
  const el = await p.$('#ag-pano-ov .atn-modal');
  if (el) { await el.screenshot({ path: 'shots/agenda_enf.png' }); console.log('screenshot: shots/agenda_enf.png'); }

  const tudo = out.overlay && out.tem_grid && out.n_colunas === 3 && out.tem_pool && out.tem_pool_head && out.tem_ana && out.tem_bia && out.nao_tem_medico_col && out.dr_fora
    && out.tem_maria && out.joao_no_pool && out.tem_almoco
    && out.pool_livre_09 && out.pool_cheio_10 && out.bia_livre_09 && out.bia_cheio_10
    && out.hora_preenchida && out.prof_preenchido && out.fechou_ao_escolher && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
