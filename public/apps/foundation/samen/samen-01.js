/* Rustig samenkijken voor gezin en bevestigde vrienden. Een deelcode opent
   alleen de eerste toetreding; daarna bewaart de browser een kamer-id. */
(function () {
  if (window.__rtfSamen) return; window.__rtfSamen = true;
  if (!window.Sessie || !Sessie.actief()) return;
  var s = Sessie.huidig();
  if (!s || !s.token) return;
  document.body.classList.add('ds-samen-host');
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  /* De vorm komt uitsluitend uit public/ds/componenten/samen.css. */
  var maakEl = function (h) { var d = document.createElement('div'); d.innerHTML = h; var el = d.firstChild; vorm(el); return el; };
  /* De gezins-Samen gebruikt dezelfde DS-bouwstenen, niet het ledentransport. */
  function vorm(root) {
    var klassen = { 'rsm-knop': 'ds-samen-secundair', 'rsm-rahul': 'ds-samen-doe',
      'rsm-sheet': 'ds-samen-venster ds-samen-venster--foundation', 'rsm-rsheet': 'ds-samen-venster ds-samen-venster--foundation',
      'rsm-kop': 'ds-samen-kop ds-samen-kop--vast', 'rsm-x': 'ds-samen-sluit',
      'rsm-uit': 'ds-samen-uitleg', 'rsm-ruit': 'ds-samen-uitleg', 'rsm-rij': 'ds-samen-rij',
      'rsm-go': 'ds-samen-doe', 'rsm-stil': 'ds-samen-secundair', 'rsm-chat': 'ds-samen-chat',
      'rsm-code': 'ds-samen-code', 'rsm-banner': 'ds-samen-banner' };
    Object.keys(klassen).forEach(function (naam) {
      var nodes = Array.from(root.querySelectorAll('.' + naam));
      if (root.classList.contains(naam)) nodes.unshift(root);
      nodes.forEach(function (n) { klassen[naam].split(' ').forEach(function (k) { n.classList.add(k); }); });
    });
    root.querySelectorAll('[data-start]').forEach(function (n) { n.classList.add('ds-samen-doe--breed'); n.removeAttribute('style'); });
    root.querySelectorAll('[data-mee] input').forEach(function (n) { n.classList.add('ds-samen-codeinvoer'); n.removeAttribute('style'); });
  }
  function sluitPaneel(paneel, ingang) {
    paneel.hidden = true; ingang.hidden = false;
    if (ingang.isConnected) ingang.focus();
  }
  function paneelToets(paneel, ingang) {
    paneel.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      if (paneel === sheet) deelCode = null;
      sluitPaneel(paneel, ingang);
    });
  }
