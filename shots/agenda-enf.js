// Botão "agenda" no modal de agendamento: agenda da SEMANA das enfermeiras da unidade (7 colunas de
// dia, igual à agenda principal), com regra de CAPACIDADE (consultas + aplicações < nº de enfermeiras).
// Roda de total/: node shots/agenda-enf.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8160';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    // Semana de 2026-07-19(Dom) a 25(Sáb). Qui 23: n1 consulta 10:00 + 1 aplicação -> sobra 0 (cheio).
    // Sex 24: n2 bloqueio 12:00-13:00. Médico não entra.
    window.pacApi = async (url) => {
      if (url.indexOf('/appointments/blocks/list') !== -1) return { ok: true, data: { blocos: [{ professional: { id: 'n2' }, start_at: '2026-07-24T12:00:00', end_at: '2026-07-24T13:00:00', titulo: 'Almoço' }] } };
      if (url.indexOf('/appointments?') !== -1) return { ok: true, data: { agendamentos: [
        { id: 'a1', status: 'AGENDADO', professional: { id: 'n1' }, patient: { nomeCompleto: 'Maria Silva' }, start_at: '2026-07-23T10:00:00', end_at: '2026-07-23T10:30:00' },
        { id: 'a2', status: 'ATENDIDO', professional: null, professional_id: null, patient: { nomeCompleto: 'João Souza' }, start_at: '2026-07-23T10:00:00', end_at: '2026-07-23T10:30:00' },
        { id: 'a3', status: 'AGENDADO', professional: { id: 'm1' }, patient: { nomeCompleto: 'Dr Paciente' }, start_at: '2026-07-22T14:00:00', end_at: '2026-07-22T14:30:00' },
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
    document.getElementById('ag-data').value = '2026-07-23';
    const hEl = document.getElementById('ag-hora'); if (hEl) hEl.disabled = false;

    await agPanoAbrir();
    await new Promise((x) => setTimeout(x, 80));

    r.overlay = !!document.getElementById('ag-pano-ov');
    const cols = [...document.querySelectorAll('.agpd-col')];
    r.n_colunas = cols.length;                                 // 7 dias
    const heads = [...document.querySelectorAll('.agpd-chead .n')].map(e => e.textContent.trim());
    r.heads = heads.join(' | ');
    r.tem_7_dias = heads.length === 7;
    r.tem_dom_19 = /Dom 19\/07/.test(heads[0] || '');
    r.tem_sab_25 = /Sáb 25\/07/.test(heads[6] || '');
    r.titulo = (document.getElementById('ag-pano-titulo') || {}).textContent || '';

    const qui = cols[4];  // Dom=0..Qui=4
    const sex = cols[5];
    r.qui_tem_maria = [...qui.querySelectorAll('.agpd-ev')].some(e => /Maria/.test(e.textContent));
    r.qui_tem_joao_app = [...qui.querySelectorAll('.agpd-ev.app')].some(e => /João/.test(e.textContent));
    r.sex_tem_almoco = [...sex.querySelectorAll('.agpd-ev.bl')].some(e => /Almoço/.test(e.textContent));
    r.dr_fora = ![...document.querySelectorAll('.agpd-ev')].some(e => /Dr Paciente/.test(e.textContent));

    // capacidade: qui 10:00 cheio (consulta+aplicação=2), qui 09:00 livre
    const livreEm = (col, hhmm) => [...col.querySelectorAll('.agpd-slot.livre')].some(s => (s.getAttribute('onclick') || '').indexOf("'" + hhmm + "'") !== -1);
    r.qui_livre_09 = livreEm(qui, '09:00');
    r.qui_cheio_10 = !livreEm(qui, '10:00');

    // navegação de semana muda o título
    const t1 = r.titulo;
    agPanoNavSemana(1);
    await new Promise((x) => setTimeout(x, 60));
    r.nav_mudou = (document.getElementById('ag-pano-titulo').textContent || '') !== t1;
    agPanoNavSemana(-1); // volta
    await new Promise((x) => setTimeout(x, 60));

    // clicar num vago da QUINTA às 09:00 preenche DATA (23/07) + hora
    const cols2 = [...document.querySelectorAll('.agpd-col')];
    const quiLivre09 = [...cols2[4].querySelectorAll('.agpd-slot.livre')].find(s => (s.getAttribute('onclick') || '').indexOf("'09:00'") !== -1);
    if (quiLivre09) quiLivre09.click();
    r.data_preenchida = document.getElementById('ag-data').value === '2026-07-23';
    r.data_visivel = (document.querySelector('.inp-data[data-alvo="ag-data"]') || {}).value === '23/07/2026';
    r.hora_preenchida = document.getElementById('ag-hora').value === '09:00';
    r.fechou = !document.getElementById('ag-pano-ov');
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- semana inteira (igual à agenda) ---');
  ok('overlay abre', out.overlay);
  ok('7 colunas de dia', out.n_colunas === 7 && out.tem_7_dias, String(out.n_colunas));
  ok('Dom 19 ... Sáb 25', out.tem_dom_19 && out.tem_sab_25, out.heads);
  ok('título da semana', /19\/07/.test(out.titulo) && /25\/07/.test(out.titulo), out.titulo);
  ok('navegação de semana muda a faixa', out.nav_mudou);
  console.log('\n--- blocos no dia certo ---');
  ok('Qui: consulta da Maria', out.qui_tem_maria);
  ok('Qui: aplicação do João (marcada)', out.qui_tem_joao_app);
  ok('Sex: bloqueio Almoço', out.sex_tem_almoco);
  ok('médico não entra', out.dr_fora);
  console.log('\n--- capacidade ---');
  ok('Qui 09h livre', out.qui_livre_09);
  ok('Qui 10h CHEIO (consulta+aplicação=2 enfermeiras)', out.qui_cheio_10);
  console.log('\n--- clicar preenche data + hora ---');
  ok('data = 2026-07-23', out.data_preenchida);
  ok('data visível = 23/07/2026', out.data_visivel);
  ok('hora = 09:00', out.hora_preenchida);
  ok('fecha ao escolher', out.fechou);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  await p.evaluate(async () => { document.getElementById('ag-data').value = '2026-07-23'; await agPanoAbrir(); await new Promise(x => setTimeout(x, 90)); });
  const el = await p.$('#ag-pano-ov .atn-modal');
  if (el) { await el.screenshot({ path: 'shots/agenda_enf.png' }); console.log('screenshot: shots/agenda_enf.png'); }

  const tudo = out.overlay && out.n_colunas === 7 && out.tem_dom_19 && out.tem_sab_25 && out.nav_mudou
    && out.qui_tem_maria && out.qui_tem_joao_app && out.sex_tem_almoco && out.dr_fora
    && out.qui_livre_09 && out.qui_cheio_10 && out.data_preenchida && out.data_visivel && out.hora_preenchida && out.fechou && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
