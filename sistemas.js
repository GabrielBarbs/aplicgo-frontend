/* ============================================================
   Aplic & Go — Trocador de sistema
   ------------------------------------------------------------
   A LISTA DOS SISTEMAS MORA AQUI, num lugar só. Antes ela estava
   copiada dentro de cada painel; sistema novo obrigava a lembrar de
   três arquivos e um deles sempre ficava pra trás.

   Sistema novo  = uma linha em SISTEMAS (abaixo).
   Painel novo   = incluir sistemas.css + sistemas.js, pôr o botão
                   dentro de um .sis-wrap e chamar:
                     montarTrocadorDeSistema({ atual: 'clinico' })

   LOGIN AUTOMÁTICO: todos os painéis moram no MESMO domínio e leem a
   sessão da MESMA chave de localStorage (CHAVE_SESSAO). Por isso cada
   item é um link comum — do outro lado a sessão já está gravada e o
   boot entra direto. Token NUNCA vai na URL.
   ============================================================ */
(function () {
  'use strict';

  var CHAVE_SESSAO = 'aplic_auth_token';

  // Ordem aqui = ordem no menu (o sistema atual sempre sobe pro topo).
  var SISTEMAS = [
    {
      id: 'clinico', nome: 'Sistema Clínico', sub: 'Pacientes, agenda, prontuário',
      href: '/clinico', icone: 'ti-stethoscope', cor: 'clin',
    },
    {
      id: 'comercial', nome: 'Sistema Comercial', sub: 'Vendas, Meta Ads, equipe',
      href: '/comercial', icone: 'ti-chart-line', cor: 'com',
    },
    {
      id: 'crm', nome: 'Sistema CRM', sub: 'Leads dos funis',
      href: '/crm', icone: 'ti-filter', cor: 'crm',
    },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  function temSessao() {
    try { return !!localStorage.getItem(CHAVE_SESSAO); } catch (e) { return false; }
  }

  // Sem role="menu"/"menuitem" de propósito: esse contrato promete navegação por
  // seta, que não existe aqui. Como lista de links num popover, o leitor de tela
  // anuncia "link" e o Tab + Enter funcionam de verdade.
  function linhaHtml(s, ehAtual) {
    var miolo =
      '<span class="ico ' + s.cor + '"><i class="ti ' + esc(s.icone) + '"></i></span>' +
      '<span class="txt"><b>' + esc(s.nome) + '</b><small>' +
      esc(ehAtual ? 'Você está aqui' : s.sub) + '</small></span>' +
      '<i class="ti ' + (ehAtual ? 'ti-check' : 'ti-arrow-right') + ' marca"></i>';
    return ehAtual
      ? '<div class="sis-menu-item atual" aria-current="page">' + miolo + '</div>'
      : '<a class="sis-menu-item" href="' + esc(s.href) + '">' + miolo + '</a>';
  }

  function montar(opts) {
    opts = opts || {};
    var wrap = typeof opts.wrap === 'string' ? document.querySelector(opts.wrap)
                                             : (opts.wrap || document.querySelector('.sis-wrap'));
    var botao = typeof opts.botao === 'string' ? document.querySelector(opts.botao)
                                               : (opts.botao || (wrap && wrap.querySelector('.sis-btn, button')));
    // Painel que não montou o gatilho simplesmente não ganha o menu — nunca quebra a página.
    if (!wrap || !botao) return null;
    if (wrap.querySelector('.sis-menu')) return null;   // já montado

    var atual = SISTEMAS.filter(function (s) { return s.id === opts.atual; })[0] || null;
    var outros = SISTEMAS.filter(function (s) { return s !== atual; });

    var menu = document.createElement('div');
    menu.className = 'sis-menu';
    if (botao.id) menu.setAttribute('aria-labelledby', botao.id);
    menu.innerHTML =
      '<div class="sis-menu-label">Trocar de sistema</div>' +
      (atual ? linhaHtml(atual, true) : '') +
      outros.map(function (s) { return linhaHtml(s, false); }).join('') +
      '<div class="sis-menu-foot"><i class="ti ' + (temSessao() ? 'ti-lock-open' : 'ti-lock') + '"></i> ' +
        (temSessao() ? 'Entra com a mesma sessão' : 'Vai pedir login') + '</div>';
    wrap.appendChild(menu);

    function fechar() {
      if (!wrap.classList.contains('aberto')) return;
      // Só devolve o foco se ele estava DENTRO do menu (Esc, Tab pra fora).
      // Devolver sempre roubaria o foco de quem clicou num campo lá fora — o
      // clique de fora também passa por aqui.
      var tinhaFoco = menu.contains(document.activeElement);
      wrap.classList.remove('aberto');
      botao.setAttribute('aria-expanded', 'false');
      if (tinhaFoco) botao.focus();
    }
    function alternar(ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      var abrindo = !wrap.classList.contains('aberto');
      wrap.classList.toggle('aberto', abrindo);
      botao.setAttribute('aria-expanded', abrindo ? 'true' : 'false');
      // O rodapé conta a verdade do momento: a sessão pode ter caído com a aba aberta.
      if (abrindo) {
        var pe = menu.querySelector('.sis-menu-foot');
        if (pe) {
          pe.innerHTML = '<i class="ti ' + (temSessao() ? 'ti-lock-open' : 'ti-lock') + '"></i> ' +
                         (temSessao() ? 'Entra com a mesma sessão' : 'Vai pedir login');
        }
        var primeiro = menu.querySelector('a.sis-menu-item');
        if (primeiro) primeiro.focus();
      }
    }

    botao.setAttribute('aria-haspopup', 'true');
    botao.setAttribute('aria-expanded', 'false');
    botao.addEventListener('click', alternar);
    // Clicar no item "você está aqui" não navega: só fecha.
    var eu = menu.querySelector('.sis-menu-item.atual');
    if (eu) eu.addEventListener('click', fechar);
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });

    return { fechar: fechar, alternar: alternar, menu: menu };
  }

  window.SISTEMAS_APLIC = SISTEMAS;
  window.CHAVE_SESSAO_APLIC = CHAVE_SESSAO;
  window.montarTrocadorDeSistema = montar;
})();
