// Testa o modal de Unidades do usuário no Admin: vincular unidade + escolher a primária.
// Regra crítica: só pode sair UMA primária (o backend não tem constraint; a UI é a guardiã),
// e salvar com unidade mas SEM primária tem que barrar (posto morto e calado é o pior caso).
// Roda de total/ com o arquivo servido: node shots/adm-unidades.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8140';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1100, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    const puts = [];
    const U_IT = 'unit-itu', U_UB = 'unit-ube';
    // mock da API: lista de usuários, unidades e captura do PUT
    window.pacApi = async (url, opts) => {
      if (url === '/api/clinico/admin/usuarios') return { ok: true, data: { ok: true, usuarios: [
        { id: 'u1', nome: 'Teste Recp 1', email: 'r1@teste.aplicgo.com', status: 'INVITED', nivel: null, role_tecnico: 'recepcao', cargos: [{ slug: 'recepcao', nome: 'Recepção', cor: '#4A90E2', icone: 'ti-user' }], unidades: [] },
        { id: 'u2', nome: 'Teste Enf 1', email: 'e1@teste.aplicgo.com', status: 'ACTIVE', nivel: null, role_tecnico: 'enfermagem', cargos: [], unidades: [{ id: U_UB, nome: 'Uberlândia', cidade: 'Uberlândia', primaria: true }] },
        // u3: vinculado a uma unidade que foi DESATIVADA (não vem em /units) + a primária ativa.
        { id: 'u3', nome: 'Teste Recp 2', email: 'r2@teste.aplicgo.com', status: 'ACTIVE', nivel: null, role_tecnico: 'recepcao', cargos: [], unidades: [{ id: 'unit-morta', nome: 'Unidade Antiga', cidade: 'Prata', primaria: false }, { id: U_IT, nome: 'Ituiutaba', cidade: 'Ituiutaba', primaria: true }] },
      ] } };
      if (url === '/api/clinico/units') return { ok: true, data: { ok: true, unidades: [
        { id: U_IT, nome: 'Ituiutaba', cidade: 'Ituiutaba' }, { id: U_UB, nome: 'Uberlândia', cidade: 'Uberlândia' },
      ] } };
      if (/\/unidades$/.test(url) && opts && opts.method === 'PUT') { puts.push(JSON.parse(opts.body)); return { ok: true, data: { ok: true } }; }
      return { ok: true, data: { ok: true } };
    };
    window.homeToast = () => {};
    document.getElementById('auth-overlay').style.display = 'none';

    // 1) card mostra aviso pra quem NÃO tem unidade e estrela pra quem tem primária
    await admCarregarUsuarios();
    const cardHtml = document.getElementById('admin-usuarios-wrap').innerHTML;
    r.card_avisa_sem_unidade = /Sem unidade/.test(cardHtml);
    r.card_mostra_primaria = /primária/.test(cardHtml);
    r.card_tem_botao_unidades = /admEditarUnidadesUser/.test(cardHtml);

    // 2) abre o modal do usuário SEM unidade
    await admEditarUnidadesUser('u1');
    r.modal_abriu = document.getElementById('adm-unid-modal').classList.contains('aberto');
    r.opcoes = document.querySelectorAll('#adm-unid-wrap .adm-unid-row').length;

    // 3) salvar SEM nada: unidades vazio, primaria null (permitido = tira do posto)
    await admUnidadeSalvar();
    r.put_vazio = JSON.stringify(puts[puts.length - 1]);

    // 4) marca 1 unidade -> primária deve auto-setar
    admToggleUnidade(U_IT, true);
    r.auto_primaria = admState.unidPrimaria === U_IT;

    // 5) marca a segunda -> primária NÃO muda (continua a primeira)
    admToggleUnidade(U_UB, true);
    r.primaria_estavel = admState.unidPrimaria === U_IT;

    // 6) troca a primária pra segunda
    admSetPrimaria(U_UB);
    r.trocou_primaria = admState.unidPrimaria === U_UB;

    // 7) salva -> body com as 2 unidades e UMA primária
    await admUnidadeSalvar();
    const body = puts[puts.length - 1];
    r.put_final = JSON.stringify(body);
    r.tem_2_unidades = body.unidades.length === 2;
    r.uma_primaria = body.primaria === U_UB;

    // 8) desmarcar a primária promove outra automaticamente (nunca fica órfã)
    await admEditarUnidadesUser('u1'); // reabre limpo (u1 ainda sem unidade no mock)
    admToggleUnidade(U_IT, true);
    admToggleUnidade(U_UB, true);
    admSetPrimaria(U_UB);
    admToggleUnidade(U_UB, false); // tira a que era primária
    r.promoveu_outra = admState.unidPrimaria === U_IT;

    // 9) forçar o guard: unidade marcada mas primária nula não pode sair
    admState.unidSel = new Set([U_IT]);
    admState.unidPrimaria = null;
    const antes = puts.length;
    await admUnidadeSalvar();
    r.barrou_sem_primaria = puts.length === antes;
    r.erro_visivel = document.getElementById('adm-unid-erro').style.display === 'block';

    // 10) unidade INATIVA ainda vinculada (u3): tem que aparecer (senão trava), com botão de primária
    //     desabilitado, e o save NÃO pode reenviá-la.
    await admEditarUnidadesUser('u3');
    const wrapHtml = document.getElementById('adm-unid-wrap').innerHTML;
    r.inativa_linhas = document.querySelectorAll('#adm-unid-wrap .adm-unid-row').length; // 3 = Ituiutaba, Uberlândia, Antiga
    r.inativa_aparece = /Unidade Antiga/.test(wrapHtml) && /inativa/i.test(wrapHtml);
    const rowMorta = [...document.querySelectorAll('#adm-unid-wrap .adm-unid-row')].find(el => /Unidade Antiga/.test(el.textContent));
    r.inativa_primaria_travada = !!rowMorta && rowMorta.querySelector('.adm-unid-prim-btn').disabled === true;
    admToggleUnidade('unit-morta', false); // admin limpa o vínculo morto
    await admUnidadeSalvar();
    const bodyU3 = puts[puts.length - 1];
    r.inativa_fora_do_put = !bodyU3.unidades.includes('unit-morta');
    r.inativa_put_ok = bodyU3.unidades.includes(U_IT) && bodyU3.primaria === U_IT;

    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- card ---');
  ok('avisa quem está sem unidade', out.card_avisa_sem_unidade);
  ok('mostra a primária de quem tem', out.card_mostra_primaria);
  ok('tem botão Unidades', out.card_tem_botao_unidades);
  console.log('\n--- modal ---');
  ok('abre', out.modal_abriu);
  ok('lista as 2 unidades ativas', out.opcoes === 2, String(out.opcoes));
  console.log('\n--- regras da primária ---');
  ok('1ª unidade marcada vira primária sozinha', out.auto_primaria);
  ok('marcar a 2ª não rouba a primária', out.primaria_estavel);
  ok('dá pra trocar a primária', out.trocou_primaria);
  ok('desmarcar a primária promove outra', out.promoveu_outra);
  console.log('\n--- salvar ---');
  ok('salvar sem unidade manda vazio+null', /"unidades":\[\],"primaria":null/.test(out.put_vazio), out.put_vazio);
  ok('salva as 2 unidades', out.tem_2_unidades, out.put_final);
  ok('sai exatamente UMA primária', out.uma_primaria, out.put_final);
  ok('barra salvar com unidade e sem primária', out.barrou_sem_primaria && out.erro_visivel);
  console.log('\n--- unidade inativa ainda vinculada (não pode travar o modal) ---');
  ok('inativa aparece na lista com tag', out.inativa_aparece, String(out.inativa_linhas) + ' linhas');
  ok('botão de primária da inativa fica travado', out.inativa_primaria_travada);
  ok('desmarcar a inativa e salvar não a reenvia', out.inativa_fora_do_put, out.inativa_put_ok ? '' : 'primária/vinculo errado');
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  const tudoOk = out.card_avisa_sem_unidade && out.tem_2_unidades && out.uma_primaria && out.barrou_sem_primaria && out.inativa_aparece && out.inativa_primaria_travada && out.inativa_fora_do_put && out.inativa_put_ok && !errs.length;
  await b.close();
  process.exit(tudoOk ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
