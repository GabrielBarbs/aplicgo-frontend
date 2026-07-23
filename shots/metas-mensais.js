// Metas mensais: card do header abre modal com metas por mês; qualquer um marca; pontuação 0-10 = feitas/total*10.
// Roda de total/: node shots/metas-mensais.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8195';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1000, height: 1000 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  const out = await p.evaluate(async () => {
    const r = {};
    window.homeToast = () => {};
    prState.pacienteAtual = { id: 'p1', nome: 'Paciente Teste' };
    const mesAtual = new Date(Date.now() - 180 * 60000).toISOString().slice(0, 7);
    const mesAnt = (() => { const [y, m] = mesAtual.split('-').map(Number); return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); })();

    // A) card no header aparece com a pontuação, clicável
    prState.headerData = { nome_completo: 'Paciente Teste', status: 'ATIVO', metas_mes: { mes: mesAtual, feitas: 1, total: 2, score: 5 } };
    let hHtml = '';
    try { hHtml = prRenderHeaderRico(); } catch (e) { r.erro_header = e.message; }
    r.card_no_header = /Metas do mês/.test(hHtml) && /5\/10/.test(hHtml) && /prAbrirMetasMes\(\)/.test(hHtml) && /pr-h2-bloco metas/.test(hHtml);
    // insere o header no DOM (como o app faz) pra o card poder ser atualizado in-place
    const hCont = document.createElement('div'); hCont.innerHTML = hHtml; document.body.appendChild(hCont);

    // backend mockado: 2 metas no mês atual (1 feita), 1 no mês anterior (feita)
    let metasDB = [
      { id: 'm1', mes: mesAtual, descricao: 'Beber 2L de água', concluida: true, concluida_por: 'Ana' },
      { id: 'm2', mes: mesAtual, descricao: 'Caminhar 3x', concluida: false, concluida_por: null },
      { id: 'm3', mes: mesAnt, descricao: 'Meta antiga', concluida: true, concluida_por: 'Bia' },
    ];
    let toggled = null, created = null, deleted = null;
    window.pacApi = async (url, opts) => {
      if (/\/metas-mes$/.test(url) && (!opts || opts.method === undefined)) return { ok: true, data: { metas: metasDB } };  // GET
      if (/\/metas-mes$/.test(url) && opts && opts.method === 'POST') { const bdy = JSON.parse(opts.body); created = bdy; const nm = { id: 'mnew', mes: bdy.mes, descricao: bdy.descricao, concluida: false }; metasDB.push({ ...nm, concluida_por: null }); return { ok: true, data: { meta: nm } }; }
      if (/\/metas-mes\/m2$/.test(url) && opts && opts.method === 'PATCH') { toggled = JSON.parse(opts.body); return { ok: true, data: {} }; }
      if (/\/metas-mes\/m1$/.test(url) && opts && opts.method === 'DELETE') { deleted = 'm1'; return { ok: true, data: {} }; }
      return { ok: true, data: {} };
    };

    // B) abre o modal + renderiza o mês atual
    await prAbrirMetasMes();
    await new Promise(x => setTimeout(x, 50));
    const body = document.getElementById('pr-metas-body');
    r.modal_abriu = !!document.getElementById('pr-metas-modal') && !!body;
    r.mostra_score_5 = /class="sc-num">5</.test(body.innerHTML);
    r.mostra_2_metas = [...body.querySelectorAll('.meta-item')].length === 2 && /Beber 2L/.test(body.textContent) && /Caminhar/.test(body.textContent);
    r.meta_feita_riscada = !!body.querySelector('.meta-item.feita');

    // C) navegar pro mês anterior -> 1 meta, score 10
    prMetasNav(-1);
    r.nav_mes_ant = /class="sc-num">10</.test(document.getElementById('pr-metas-body').innerHTML) && /Meta antiga/.test(document.getElementById('pr-metas-body').textContent);
    prMetasNav(1);  // volta pro atual

    // D) marcar a 2ª meta -> PATCH {concluida:true} + score sobe pra 10
    const ck = [...document.querySelectorAll('#pr-metas-body .meta-item')].find(el => /Caminhar/.test(el.textContent)).querySelector('.mck');
    ck.checked = true; ck.dispatchEvent(new Event('change'));
    await new Promise(x => setTimeout(x, 40));
    r.toggle_chamou = toggled && toggled.concluida === true;
    r.score_virou_10 = /class="sc-num">10</.test(document.getElementById('pr-metas-body').innerHTML);
    r.header_card_atualizou = (document.querySelector('.pr-h2-bloco.metas .bl-valor') || {}).textContent === '10/10';

    // E) adicionar meta
    document.getElementById('pr-meta-nova').value = 'Dormir 8h';
    await prMetasAdd();
    await new Promise(x => setTimeout(x, 40));
    r.add_chamou = created && created.mes === mesAtual && created.descricao === 'Dormir 8h';
    r.add_apareceu = /Dormir 8h/.test(document.getElementById('pr-metas-body').textContent);

    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- card no header ---');
  ok('card "Metas do mês · 5/10" clicável', out.card_no_header, out.erro_header || '');
  console.log('--- modal ---');
  ok('modal abre + renderiza', out.modal_abriu);
  ok('mostra pontuação 5', out.mostra_score_5);
  ok('lista 2 metas do mês', out.mostra_2_metas);
  ok('meta concluída aparece riscada', out.meta_feita_riscada);
  ok('navegar mês anterior (score 10, 1 meta)', out.nav_mes_ant);
  console.log('--- ações ---');
  ok('marcar meta -> PATCH concluida:true', out.toggle_chamou);
  ok('score recalcula pra 10 na hora', out.score_virou_10);
  ok('card do header atualiza (10/10)', out.header_card_atualizou);
  ok('adicionar -> POST {mes,descricao}', out.add_chamou);
  ok('meta nova aparece na lista', out.add_apareceu);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  const tudo = out.card_no_header && out.modal_abriu && out.mostra_score_5 && out.mostra_2_metas && out.meta_feita_riscada
    && out.nav_mes_ant && out.toggle_chamou && out.score_virou_10 && out.header_card_atualizou && out.add_chamou && out.add_apareceu && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
