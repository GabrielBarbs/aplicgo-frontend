// Confere o botão "Novo agendamento" do header do prontuário: renderiza o header com a API
// stubbada, clica no botão e fotografa o modal já com o paciente preenchido.
// Roda de total/ com o arquivo servido: node shots/pr-agendar.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8120';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'], defaultViewport: { width: 1180, height: 1000, deviceScaleFactor: 2 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  await p.evaluate(() => {
    window.pacApi = async (path) => {
      if (path.includes('/appointments/types')) return { ok: true, data: { tipos: [{ id: 't1', nome: 'Consulta médica', duracao_minutos: 30 }, { id: 't2', nome: 'Nutrição', duracao_minutos: 45 }] } };
      return { ok: true, data: { agendamentos: [], blocos: [], itens: [] } };
    };
    window.pacCarregarApoio = async () => {};
    pacState.unidades = [{ id: 'u1', nome: 'Aplic Ituiutaba', primaria: true }, { id: 'u2', nome: 'Aplic Uberlândia' }];
    pacState.profissionais = [{ id: 'p1', nome: 'Matheus Severino', role: 'medico' }, { id: 'p2', nome: 'Ana Nutri', role: 'nutricionista' }];
    meData = { permissoes: ['agenda.criar', 'prontuario.ver'] };
    authUser = { role: 'medico' };
    document.getElementById('auth-overlay').style.display = 'none';
    const vw = document.getElementById('view-prontuario');
    vw.style.display = 'block'; vw.classList.add('active');
    prState.headerData = { id: 'pac-123', codigo: 'AP0042', nome_completo: 'Maria Silva', telefone1: '34999887766', status: 'ATIVO', cadastro_incompleto: false };
    const host = document.createElement('div'); host.id = 'teste-hdr';
    host.style.cssText = 'padding:20px';
    vw.appendChild(host);
    host.innerHTML = prRenderHeaderRico();
  });
  const topo = await p.$('.pr-h2-topo');
  if (topo) await topo.screenshot({ path: OUT + 'pr_botoes_header.png' });
  console.log('shot: header com os 2 botoes');

  await p.evaluate(async () => { await window.prNovoAgendamento(null); });
  await new Promise((r) => setTimeout(r, 600));
  const modal = await p.$('#ag-modal .ag-modal');
  if (modal) await modal.screenshot({ path: OUT + 'pr_modal_agendamento.png' });
  console.log('shot: modal com o paciente ja preenchido');
  console.log('ERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
