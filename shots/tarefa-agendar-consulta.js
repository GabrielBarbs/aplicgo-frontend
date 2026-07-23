// Tarefa "Agendar consulta" (do onboarding) na recepção: botão de agendar no detalhe, que abre a agenda
// no paciente + amarra o vínculo pra a tarefa concluir ao salvar. Roda de total/: node shots/tarefa-agendar-consulta.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    const host = document.createElement('div'); host.innerHTML = '<div id="atn-overlay"></div>'; document.body.appendChild(host);
    const baseTask = {
      id: 'task1', titulo: 'Agendar consulta médica — Maria', descricao: 'Consulta recomendada em 30 dia(s).',
      status: 'aberta', prazo_dias: 30, vencida: false, hoje: false, contagem: null, de_rotina: false,
      aceite: 'na', prioridade: 'media', pode_aceitar: false,
      origem_tipo: 'consulta_agendar', origem_id: 'evol1', origem_semana: null,
      patient_id: 'p1', paciente_nome: 'Maria', paciente_codigo: 'M-1',
      compartilhada: true, sou_dono: false, sou_criador: false,
      grupo_cargo_nome: 'Recepção', grupo_unidade: 'Unidade Centro', criador_nome: 'Dr. X',
    };

    // A) botão "Agendar consulta" aparece pra tarefa consulta_agendar com paciente
    homeTkDet = { tarefa: baseTask, comentarios: [] };
    try { homeTkRenderDetalhe(); } catch (e) { r.erro_render = e.message; }
    const ovHtml = document.getElementById('atn-overlay').innerHTML;
    r.tem_botao_agendar = /homeTarefaAgendarConsulta\('task1', 'p1'/.test(ovHtml) && /Agendar consulta/.test(ovHtml);
    r.tem_concluir = /homeTarefaConcluir\('task1'/.test(ovHtml);   // continua tendo o "Concluir" manual

    // B) sem patient_id -> sem botão de agendar (mas ainda dá pra concluir)
    homeTkDet = { tarefa: { ...baseTask, patient_id: null }, comentarios: [] };
    homeTkRenderDetalhe();
    r.sem_paciente_sem_botao = !/homeTarefaAgendarConsulta/.test(document.getElementById('atn-overlay').innerHTML);

    // C) homeTarefaAgendarConsulta abre a agenda no paciente + amarra o vínculo
    let selPac = null, abriu = false;
    window.prGarantirApoioAgenda = async () => {};
    window.homeAtencaoFechar = () => {};
    window.agAbrirNovoModal = () => { abriu = true; agState.consultaVinculo = null; agState.injVinculo = null; };  // reset como o real
    window.agSelecionarPaciente = (pp) => { selPac = pp; };
    window.pacApi = async (url) => { if (/\/patients\/p1$/.test(url)) return { ok: true, data: { paciente: { id: 'p1', codigo: 'M-1', nome_completo: 'Maria', telefone1: '11999', status: 'ATIVO' } } }; return { ok: true, data: {} }; };
    await homeTarefaAgendarConsulta('task1', 'p1', null);
    await new Promise(x => setTimeout(x, 40));
    r.abriu_agenda = abriu;
    r.selecionou_paciente = selPac && selPac.id === 'p1' && selPac.nome === 'Maria';
    r.vinculo_setado = agState.consultaVinculo && agState.consultaVinculo.taskId === 'task1';

    // D) o reset do form limpa o vínculo (agResetForm)
    if (typeof agResetForm === 'function') { try { agResetForm(); r.reset_limpa = !agState.consultaVinculo; } catch (e) { r.reset_limpa = 'erro:' + e.message; } }

    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  ok('render sem erro', !out.erro_render, out.erro_render || '');
  ok('botão "Agendar consulta" na tarefa consulta_agendar', out.tem_botao_agendar);
  ok('mantém o "Concluir" manual', out.tem_concluir);
  ok('sem paciente -> sem botão de agendar', out.sem_paciente_sem_botao);
  ok('agenda abre no paciente da tarefa', out.abriu_agenda && out.selecionou_paciente);
  ok('vínculo consulta_task_id amarrado (conclui ao salvar)', out.vinculo_setado);
  ok('agResetForm limpa o vínculo', out.reset_limpa === true);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = !out.erro_render && out.tem_botao_agendar && out.tem_concluir && out.sem_paciente_sem_botao
    && out.abriu_agenda && out.selecionou_paciente && out.vinculo_setado && out.reset_limpa === true && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
