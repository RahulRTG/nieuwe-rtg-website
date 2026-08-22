/* RTG Reality Engine
   Een lokale, gedeelde contextlaag voor Social. De laag leest alleen de
   zichtbare pagina, netwerkstatus en klok. Rahul bereidt voor; de mens beslist. */
(function () {
  'use strict';

  var pad = location.pathname;
  var routes = [
    { key: 'today', label: 'Vandaag', href: '/apps/sociaal.html' },
    { key: 'messages', label: 'Berichten', href: '/apps/comm.html' },
    { key: 'salon', label: 'Salon', href: '/apps/salon.html' },
    { key: 'circles', label: 'Kringen', href: '/apps/genootschap.html' },
    { key: 'private', label: 'Privé', href: '/apps/sociaal-prive.html' }
  ];
  var privatePaths = ['/apps/sociaal-prive.html', '/apps/meet.html', '/apps/vonk.html',
    '/apps/rendezvous.html', '/apps/cercle.html', '/apps/entourage.html', '/apps/attenties.html'];
  var active = pad === '/apps/comm.html' ? 'messages' :
    (pad === '/apps/salon.html' || pad === '/apps/pulse.html') ? 'salon' :
    pad === '/apps/genootschap.html' ? 'circles' :
    privatePaths.indexOf(pad) !== -1 ? 'private' : 'today';
  var contextName = routes.filter(function (route) { return route.key === active; })[0].label;

  function make(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function addStylesheet() {
    if (document.querySelector('link[href="/shared/social-intelligence.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/shared/social-intelligence.css';
    document.head.appendChild(link);
  }

  function graph() {
    var panel = make('aside', 'rtg-reality-graph');
    panel.setAttribute('aria-label', 'Live contextgrafiek van RTG Social');
    panel.innerHTML = '<div class="rtg-graph-head"><span>REALITY GRAPH</span><b><i></i>LIVE CONTEXT</b></div>' +
      '<svg viewBox="0 0 540 250" role="img" aria-label="De vijf verbonden ruimtes van uw sociale wereld">' +
      '<defs><filter id="rtgIon"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<path class="rtg-graph-orbit" d="M32 132C114 24 250 14 350 66S478 191 514 121"/>' +
      '<path class="rtg-graph-signal" d="M32 132C114 24 250 14 350 66S478 191 514 121"/>' +
      '<path class="rtg-graph-link" d="M32 132L154 70L270 145L384 68L514 121"/>' +
      '<g class="rtg-graph-node" data-node="today" transform="translate(32 132)"><circle r="15"/><circle class="rtg-node-core" r="4"/><text x="0" y="36">VANDAAG</text><text class="rtg-node-code" x="0" y="50">01 / NOW</text></g>' +
      '<g class="rtg-graph-node" data-node="messages" transform="translate(154 70)"><circle r="15"/><circle class="rtg-node-core" r="4"/><text x="0" y="-28">BERICHTEN</text><text class="rtg-node-code" x="0" y="-15">02 / DIRECT</text></g>' +
      '<g class="rtg-graph-node" data-node="salon" transform="translate(270 145)"><circle r="18"/><circle class="rtg-node-core" r="5"/><text x="0" y="38">SALON</text><text class="rtg-node-code" x="0" y="52">03 / MOMENTS</text></g>' +
      '<g class="rtg-graph-node" data-node="circles" transform="translate(384 68)"><circle r="15"/><circle class="rtg-node-core" r="4"/><text x="0" y="-28">KRINGEN</text><text class="rtg-node-code" x="0" y="-15">04 / TRUST</text></g>' +
      '<g class="rtg-graph-node" data-node="private" transform="translate(514 121)"><circle r="15"/><circle class="rtg-node-core" r="4"/><text x="0" y="36">PRIVE</text><text class="rtg-node-code" x="0" y="50">05 / SEALED</text></g>' +
      '</svg><div class="rtg-graph-foot"><span>LOCAL-FIRST</span><span>NO PUBLIC SCORE</span><span>HUMAN AUTHORITY</span></div>';
    var current = panel.querySelector('[data-node="' + active + '"]');
    if (current) current.classList.add('is-active');
    return panel;
  }

  function mountGraph() {
    var host = document.querySelector('.merkkop, .salon-werkveld>header, .rtg-suitehero, .private-hero');
    if (!host || host.querySelector('.rtg-reality-graph')) return;
    host.classList.add('rtg-intel-host');
    host.appendChild(graph());
  }

  function visibleSignals() {
    var nodes = document.querySelectorAll('.post, .gsp, .gesprek, .kaart, .private-room, .cv-stip, .reis, [data-post-id], [data-id]');
    var seen = [];
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') return;
      var style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (seen.indexOf(node) === -1) seen.push(node);
    });
    return seen.length;
  }

  function telemetry() {
    var strip = make('section', 'rtg-intel-strip');
    strip.setAttribute('aria-label', 'RTG Intelligence status');
    var identity = make('div', 'rtg-intel-identity');
    identity.appendChild(make('span', '', 'REALITY ENGINE'));
    identity.appendChild(make('b', '', 'SOCIAL / CONTEXTUAL OS'));
    strip.appendChild(identity);
    var data = make('dl', 'rtg-intel-data');
    [['TIME', 'rtgIntelTime', '--:--:--'], ['CONTEXT', '', contextName],
      ['SIGNALS', 'rtgIntelSignals', '0 VISIBLE'], ['NETWORK', 'rtgIntelNetwork', 'CHECKING'],
      ['AUTHORITY', '', 'MENS BESLIST']].forEach(function (item) {
      var cell = make('div', 'rtg-intel-cell');
      cell.appendChild(make('dt', '', item[0]));
      var value = make('dd', '', item[2]);
      if (item[1]) value.id = item[1];
      if (item[0] === 'NETWORK' || item[0] === 'AUTHORITY') value.className = 'rtg-intel-state';
      cell.appendChild(value);
      data.appendChild(cell);
    });
    strip.appendChild(data);
    var command = make('button', 'rtg-intel-command');
    command.type = 'button';
    command.setAttribute('aria-haspopup', 'dialog');
    command.setAttribute('aria-controls', 'rtgIntelDeck');
    command.innerHTML = '<span>OPEN COMMAND</span><kbd>⌘ K</kbd>';
    strip.appendChild(command);
    return strip;
  }

  function mountTelemetry() {
    var strip = telemetry();
    var messageCore = document.querySelector('.comm');
    if (messageCore) {
      document.body.insertBefore(strip, messageCore);
      document.body.classList.add('rtg-intel-messages');
      return;
    }
    var todayNav = document.querySelector('.sociaal-ruimtes');
    if (todayNav) {
      todayNav.insertAdjacentElement('afterend', strip);
      return;
    }
    var salonHeader = document.querySelector('.salon-werkveld>header');
    if (salonHeader) {
      salonHeader.insertAdjacentElement('afterend', strip);
      return;
    }
    var host = document.querySelector('.rtg-suitehero, .private-hero');
    if (host) host.insertAdjacentElement('afterend', strip);
    else document.body.insertBefore(strip, document.body.firstChild);
  }

  window.RTGRealityEngine = {
    contextName: contextName,
    addStylesheet: addStylesheet,
    mountGraph: mountGraph,
    mountTelemetry: mountTelemetry,
    visibleSignals: visibleSignals
  };
})();
