// ============================================================
// Página pública "Receita Digital" — JS externo (CSP sem 'unsafe-inline'
// em script-src: nenhum script/handler inline nesta página).
// ============================================================
const API_BASE = 'https://srv.aplicgo.com';
const TIPO = { BRANCA_COMUM: 'Receituário Simples', BRANCA_CONTROLADA: 'Receituário de Controle Especial', AZUL_CONTROLADA: 'Receituário B (Azul)', ATESTADO: 'Atestado' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDataHora = (iso) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return esc(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const fmtData = (iso) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleDateString('pt-BR'); };

function getToken() {
  const u = new URLSearchParams(location.search);
  return u.get('t') || u.get('token') || u.get('c') || location.hash.replace(/^#\/?/, '') || '';
}

function headerHtml() {
  return `<div class="head">
    <div class="logo"><img src="logo.png" alt=""></div>
    <div><div class="nm">Aplic &amp; Go</div><div class="sb">Emagrecimento · Performance · Longevidade</div></div>
  </div>`;
}

function emptyCard(cls, icon, titulo, desc, comBusca) {
  return `<div class="card">${headerHtml()}
    <div class="empty ${cls}">
      <div class="ei"><i class="ti ${icon}"></i></div>
      <h2>${titulo}</h2><p>${desc}</p>
      ${comBusca ? `<form class="keyform" id="keyform">
        <input id="chave" maxlength="6" placeholder="Chave de acesso" autocomplete="off">
        <button type="submit">Abrir</button>
      </form>` : ''}
    </div>
  </div>`;
}

// Delegação de eventos (sem handlers inline, por causa do CSP):
// - clique nos acordeões (botões [data-acc])
// - submit do formulário de chave
// - fallback do logo (evento error não borbulha -> captura)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-acc]');
  if (btn) {
    const acc = document.getElementById(btn.getAttribute('data-acc'));
    if (acc) acc.classList.toggle('open');
  }
});
document.addEventListener('submit', (e) => {
  if (e.target && e.target.id === 'keyform') {
    e.preventDefault();
    const v = (document.getElementById('chave').value || '').trim().toUpperCase();
    if (v) location.href = location.pathname + '?t=' + encodeURIComponent(v);
  }
});
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && el.closest('.logo')) {
    const i = document.createElement('i'); i.className = 'ti ti-heartbeat';
    el.replaceWith(i);
  }
}, true);

function render(r) {
  const alvo = document.getElementById('alvo');
  if (!r || !r.ok) { alvo.innerHTML = emptyCard('neutro', 'ti-cloud-off', 'Não foi possível verificar', 'Tente novamente em instantes.', false); return; }
  if (!r.encontrada) { alvo.innerHTML = emptyCard('neutro', 'ti-search-off', 'Receita não encontrada', 'Confira o código ou digite a chave de acesso impressa na receita.', true); return; }

  const c = r.conteudo || {};
  const sig = r.assinatura || {};
  const integro = r.hash_confere;
  const val = r.validade || {};
  const ehAtestado = c.tipo === 'ATESTADO';

  // Chip de autenticidade (canto do título)
  let chip;
  if (!integro) chip = `<span class="chip bad"><i class="ti ti-alert-triangle"></i> Adulterada</span>`;
  else if (sig.icp) chip = `<span class="chip ok"><i class="ti ti-rosette-discount-check"></i> Assinada ICP-Brasil</span>`;
  else if (sig.valida) chip = `<span class="chip ok"><i class="ti ti-shield-check"></i> Autêntica</span>`;
  else chip = `<span class="chip warn"><i class="ti ti-shield-half"></i> Íntegra</span>`;

  // Receituário — agrupa por via ("USO ORAL", "USO ORAL MANIPULADO"…) como na
  // receita impressa. Atestado sai flat (via não se aplica — espelha o PDF).
  const grupos = [];
  if (ehAtestado) {
    grupos.push({ via: null, itens: c.itens || [] });
  } else {
    (c.itens || []).forEach((i) => {
      const via = (i.via || '').trim().toUpperCase() || null;
      const g = grupos.find((x) => x.via === via);
      if (g) g.itens.push(i); else grupos.push({ via, itens: [i] });
    });
  }
  const temVia = grupos.some((g) => g.via);
  const uso = (ehAtestado || temVia) ? '' : `<span class="u">CONFORME PRESCRITO</span>`;
  const medHtml = (i, n) => `
    <div class="med">
      <div class="n">${n + 1}</div>
      <div class="c">
        <div class="nome">${esc(i.medicamento)}${i.dose ? ' — ' + esc(i.dose) : ''}</div>
        ${(i.frequencia || i.duracao) ? `<div class="pos">${[i.frequencia, i.duracao].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
        ${i.observacoes ? `<div class="obs">${esc(i.observacoes)}</div>` : ''}
      </div>
    </div>`;
  // Prescrição em texto livre: impressa como escrita, com as linhas "USO…" em destaque
  // Linha de via = CAIXA ALTA começando com USO (ou MANIPULADO sozinho) — igual
  // ao PDF. "Uso: 1x/dia" e "Uso em clínica…" (caixa mista) não são via.
  const ehLinhaVia = (t) => t === t.toUpperCase() && (/^\s*USO\b/.test(t) || /^\s*MANIPULADO\s*$/.test(t));
  const textoLivre = (c.texto && String(c.texto).trim())
    ? `<div class="texto-livre">${String(c.texto).replace(/\r\n/g, '\n').split('\n').map((ln) => {
        const t = ln.trimEnd();
        if (!t.trim()) return '<div class="tl-br"></div>';
        return ehLinhaVia(t) ? `<div class="via-h">${esc(t)}</div>` : `<div class="tl-ln">${esc(t)}</div>`;
      }).join('')}</div>`
    : '';
  const itensHtml = grupos.map((g) => `
    ${g.via ? `<div class="via-h">${esc(g.via)}</div>` : ''}
    ${g.itens.map(medHtml).join('')}`).join('');
  const itens = (textoLivre + itensHtml) || `<div class="med"><div class="c"><div class="pos">Sem itens.</div></div></div>`;

  // Área da farmácia — validade
  let validEl;
  if (val.valida_ate == null) {
    validEl = `<div class="valid ok"><div class="vi"><i class="ti ti-file-check"></i></div><div><div class="vt">Documento válido</div><div class="vd">Sem prazo de dispensação aplicável.</div></div></div>`;
  } else if (val.expirada) {
    validEl = `<div class="valid exp"><div class="vi"><i class="ti ti-clock-x"></i></div><div><div class="vt">Receita expirada</div><div class="vd">Validade para dispensação: ${val.dias} dias · venceu em ${fmtData(val.valida_ate)}.</div></div></div>`;
  } else {
    validEl = `<div class="valid ok"><div class="vi"><i class="ti ti-clock-check"></i></div><div><div class="vt">Receita válida</div><div class="vd">Válida para dispensação até ${fmtData(val.valida_ate)} (${val.dias} dias).</div></div></div>`;
  }

  // Linha de assinatura (honesta)
  let sigEl;
  if (!integro) {
    sigEl = `<div class="siginfo bad"><i class="ti ti-x"></i><div>Verificação de integridade <b>falhou</b>. O conteúdo não confere com o registro original — <b>não dispense</b>.</div></div>`;
  } else if (sig.icp) {
    sigEl = `<div class="siginfo ok"><i class="ti ti-certificate-2"></i><div>Assinada digitalmente em <b>ICP-Brasil</b>${sig.icp_assinante ? ' por <b>' + esc(sig.icp_assinante) + '</b>' : ''}. Baixe o PDF e valide também em <b>validar.iti.gov.br</b>.</div></div>`;
  } else if (sig.valida) {
    sigEl = `<div class="siginfo ok"><i class="ti ti-shield-check"></i><div>Conteúdo íntegro e com <b>assinatura digital Aplic</b> (Ed25519) verificada.</div></div>`;
  } else {
    sigEl = `<div class="siginfo warn"><i class="ti ti-shield-half"></i><div>Conteúdo íntegro, mas <b>sem assinatura criptográfica</b>. Para medicamentos controlados, exija assinatura ICP-Brasil.</div></div>`;
  }

  const dlUrl = API_BASE + (r.pdf_url || ('/api/verificar/' + encodeURIComponent(r.token) + '/receita.pdf'));

  alvo.innerHTML = `
    <div class="card">
      ${headerHtml()}
      <div class="body">
        <div class="titrow"><h1>${ehAtestado ? 'Atestado Digital' : 'Receita Digital'}</h1>${chip}</div>

        <div class="grid2">
          <div class="fld"><div class="k">Código ${ehAtestado ? 'do documento' : 'da receita'}</div><div class="v mono">${esc(r.chave || '—')}</div></div>
          <div class="fld"><div class="k">Data</div><div class="v">${fmtDataHora(c.data || r.criado_em)}</div></div>
        </div>

        <div class="acc" id="accPac">
          <button type="button" data-acc="accPac">
            <span class="ico"><i class="ti ti-user"></i></span>
            <span class="lbl"><span class="k">Paciente</span><span class="v">${esc(c.paciente && c.paciente.nome || '—')}</span></span>
            <i class="ti ti-chevron-down caret"></i>
          </button>
          <div class="det"><div class="in">
            <div class="row"><span class="rk">Nome</span><span class="rv">${esc(c.paciente && c.paciente.nome || '—')}</span></div>
            ${c.paciente && c.paciente.codigo ? `<div class="row"><span class="rk">Código do paciente</span><span class="rv">${esc(c.paciente.codigo)}</span></div>` : ''}
          </div></div>
        </div>

        <div class="acc" id="accProf">
          <button type="button" data-acc="accProf">
            <span class="ico"><i class="ti ti-stethoscope"></i></span>
            <span class="lbl"><span class="k">Profissional</span><span class="v">${esc(c.profissional && c.profissional.nome || r.assinante || '—')}${r.crm ? ' (' + esc(r.crm) + ')' : ''}</span></span>
            <i class="ti ti-chevron-down caret"></i>
          </button>
          <div class="det"><div class="in">
            <div class="row"><span class="rk">Nome</span><span class="rv">${esc(c.profissional && c.profissional.nome || '—')}</span></div>
            ${r.crm ? `<div class="row"><span class="rk">Registro</span><span class="rv">${esc(r.crm)}</span></div>` : ''}
            ${sig.icp_em ? `<div class="row"><span class="rk">Assinado em</span><span class="rv">${fmtDataHora(sig.icp_em)}</span></div>` : ''}
            ${r.clinica && r.clinica.cnpj ? `<div class="row"><span class="rk">CNPJ</span><span class="rv">${esc(r.clinica.cnpj)}</span></div>` : ''}
          </div></div>
        </div>

        <div class="rx">
          <div class="cab"><span class="t">${esc(TIPO[c.tipo] || 'Receituário')}</span>${uso}</div>
          ${itens}
        </div>

        ${c.observacoes ? `<div class="obs-box"><div class="k">Observações</div>${esc(c.observacoes)}</div>` : ''}

        <div class="farm">
          <div class="fh"><i class="ti ti-building-store"></i> Área da farmácia</div>
          <div class="fb">
            ${validEl}
            ${sigEl}
            <a class="btn-dl" href="${dlUrl}" target="_blank" rel="noopener"><i class="ti ti-download"></i> Baixar ${ehAtestado ? 'atestado' : 'receita'}</a>
          </div>
        </div>

        <div class="hash">Verificação de integridade (SHA-256):<br>${esc(r.hash || '—')}</div>
      </div>
    </div>`;

  // Abre o paciente por padrão (como no print)
  const ap = document.getElementById('accPac'); if (ap) ap.classList.add('open');
}

(async () => {
  const token = getToken();
  if (!token) { render({ ok: true, encontrada: false }); return; }
  try {
    const resp = await fetch(API_BASE + '/api/verificar/' + encodeURIComponent(token), { headers: { 'Accept': 'application/json' } });
    let data = null;
    try { data = await resp.json(); } catch (e) { data = null; }
    render(data || { ok: false });
  } catch (e) { render({ ok: false }); }
})();
