// Regressão do bug pego na revisão: às 21h+ o preview misturava fuso e mostrava a data do dia
// seguinte ("Sexta 18/07", que é sábado). E âncora além do fim da série sumia calada.
// Roda de total/ com o arquivo servido: node shots/ag-bisemanal-21h.js <porta>
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
    let enviado = null;
    window.pacApi = async (path, opts) => {
      if (opts && opts.method === 'POST' && path.endsWith('/appointments')) { enviado = JSON.parse(opts.body); return { ok: true, data: { ok: true } }; }
      return { ok: true, data: { tipos: [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }], agendamentos: [], blocos: [], itens: [] } };
    };
    window.pacCarregarApoio = async () => {};
    window.agCarregar = async () => {};
    pacState.unidades = [{ id: 'u1', nome: 'Aplic Ituiutaba', primaria: true }];
    pacState.profissionais = [{ id: 'p1', nome: 'Matheus', role: 'medico' }];
    agState.tipos = [{ id: 't1', nome: 'Consulta', duracao_minutos: 30 }];
    meData = { permissoes: ['agenda.criar'] }; authUser = { role: 'medico' };
    document.getElementById('auth-overlay').style.display = 'none';
    agPreencherSelects();

    const cenario = (dataBase, w1, h1, w2, h2, until) => {
      agAbrirNovoModal();
      agSelecionarPaciente({ id: 'pac-1', codigo: 'AP1', nome: 'Maria', telefone: '34999887766' });
      document.getElementById('ag-data').value = dataBase;
      document.getElementById('ag-type').value = 't1';
      document.getElementById('ag-prof').value = 'p1';
      document.getElementById('ag-duracao').value = '30';
      document.getElementById('ag-recorrente-toggle').checked = true;
      agToggleRecorrencia();
      document.getElementById('ag-recor-pattern').value = 'TWICE_WEEKLY';
      agRecorPatternMudou();
      document.getElementById('ag-bisem-dia1').value = String(w1);
      document.getElementById('ag-bisem-hora1').value = h1;
      document.getElementById('ag-bisem-dia2').value = String(w2);
      document.getElementById('ag-bisem-hora2').value = h2;
      document.getElementById('ag-recor-until').value = until;
      agBisemPreview();
      return document.getElementById('ag-bisem-prev').innerText.trim();
    };

    const r = {};
    try {
      // BUG 1: sexta às 21h. Antes: "Sexta 18/07/2026" (sábado). Agora tem que dizer 17/07.
      r.prev_21h = cenario('2026-07-13', 1, '14:00', 5, '21:00', '2026-08-09');
      enviado = null;
      await agSalvar();
      r.ancora_21h_enviada = enviado && enviado.recurrence_dias[1].start_at;

      // BUG 2: âncora depois do fim da série -> tem que avisar, não sumir calada
      r.prev_fora = cenario('2026-07-13', 1, '14:00', 5, '20:00', '2026-07-15');
      enviado = null;
      await agSalvar();
      r.erro_fora = document.getElementById('ag-modal-erro').innerText.trim();
      r.bloqueou_envio = enviado === null;
    } catch (e) {
      r.excecao = e.message + ' || ' + e.stack.split('\n').slice(1, 4).join(' | ');
    }
    return r;
  });

  console.log('--- 21h (o bug do fuso) ---');
  console.log('preview:', out.prev_21h);
  console.log('âncora enviada:', out.ancora_21h_enviada);
  console.log('  preview diz 17/07 (sexta de verdade):', out.prev_21h.includes('17/07/2026'));
  console.log('  preview NÃO diz 18/07 (que é sábado):', !out.prev_21h.includes('18/07'));
  console.log('\n--- âncora depois do fim da série ---');
  console.log('preview:', out.prev_fora);
  console.log('erro no save:', JSON.stringify(out.erro_fora));
  console.log('  bloqueou o envio:', out.bloqueou_envio);
  if (out.excecao) console.log('\nEXCEÇÃO:', out.excecao);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
