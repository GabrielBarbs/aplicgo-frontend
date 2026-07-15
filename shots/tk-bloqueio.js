// Agenda bloqueada -> não recebe tarefa. Prova: o seletor marca e desabilita quem está bloqueado
// no prazo escolhido, o erro do backend chega legível, e a tarefa automática aparece com o selo.
// Roda de total/ com o arquivo servido: node shots/tk-bloqueio.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8130';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 900, height: 900 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const toasts = [];
    window.homeToast = (m) => toasts.push(m);
    window.homeTarefasSync = async () => {};
    window.pacApi = async (path, opts) => {
      if (path.includes('/tarefas/bloqueios')) {
        const dia = new URL('http://x' + path).searchParams.get('dia');
        // Ana (u2) está de férias em 20/07; ninguém mais.
        return { ok: true, data: { ok: true, dia, bloqueios: dia === '2026-07-20' ? { u2: 'Férias' } : {} } };
      }
      if (path.includes('/mentions/usuarios')) {
        return { ok: true, data: { usuarios: [{ id: 'u1', nome: 'Matheus' }, { id: 'u2', nome: 'Ana', cargo: 'Nutri' }, { id: 'u3', nome: 'Bia' }] } };
      }
      if (opts && opts.method === 'POST' && path.endsWith('/tarefas')) {
        const body = JSON.parse(opts.body);
        if (body.donoId === 'u2' && body.prazo === '2026-07-20') {
          return { ok: false, data: { ok: false, erro: 'Ana está com a agenda bloqueada em 20/07/2026 (Férias). Escolha outro responsável ou outro prazo.' } };
        }
        return { ok: true, data: { ok: true, delegada: true } };
      }
      return { ok: true, data: { ok: true } };
    };
    authUser = { id: 'u1', role: 'gestor' };
    meData = { permissoes: [] };
    document.getElementById('auth-overlay').style.display = 'none';

    const r = {};
    // abre o form de nova tarefa com 2 colegas
    homeTkNovaOrigem = 'modal';
    await homeTarefaNova();
    const sel = () => document.getElementById('tk-dono');
    r.tem_form = !!sel();

    // prazo num dia SEM bloqueio: ninguém marcado
    document.getElementById('tk-prazo').value = '2026-07-21';
    await homeTkBloqueios();
    r.dia_livre = [...sel().options].map((o) => o.textContent.trim() + (o.disabled ? ' [OFF]' : ''));

    // prazo no dia das férias da Ana
    document.getElementById('tk-prazo').value = '2026-07-20';
    await homeTkBloqueios();
    r.dia_bloq = [...sel().options].map((o) => o.textContent.trim() + (o.disabled ? ' [OFF]' : ''));
    r.ana_desabilitada = [...sel().options].find((o) => o.value === 'u2').disabled;
    r.bia_ok = [...sel().options].find((o) => o.value === 'u3').disabled === false;

    // seleciona a Ana -> aviso aparece
    sel().value = 'u2';
    homeTkBloqAviso();
    r.aviso = (document.getElementById('tk-bloq-aviso').innerText || '').trim();

    // tenta salvar mesmo assim (API direta / option forçada): o erro REAL tem que aparecer
    document.getElementById('tk-titulo').value = 'ligar pra paciente';
    toasts.length = 0;
    await homeTarefaSalvar(null);
    r.toast_erro = toasts.join(' | ');

    // troca pra Bia -> salva
    sel().value = 'u3';
    homeTkBloqAviso();
    r.aviso_bia = (document.getElementById('tk-bloq-aviso').innerText || '').trim();
    toasts.length = 0;
    await homeTarefaSalvar(null);
    r.toast_ok = toasts.join(' | ');

    // selo na lista: tarefa AUTOMÁTICA criada pra quem está bloqueado
    r.badge_bloq = homeTarefaBadge({ status: 'aberta', prazo_dias: 3, dono_bloqueado: 'Férias', de_rotina: true }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    r.badge_normal = homeTarefaBadge({ status: 'aberta', prazo_dias: 3, dono_bloqueado: null }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- seletor de responsável ---');
  console.log('  dia livre :', out.dia_livre.join(' | '));
  console.log('  dia férias:', out.dia_bloq.join(' | '));
  ok('Ana aparece BLOQUEADA e não pode ser escolhida', out.ana_desabilitada && out.dia_bloq.some((x) => /Ana.*BLOQUEADO \(Férias\)/.test(x)));
  ok('quem não está de férias segue normal', out.bia_ok && out.dia_bloq.some((x) => /^Bia$/.test(x)));
  ok('no dia sem bloqueio, ninguém é marcado', !out.dia_livre.some((x) => /BLOQUEADO|OFF/.test(x)));
  console.log('\n--- aviso ---');
  ok('aviso aparece pra pessoa bloqueada', /Agenda bloqueada nesse dia \(Férias\)/.test(out.aviso), out.aviso);
  ok('aviso some pra quem está livre', out.aviso_bia === '', JSON.stringify(out.aviso_bia));
  console.log('\n--- salvar ---');
  ok('erro do backend chega LEGÍVEL (não o toast genérico)', /agenda bloqueada em 20\/07\/2026 \(Férias\)/.test(out.toast_erro), out.toast_erro);
  ok('com pessoa livre, cria', /Tarefa criada/.test(out.toast_ok), out.toast_ok);
  console.log('\n--- selo na lista (tarefa automática de rotina) ---');
  ok('tarefa de quem está bloqueado ganha selo', /agenda bloqueada/.test(out.badge_bloq), out.badge_bloq);
  ok('tarefa normal não ganha selo', !/agenda bloqueada/.test(out.badge_normal), out.badge_normal);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
