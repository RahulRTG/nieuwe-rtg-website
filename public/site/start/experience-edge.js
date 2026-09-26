(function (w, d) {
  'use strict';
  if (w.RTGPublicApp) return; // The public projection mounts the same shared Edge once.
  var X = w.RTGExperience, edge = w.RTGAdaptiveEdge, scenes = Array.from(d.querySelectorAll('[data-scene]'));
  if (!X || !edge) return;
  var index = 0, pending = false, lastScroll = w.scrollY;
  var root = d.createElement('div'); root.className = 'rtg-experience-edge'; d.body.appendChild(root);
  function panel(id, title, copy) { edge.openPanel(d.getElementById(id), { title: title, copy: copy || '' }); }
  function next() { X.go(scenes[Math.min(index + 1, scenes.length - 1)].id); }
  function back() { X.go(scenes[Math.max(0, index - 1)].id); }
  function actions() {
    var id = scenes[index].id;
    var rows = [{ label: index ? 'Verder op deze pagina' : 'Bekijk het platform', run: next }, { label: 'Zoek in RTG', run: function () { if (w.RTGCommand) w.RTGCommand.open(); } }];
    if (id === 'platform') rows = [{ label: 'Bekijk de verbindingsketen', run: function () { X.go('verbinding'); } }, { label: 'Verken de RTG Graph', run: function () { X.go('graph'); } }, { label: 'Explore RTG', run: function () { X.go('explore'); } }];
    if (id === 'verbinding' || id === 'graph' || id === 'explore') rows = [{ label: 'Zoek een onderdeel', run: function () { if (w.RTGCommand) w.RTGCommand.open(); } }, { label: 'Kies een andere ingang', run: function () { X.go('platform'); } }, { label: 'Open de echte app', run: function () { w.location.assign('https://app.rahultravelgroup.com/apps/app.html'); } }];
    if (id === 'moment' || id === 'rahul') rows = [{ label: 'Bekijk het voorbeeldvoorstel', run: X.proposal }, { label: 'Verander de voorbeeldsituatie', run: function () { X.go('moment'); } }, { label: 'Bekijk uw RTG', run: function () { X.go('uw-rtg'); } }];
    if (id === 'uw-rtg') rows = [{ label: 'Waarom zie ik dit?', run: X.explain }, { label: 'Verken alle werelden', run: function () { X.go('werelden'); } }, { label: 'Reset mijn verkenning', run: X.reset }];
    if (id === 'werelden') rows = [{ label: 'Volgende wereld', run: function () { X.nextWorld(1); } }, { label: 'Vorige wereld', run: function () { X.nextWorld(-1); } }, { label: 'Kies een wereld', run: function () { panel('worldPanel', 'Uw vier werelden'); } }];
    if (id === 'regie') rows = [{ label: 'Bekijk het veranderde voorstel', run: X.proposal }, { label: 'Lees de privacyvragen', run: X.allQuestions }];
    if (id === 'passen' || id === 'vragen') rows = [{ label: 'Bekijk alle vragen', run: X.allQuestions }, { label: 'Vergelijk alle passen', run: function () { X.go('passen'); } }, { label: 'Maak mijn RTG', run: function () { X.go('begin'); } }];
    if (id === 'begin') rows = [{ label: 'Naar de beveiligde aanmeldomgeving', run: function () { w.location.assign(d.getElementById('createAccount').href); } }, { label: 'Verder ontdekken', run: function () { X.go('moment'); } }, { label: 'Bekijk alle vragen', run: X.allQuestions }];
    return rows;
  }
  function actionPanel() {
    var list = d.getElementById('contextActions'); list.replaceChildren();
    actions().forEach(function (item) { var button = d.createElement('button'); button.type = 'button'; button.textContent = item.label; button.addEventListener('click', function () { edge.setState('dock'); item.run(); }); list.appendChild(button); });
    panel('actionsPanel', scenes[index].dataset.scene, 'Kies wat u wilt doen.');
  }
  var host = { root: root, cfg: { home: '#top', kaart: 'Experience RTG' }, ctx: { title: 'Ontdek RTG' }, onEdgeAction: function (action) {
    if (action === 'menu') panel('explorePanel', 'Rahul Travel Group', 'Kies welk deel van het platform u wilt bekijken.');
    else if (action === 'worlds') panel('worldPanel', 'Uw vier werelden');
    else if (action === 'home') X.go('top');
    else if (action === 'back') back();
    else if (action === 'ai') { if (w.RTGCommand) w.RTGCommand.open(); }
    else if (action === 'context' || action === 'primary' || action === 'connect') actionPanel();
    else if (action === 'status' || action === 'presence') X.go('regie');
    else return false;
    return true;
  } };
  edge.start(d, w, host);
  function update() {
    // De rijen staan in het eigen paneel (actionPanel); de Edge vraagt de host eerst.
    host.ctx.title = scenes[index].dataset.scene;
    edge.continueWith({ title: host.ctx.title, copy: 'Kies uw volgende stap.' });
    var caption = root.querySelector('.rtg-adaptive-caption'); if (caption) caption.textContent = index ? host.ctx.title : 'RTG PLATFORM';
  }
  function measure() {
    pending = false;
    var found = 0, probe = innerHeight * .36;
    scenes.forEach(function (scene, i) { if (scene.getBoundingClientRect().top <= probe) found = i; });
    var input = /INPUT|TEXTAREA|SELECT/.test(d.activeElement && d.activeElement.tagName || '');
    if (found !== index && !root.querySelector('.rtg-adaptive-edge[data-rtg-adaptive-state="expanded"]')) { index = found; update(); }
    var active = scenes[index]; d.body.dataset.rtgWorld = active.id === 'werelden' ? X.currentWorld() : active.dataset.tone;
    var field = d.querySelector('.fragment-field'), rect = d.getElementById('versnippering').getBoundingClientRect();
    field.style.setProperty('--gather', String(Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)))));
    if (!input && Math.abs(w.scrollY - lastScroll) > 15 && root.querySelector('[data-rtg-adaptive-state="dock"]')) root.dataset.reading = String(w.scrollY > lastScroll);
    lastScroll = w.scrollY;
  }
  w.addEventListener('scroll', function () { if (!pending) { pending = true; w.requestAnimationFrame(measure); } }, { passive: true });
  w.addEventListener('resize', measure);
  d.getElementById('experienceLanguage').addEventListener('click', function () { edge.setState('dock'); if (w.RTGi18n) w.RTGi18n.openModal(); });
  update(); measure();
}(window, document));
