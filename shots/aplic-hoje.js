// Card "Aplicações hoje" (enfermagem): aparece só pra quem aplica, mostra a contagem, e ao clicar
// abre o que separar (consolidado por injetável) + quais são as aplicações do dia.
// Roda de total/ com o arquivo servido: node shots/aplic-hoje.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const OUT = 'C:\\Users\\gabri\\Downloads\\total\\shots\\';
const PORT = process.argv[2] || '8130';

const DADOS = {
  ok: true, dia: '2026-07-14', total: 3,
  aplicacoes: [
    { appointment_id: 'a1', hora: '09:00', status: 'CONFIRMADO', patient_id: 'p1', paciente: 'Maria Silva', paciente_codigo: 'AP0042', unidade: 'Aplic Ituiutaba', profissional: 'Enf. Bia', semana: 3,
      itens: [{ sku: 'TIRZ', produto: 'Tirzepatida', apresentacao: 'Caneta 2,5mg', dose: '2,5 mg', via: 'SC', observacao: 'aplicar no abdômen', aplicado: false }] },
    { appointment_id: 'a2', hora: '10:30', status: 'AGENDADO', patient_id: 'p2', paciente: 'João Souza', paciente_codigo: 'AP0107', unidade: 'Aplic Ituiutaba', profissional: 'Enf. Bia', semana: 1,
      itens: [
        { sku: 'TIRZ', produto: 'Tirzepatida', apresentacao: 'Caneta 2,5mg', dose: '5 mg', via: 'SC', observacao: null, aplicado: false },
        { sku: 'VITD', produto: 'Vitamina D injetável', apresentacao: 'Ampola 600.000UI', dose: '1 ampola', via: 'IM', observacao: null, aplicado: false },
      ] },
    { appointment_id: 'a3', hora: '14:00', status: 'AGENDADO', patient_id: 'p3', paciente: 'Ana Paula Rodrigues', paciente_codigo: 'AP0233', unidade: 'Aplic Uberlândia', profissional: 'Enf. Carla', semana: 2,
      itens: [{ sku: 'TIRZ', produto: 'Tirzepatida', apresentacao: 'Caneta 2,5mg', dose: '2,5 mg', via: 'SC', observacao: null, aplicado: true }] },
  ],
  insumos: [
    { sku: 'TIRZ', produto: 'Tirzepatida', apresentacao: 'Caneta 2,5mg', unidade_estoque: 'caneta', aplicacoes: 3, doses: [{ dose: '2,5 mg', n: 1 }, { dose: '5 mg', n: 1 }], sem_dose: 1 },
    { sku: 'VITD', produto: 'Vitamina D injetável', apresentacao: 'Ampola 600.000UI', unidade_estoque: 'ampola', aplicacoes: 1, doses: [{ dose: '1 ampola', n: 1 }], sem_dose: 0 },
  ],
};

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'], defaultViewport: { width: 1100, height: 1000, deviceScaleFactor: 2 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 180)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async (DADOS) => {
    let chamou = null;
    window.pacApi = async (path) => {
      if (path.includes('/aplicacoes-hoje')) { chamou = path; return { ok: true, data: DADOS }; }
      return { ok: true, data: { ok: true } };
    };
    document.getElementById('auth-overlay').style.display = 'none';
    const r = {};

    // 1) quem NÃO aplica injetável não vê o card
    meData = { permissoes: ['prontuario.ver'] }; authUser = { role: 'recepcao' };
    await aplicHojeCarregar();
    r.recepcao_ve = document.getElementById('op-aplic-card').style.display !== 'none';

    // 2) enfermagem vê
    meData = { permissoes: ['prontuario.aplicacao.registrar'] }; authUser = { role: 'enfermagem' };
    await aplicHojeCarregar();
    r.enfermagem_ve = document.getElementById('op-aplic-card').style.display !== 'none';
    r.val = document.getElementById('op-aplic-val').textContent;
    r.ext = document.getElementById('op-aplic-ext').textContent;
    r.chamou = chamou;

    // 3) clicar abre o detalhe
    aplicHojeAbrir();
    const modal = document.querySelector('.atn-modal');
    r.modal_txt = (modal ? modal.innerText : '').replace(/\s+/g, ' ').trim();

    // 4) erro != "dia livre"
    window.pacApi = async () => ({ ok: false, data: {} });
    await aplicHojeCarregar();
    r.erro_val = document.getElementById('op-aplic-val').textContent;
    r.erro_ext = document.getElementById('op-aplic-ext').textContent;

    // 5) dia sem aplicação
    window.pacApi = async () => ({ ok: true, data: { ok: true, dia: '2026-07-14', total: 0, aplicacoes: [], insumos: [] } });
    await aplicHojeCarregar();
    r.zero_val = document.getElementById('op-aplic-val').textContent;
    r.zero_ext = document.getElementById('op-aplic-ext').textContent;
    return r;
  }, DADOS);

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- gate por cargo ---');
  ok('recepção NÃO vê o card', !out.recepcao_ve);
  ok('enfermagem vê o card', out.enfermagem_ve);
  console.log('\n--- card ---');
  ok('mostra a quantidade (3)', out.val === '3', out.val);
  ok('subtítulo com aplicações e injetáveis', /3 aplicações · 2 injetáveis/.test(out.ext), out.ext);
  console.log('\n--- detalhe ao clicar ---');
  ok('mostra O QUE SEPARAR (consolidado)', /o que separar hoje/i.test(out.modal_txt));
  ok('Tirzepatida aparece 3× (total do dia)', /3× Tirzepatida/.test(out.modal_txt));
  ok('cada dose com a SUA contagem (não uma lista solta)', /2,5 mg ×1/.test(out.modal_txt) && /5 mg ×1/.test(out.modal_txt), out.modal_txt.slice(0,0));
  ok('as sem dose aparecem, não somem', /1 sem dose registrada/.test(out.modal_txt));
  ok('Vitamina D aparece 1×', /1× Vitamina D injetável/.test(out.modal_txt));
  ok('lista QUAIS SÃO as aplicações', /aplicações do dia/i.test(out.modal_txt));
  ok('mostra paciente e hora', /09:00/.test(out.modal_txt) && /Maria Silva/.test(out.modal_txt));
  ok('mostra a observação clínica', /aplicar no abdômen/.test(out.modal_txt));
  console.log('\n--- honestidade ---');
  ok('erro NÃO vira "dia livre"', out.erro_val === '—' && /não consegui carregar/.test(out.erro_ext), out.erro_val + ' / ' + out.erro_ext);
  ok('dia sem aplicação diz isso', out.zero_val === '0' && /nenhuma aplicação hoje/.test(out.zero_ext), out.zero_val + ' / ' + out.zero_ext);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');

  // screenshots
  await p.evaluate(async (DADOS) => {
    window.pacApi = async () => ({ ok: true, data: DADOS });
    meData = { permissoes: ['prontuario.aplicacao.registrar'] }; authUser = { role: 'enfermagem' };
    await aplicHojeCarregar();
  }, DADOS);
  const card = await p.$('#op-aplic-card');
  if (card) await card.screenshot({ path: OUT + 'aplic_card.png' });
  await p.evaluate(() => aplicHojeAbrir());
  await new Promise((r) => setTimeout(r, 400));
  const modal = await p.$('.atn-modal');
  if (modal) await modal.screenshot({ path: OUT + 'aplic_detalhe.png' });
  console.log('shots: aplic_card.png + aplic_detalhe.png');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
