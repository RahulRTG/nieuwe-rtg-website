(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); }, D = window.RTGLivingData, R = window.RTGLivingRender;
  var state = { data: null, world: 'now', view: 'worlds', decision: null, loading: false };
  var views = { universe: ['.lo-worlds', 'Overzicht', 'Ververs overzicht'], intent: ['.lo-intent', 'Leefcontext', 'Ververs context'],
    worlds: ['.lo-worlds', 'Live horizon', 'Ververs horizon'], decisions: ['.lo-decisions', 'Besluiten', 'Controleer besluit'], evidence: ['.lo-decisions', 'Bronnen & bewijs', 'Ververs bronnen'] };
  var embed = new URLSearchParams(location.search).get('embed') === '1';
  document.querySelector('.lo-intent').dataset.edgeScreen = 'intent'; document.querySelector('.lo-worlds').dataset.edgeScreen = 'worlds'; document.querySelector('.lo-decisions').dataset.edgeScreen = 'decisions';
  function zet(id, tekst) { var el = $('#' + id); if (el) el.textContent = tekst; }
  async function laad() {
    if (state.loading) return; state.loading = true; zet('loHealth', 'Bronnen ophalen…');
    try { state.data = await D.laad(); R.all(state); } catch (e) { zet('loHealth', e.message); } finally { state.loading = false; }
  }
  function setWorld(id) {
    state.world = ['now', 'horizon', 'sources'].includes(id) ? id : 'now';
    document.querySelectorAll('[data-world]').forEach(function (b) { b.classList.toggle('actief', b.dataset.world === state.world); }); R.world(state);
  }
  function setView(id, nav) {
    if (!views[id]) id = 'worlds'; state.view = id; document.body.dataset.loView = id;
    document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('actief', b.dataset.view === id); }); document.querySelectorAll('.lo-panel').forEach(function (p) { p.removeAttribute('data-edge-active'); }); $(views[id][0]).setAttribute('data-edge-active', '');
    if (id === 'evidence') setWorld('sources');
    if (window.RTGEdge && RTGEdge.active) RTGEdge.setContext({ scope: 'LIVING', title: views[id][1], tool: id, actie: views[id][2] });
    if (nav && !embed) history.replaceState(null, '', '?view=' + id);
  }
  function action(a) {
    if (a === 'refresh') laad(); else if (a === 'why') $('#loWhy').hidden = !$('#loWhy').hidden; else if (a === 'focus') document.body.classList.toggle('lo-focus');
    else if (a === 'approve' && state.decision) { zet('loDialogTitle', state.decision.titel); zet('loDialogText', state.decision.delegatie.reden); $('#loDecisionCheck').checked = false; $('#loDialog').showModal(); }
  }
  if (embed) document.body.classList.add('rtg-edge-embed');
  else if (window.RTGEdge) { RTGEdge.start({ world: 'living', context: { scope: 'LIVING', title: 'Live horizon', tool: 'worlds', actie: 'Ververs horizon' }, onTool: function (id) { setView(id, true); }, onAction: laad }); RTGEdge.setLayout(innerWidth < 768 ? 1 : innerWidth < 1050 ? 2 : 4); }
  document.querySelectorAll('[data-world]').forEach(function (b) { b.onclick = function () { setWorld(b.dataset.world); }; }); document.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function () { action(b.dataset.act); }; }); document.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { setView(b.dataset.view, true); }; }); document.querySelectorAll('[data-link]').forEach(function (b) { b.onclick = function () { location.href = b.dataset.link; }; });
  $('#loDecisionForm').onsubmit = async function (e) {
    e.preventDefault(); if (!state.decision || !$('#loDecisionCheck').checked) return; $('#loDecisionSubmit').disabled = true;
    try { await D.beslis(state.decision.id, true); $('#loDialog').close(); zet('loContext', 'Uw akkoord is door het Privékantoor vastgelegd.'); await laad(); }
    catch (x) { zet('loDialogText', x.message); } finally { $('#loDecisionSubmit').disabled = false; }
  };
  document.querySelectorAll('.lo-panel').forEach(function (p) { p.addEventListener('pointerdown', function () { if (p.dataset.edgeScreen) setView(p.dataset.edgeScreen, false); }); });
  setInterval(function () { zet('loClock', new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })); }, 1000); setView(new URLSearchParams(location.search).get('view') || 'worlds', false); laad();
})();
