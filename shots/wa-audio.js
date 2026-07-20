// Áudio (nota de voz) no chat de WhatsApp (página Conversas): gravar -> enviar/descartar, + o botão
// WhatsApp no cabeçalho. Mocka MediaRecorder/mic/pacApi (mic real não roda headless). Verifica a
// máquina de estados e o payload que vai pro /audio. Roda de total/: node shots/wa-audio.js <porta>
const puppeteer = require('puppeteer-core');
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PORT = process.argv[2] || '8150';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1100, height: 800 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  await p.goto('http://localhost:' + PORT + '/clinico.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await p.evaluate(async () => {
    const r = {};
    const JID = '553499990000@s.whatsapp.net';
    const posts = [];
    let opened = null;
    window.open = (u) => { opened = u; return null; };
    window.homeToast = () => {};
    window.pacApi = async (url, opts) => {
      if (/\/audio$/.test(url) && opts && opts.method === 'POST') { posts.push(Object.assign({ _url: url }, JSON.parse(opts.body))); return { ok: true, data: { ok: true, mensagem: { id: 'AUD1', de_mim: true, tipo: 'audio', mime: 'audio/webm', texto: '🎤 Áudio', data: new Date().toISOString() } } }; }
      return { ok: true, data: { ok: true } };
    };
    // ---- mock do microfone + MediaRecorder ----
    class FakeRec {
      constructor(stream, opts) { this.stream = stream; this.mimeType = (opts && opts.mimeType) || 'audio/webm'; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; if (this.ondataavailable) this.ondataavailable({ data: new Blob([new Uint8Array(4000)], { type: this.mimeType }) }); if (this.onstop) this.onstop(); }
    }
    FakeRec.isTypeSupported = () => true;
    window.MediaRecorder = FakeRec;
    let micNegar = false;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { if (micNegar) throw new Error('denied'); return { getTracks: () => [{ stop() {} }] }; } } });

    document.getElementById('auth-overlay').style.display = 'none';
    // estado da conversa aberta
    wvState.jid = JID;
    wvState.contato = { nome: 'Paciente Teste', telefone: '553499990000', paciente_id: null };
    wvState.msgs = []; wvState.chats = [{ id: JID }]; wvState.enviando = false;

    // 1) cabeçalho tem Ligar + WhatsApp quando há telefone
    wvRenderHead();
    const head = document.getElementById('wv-head').innerHTML;
    r.head_tem_ligar = /wvLigar\(\)/.test(head);
    r.head_tem_whatsapp = /wvWaWeb\(\)/.test(head);

    // 2) começa a gravar
    await wvMicToggle();
    r.gravando = !!wvRec.rec;
    r.barra_visivel = document.getElementById('wv-rec').style.display === 'flex';
    r.composer_escondido = document.getElementById('wv-composer').style.display === 'none';

    // 3) enviar -> POST /audio com base64 + numero, some da barra, mensagem entra
    wvMicEnviar();
    await new Promise((x) => setTimeout(x, 150)); // espera o onstop async (FileReader + pacApi)
    r.qtd_posts = posts.length;
    const body = posts[0] || {};
    r.tem_base64 = !!(body.base64 && body.base64.length > 20);
    r.tem_numero = body.numero === '553499990000';
    r.tem_mime = /audio\//.test(body.mimetype || '');
    r.msg_entrou = (wvState.msgs || []).some(m => m.tipo === 'audio');
    r.barra_sumiu = document.getElementById('wv-rec').style.display === 'none';
    r.composer_voltou = document.getElementById('wv-composer').style.display !== 'none';
    r.enviando_zerou = wvState.enviando === false;
    r.rec_limpo = wvRec.rec === null;

    // 4) descartar NÃO manda POST
    const antes = posts.length;
    await wvMicToggle();
    wvMicCancelar();
    await new Promise((x) => setTimeout(x, 120));
    r.cancelar_sem_post = posts.length === antes;
    r.cancelar_limpou = wvRec.rec === null && document.getElementById('wv-rec').style.display === 'none';

    // 5) mic negado avisa e não trava
    micNegar = true;
    let quebrou = false;
    try { await wvMicToggle(); } catch (e) { quebrou = true; }
    r.mic_negado_ok = !quebrou && wvRec.rec === null;
    micNegar = false;

    // 6) botão WhatsApp abre wa.me
    wvWaWeb();
    r.wa_abriu = /wa\.me\/553499990000/.test(opened || '');

    // 7) DESTINO fixado no início: grava em A, o jid muda por baixo (corrida), envia -> vai pra A
    posts.length = 0;
    wvState.jid = JID; wvState.contato = { telefone: '553499990000' }; wvState.msgs = [];
    await wvMicToggle();
    r.rec_jid_capturado = wvRec.jid === JID;
    wvState.jid = '551188887777@s.whatsapp.net'; wvState.contato = { telefone: '551188887777' }; // trocou depois do start
    wvMicEnviar();
    await new Promise((x) => setTimeout(x, 150));
    const u = (posts[0] && posts[0]._url) || '';
    r.audio_foi_pra_origem = u.indexOf(encodeURIComponent(JID)) !== -1;
    r.audio_nao_foi_pro_novo = u.indexOf('1188887777') === -1;

    // 8) trocar de conversa (wvAbrirConversa) descarta gravação em curso e restaura o composer
    wvState.jid = JID; wvState.contato = { telefone: '553499990000' };
    await wvMicToggle();
    r.gravando_antes_troca = !!wvRec.rec;
    wvAbrirConversa({ id: '551166665555@s.whatsapp.net', nome: 'Outro', numero: '551166665555' });
    await new Promise((x) => setTimeout(x, 80));
    r.troca_cancelou = wvRec.rec === null && document.getElementById('wv-rec').style.display === 'none' && document.getElementById('wv-composer').style.display !== 'none';

    return r;
  });

  const ok = (n, c, e = '') => console.log((c ? '  OK   ' : '  FALHA') + ' ' + n + (e ? ' -> ' + e : ''));
  console.log('--- cabeçalho ---');
  ok('botão Ligar presente', out.head_tem_ligar);
  ok('botão WhatsApp presente (novo)', out.head_tem_whatsapp);
  console.log('\n--- gravar ---');
  ok('inicia gravação', out.gravando);
  ok('mostra a barra de gravação', out.barra_visivel);
  ok('esconde o composer', out.composer_escondido);
  console.log('\n--- enviar ---');
  ok('manda 1 POST /audio', out.qtd_posts === 1, String(out.qtd_posts));
  ok('payload tem base64', out.tem_base64);
  ok('payload tem o número real', out.tem_numero);
  ok('payload tem o mimetype', out.tem_mime);
  ok('mensagem de áudio entra na thread', out.msg_entrou);
  ok('barra some e composer volta', out.barra_sumiu && out.composer_voltou);
  ok('enviando volta a false / rec limpo', out.enviando_zerou && out.rec_limpo);
  console.log('\n--- descartar ---');
  ok('cancelar não manda POST', out.cancelar_sem_post);
  ok('cancelar limpa o estado', out.cancelar_limpou);
  console.log('\n--- robustez ---');
  ok('mic negado avisa e não trava', out.mic_negado_ok);
  ok('botão WhatsApp abre wa.me', out.wa_abriu);
  console.log('\n--- destino fixado (bug do review) ---');
  ok('jid capturado no início da gravação', out.rec_jid_capturado);
  ok('áudio vai pro contato de ORIGEM mesmo trocando jid', out.audio_foi_pra_origem);
  ok('áudio NÃO vaza pro contato novo', out.audio_nao_foi_pro_novo);
  ok('trocar de conversa descarta a gravação e restaura o composer', out.troca_cancelou, 'gravando antes: ' + out.gravando_antes_troca);
  console.log('\nERROS:', errs.length ? errs.join(' | ') : '(nenhum)');
  const tudo = out.head_tem_ligar && out.head_tem_whatsapp && out.gravando && out.qtd_posts === 1 && out.tem_base64 && out.tem_numero && out.msg_entrou && out.barra_sumiu && out.cancelar_sem_post && out.mic_negado_ok && out.wa_abriu
    && out.rec_jid_capturado && out.audio_foi_pra_origem && out.audio_nao_foi_pro_novo && out.troca_cancelou && !errs.length;
  await b.close();
  process.exit(tudo ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
